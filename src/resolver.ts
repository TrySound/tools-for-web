import * as z from "zod/mini";
import { generateKeyBetween } from "fractional-indexing";
import {
  resolverDocumentSchema,
  type ResolverDocument,
  type ResolverSet,
  type ResolverModifier,
} from "./dtcg.schema";
import {
  serializeDesignTokens,
  extractIntermediaryNodes,
  resolveIntermediaryNodes,
  type IntermediaryNode,
} from "./tokens";
import { compareTreeNodes } from "./store";
import type {
  GroupMeta,
  SetMeta,
  TokenMeta,
  TreeNodeMeta,
  ModifierMeta,
  ContextMeta,
} from "./state.svelte";
import type { TreeNode } from "./store";

type ParseResult = {
  nodes: TreeNode<TreeNodeMeta>[];
  errors: Array<{ path: string; message: string }>;
};

// Helper function to deep merge sources respecting path-based order
// Later sources override earlier ones at the same path
const mergeSources = (
  sources: Record<string, unknown>[],
): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};

  const deepMerge = (
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): void => {
    for (const [key, value] of Object.entries(source)) {
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof Date) &&
        !("$value" in value) && // Token - don't merge, replace
        target[key] !== null &&
        typeof target[key] === "object" &&
        !Array.isArray(target[key]) &&
        target[key] instanceof Object
      ) {
        // Both are plain objects and not tokens - recurse
        deepMerge(
          target[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else {
        // Override: later source wins
        target[key] = value;
      }
    }
  };

  for (const source of sources) {
    deepMerge(merged, source);
  }

  return merged;
};

// Detect if JSON is resolver format by checking for resolver-specific fields
export const isResolverFormat = (obj: unknown): boolean => {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const o = obj as Record<string, unknown>;
  // Resolver must have version "2025.10" and resolutionOrder array
  return o.version === "2025.10" && Array.isArray(o.resolutionOrder);
};

// Parse resolver document containing sets and modifiers in resolutionOrder
// Creates separate root token-sets for each Set item
// Only processes Set items; Modifier items are silently skipped
// Supports cross-set token aliases through two-phase resolution:
// Phase 1: Extract intermediary nodes from all sets (collect what tokens/groups exist)
// Phase 2: Resolve with all accumulated nodes available (enables cross-set references)
export const parseTokenResolver = (input: unknown): ParseResult => {
  // Validate resolver document structure
  const validation = resolverDocumentSchema.safeParse(input);

  if (!validation.success) {
    const errorMessage = z.prettifyError(validation.error);
    return {
      nodes: [],
      errors: [{ path: "resolver", message: errorMessage }],
    };
  }

  const resolverDoc: ResolverDocument = validation.data;
  const allNodes: Array<any> = [];
  const collectedErrors: Array<{ path: string; message: string }> = [];
  const lastChildIndexPerParent = new Map<string | undefined, string>();
  const zeroIndex = generateKeyBetween(null, null);

  // PHASE 1: Extract intermediary nodes from all sets and modifiers
  // This collects all tokens/groups with their paths, without resolving references yet
  // Global intermediary nodes only contain set nodes (not modifiers) to prevent pollution
  const globalIntermediaryNodes = new Map<string, IntermediaryNode>();
  const intermediaryNodesBySet = new Map<
    string,
    Map<string, IntermediaryNode>
  >();

  for (const item of resolverDoc.resolutionOrder) {
    if (item.type === "set") {
      const mergedSetSources = mergeSources(item.sources);
      const { nodes, errors } = extractIntermediaryNodes(mergedSetSources);
      intermediaryNodesBySet.set(item.name, nodes);
      // Only add set nodes to global namespace - modifiers are conditional
      for (const [path, node] of nodes) {
        globalIntermediaryNodes.set(path, node);
      }
      collectedErrors.push(...errors);
      continue;
    }

    if (item.type === "modifier") {
      // Extract intermediary nodes from each context's sources
      for (const [contextName, sources] of Object.entries(item.contexts)) {
        const mergedContextSources = mergeSources(sources);
        const { nodes, errors } =
          extractIntermediaryNodes(mergedContextSources);
        // Use unique key for context to track its nodes separately
        const contextKey = `${item.name}/${contextName}`;
        intermediaryNodesBySet.set(contextKey, nodes);
        // Do NOT add modifier nodes to globalIntermediaryNodes
        // Modifiers are conditional and should not pollute global namespace
        collectedErrors.push(...errors);
      }
      continue;
    }

    item satisfies never;
  }

  // PHASE 2: Resolve intermediary nodes with cross-set availability
  // Now that we have all tokens/groups from all sets, resolve references with full visibility
  for (const item of resolverDoc.resolutionOrder) {
    if (item.type === "set") {
      // Set processing
      // Get this set's intermediary nodes
      const intermediaryNodes = intermediaryNodesBySet.get(item.name);
      if (!intermediaryNodes) {
        continue;
      }
      // Resolve this set's intermediary nodes, using only global nodes for reference lookup
      // Sets can only reference other set tokens (global namespace), not modifier tokens
      const { nodes, errors } = resolveIntermediaryNodes(
        intermediaryNodes,
        globalIntermediaryNodes,
      );

      // Create a new token-set node for this Set
      const setNodeId = crypto.randomUUID();
      const prevSetIndex = lastChildIndexPerParent.get(undefined);
      const newSetIndex = generateKeyBetween(prevSetIndex ?? zeroIndex, null);
      lastChildIndexPerParent.set(undefined, newSetIndex);

      const setNode: TreeNode<SetMeta> = {
        nodeId: setNodeId,
        parentId: undefined,
        index: newSetIndex,
        meta: {
          nodeType: "token-set",
          name: item.name,
          description: item.description,
          extensions: item.$extensions,
        },
      };

      // Add the token-set node
      allNodes.push(setNode);

      // Re-parent root-level tokens/groups from this Set to the token-set node
      // Only set parentId for nodes at root level (parentId is undefined)
      // This preserves the hierarchy of nested groups and tokens within the Set
      for (const node of nodes) {
        if (node.parentId === undefined) {
          node.parentId = setNodeId;
        }
        allNodes.push(node);
      }

      // Collect errors from this Set
      collectedErrors.push(...errors);
      continue;
    }

    if (item.type === "modifier") {
      // Create token-modifier node at root level
      const modifierNodeId = crypto.randomUUID();
      const prevModifierIndex = lastChildIndexPerParent.get(undefined);
      const newModifierIndex = generateKeyBetween(
        prevModifierIndex ?? zeroIndex,
        null,
      );
      lastChildIndexPerParent.set(undefined, newModifierIndex);

      const modifierNode: TreeNode<ModifierMeta> = {
        nodeId: modifierNodeId,
        parentId: undefined,
        index: newModifierIndex,
        meta: {
          nodeType: "token-modifier",
          name: item.name,
          description: item.description,
          extensions: item.$extensions,
          default: undefined, // Will be set after contexts created
        },
      };
      allNodes.push(modifierNode);

      // Process each context
      let defaultContextNodeId: string | undefined;

      for (const contextName of Object.keys(item.contexts)) {
        const contextNodeId = crypto.randomUUID();
        const contextKey = `${item.name}/${contextName}`;

        // Get this context's intermediary nodes
        const contextIntermediaryNodes = intermediaryNodesBySet.get(contextKey);
        if (!contextIntermediaryNodes) {
          continue;
        }

        // Create combined map: context nodes + global nodes
        // Modifiers can reference their own nodes OR global set nodes, but NOT other modifier nodes
        const modifierAvailableNodes = new Map(globalIntermediaryNodes);
        for (const [path, node] of contextIntermediaryNodes) {
          modifierAvailableNodes.set(path, node);
        }

        // Resolve context's intermediary nodes using combined map
        const { nodes: resolvedContextNodes, errors: contextErrors } =
          resolveIntermediaryNodes(
            contextIntermediaryNodes,
            modifierAvailableNodes,
          );

        // Create token-context node
        const contextNode: TreeNode<ContextMeta> = {
          nodeId: contextNodeId,
          parentId: modifierNodeId,
          index: generateKeyBetween(
            lastChildIndexPerParent.get(modifierNodeId) ?? zeroIndex,
            null,
          ),
          meta: {
            nodeType: "token-context",
            name: contextName,
          },
        };

        // Track index for next sibling context
        lastChildIndexPerParent.set(modifierNodeId, contextNode.index);

        allNodes.push(contextNode);

        // Re-parent tokens/groups from context sources to context node
        // Only root-level tokens/groups (parentId === undefined) get re-parented
        // This preserves nested group hierarchies
        for (const node of resolvedContextNodes) {
          if (node.parentId === undefined) {
            node.parentId = contextNodeId;
          }
          allNodes.push(node);
        }

        collectedErrors.push(...contextErrors);

        // Track default context
        if (item.default === contextName) {
          defaultContextNodeId = contextNodeId;
        }
      }

      // Set modifier's default after all contexts created
      if (defaultContextNodeId) {
        modifierNode.meta.default = {
          ref: defaultContextNodeId,
        };
      }

      continue;
    }
  }

  return {
    nodes: allNodes,
    errors: collectedErrors,
  };
};

/**
 * Serializes tree nodes back into a ResolverDocument following the Design Tokens Resolver Module 2025.10 specification.
 *
 * This function converts a tree structure (as produced by parseTokenResolver) back into a valid resolver document.
 * Each token-set node at the root level becomes a Set in the resolutionOrder array.
 *
 * @param nodes - Map of all tree nodes (nodeId → TreeNode)
 * @param metadata - Optional document-level metadata (name and description)
 * @returns A valid ResolverDocument with sets organized in resolutionOrder
 *
 * @example
 * ```typescript
 * const resolver = parseTokenResolver(jsonData);
 * const document = serializeTokenResolver(
 *   new Map(resolver.nodes.map(n => [n.nodeId, n])),
 *   { name: "My Design System", description: "..." }
 * );
 * ```
 */
export const serializeTokenResolver = (
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
  metadata?: { name?: string; description?: string },
): ResolverDocument => {
  const setNodes: Array<TreeNode<SetMeta>> = [];
  const modifierNodes: Array<TreeNode<ModifierMeta>> = [];

  for (const node of nodes.values()) {
    if (node.parentId === undefined) {
      if (node.meta.nodeType === "token-set") {
        setNodes.push(node as TreeNode<SetMeta>);
      }
      if (node.meta.nodeType === "token-modifier") {
        modifierNodes.push(node as TreeNode<ModifierMeta>);
      }
    }
  }

  // Sort by index to maintain document order
  setNodes.sort(compareTreeNodes);
  modifierNodes.sort(compareTreeNodes);

  const resolutionOrder: (ResolverSet | ResolverModifier)[] = [];

  // Helper function to collect descendants (used for both sets and contexts)
  const collectDescendants = (parentNodeId: string | undefined) => {
    const subtree = new Map<string, TreeNode<TreeNodeMeta>>();
    const _collect = (nodeId: string | undefined) => {
      let node = nodeId ? nodes.get(nodeId) : undefined;
      if (!node) {
        return;
      }
      // Skip the specified node type and token-modifier/token-context nodes
      if (
        node.meta.nodeType === "token-set" ||
        node.meta.nodeType === "token-modifier" ||
        node.meta.nodeType === "token-context"
      ) {
        // But continue collecting descendants
        for (const child of nodes.values()) {
          if (child.parentId === nodeId) {
            _collect(child.nodeId);
          }
        }
        return;
      }

      // Re-parent direct children of parent to root (undefined)
      if (node.parentId === parentNodeId && parentNodeId !== undefined) {
        // avoid mutating original nodes
        node = { ...node, parentId: undefined };
      }
      subtree.set(node.nodeId, node);

      // Recursively collect all children
      for (const child of nodes.values()) {
        if (child.parentId === nodeId) {
          _collect(child.nodeId);
        }
      }
    };
    _collect(parentNodeId);
    return subtree;
  };

  // Serialize sets
  for (const setNode of setNodes) {
    // Create a filtered map containing only this set's descendants (excluding the set node itself)
    // serializeDesignTokens expects token and group nodes, not token-set nodes
    const setSubtree = collectDescendants(setNode.nodeId);

    const source = serializeDesignTokens(
      setSubtree as Map<string, TreeNode<TokenMeta | GroupMeta>>,
      nodes as Map<string, TreeNode<TokenMeta | GroupMeta>>, // Pass all nodes for cross-set reference lookup
    );
    resolutionOrder.push({
      type: "set",
      name: setNode.meta.name,
      description: setNode.meta.description,
      $extensions: setNode.meta.extensions,
      sources: [source],
    });
  }

  // Serialize modifiers
  for (const modifierNode of modifierNodes) {
    // Collect all context nodes for this modifier
    const contextNodes: Array<TreeNode<ContextMeta>> = [];
    for (const node of nodes.values()) {
      if (
        node.parentId === modifierNode.nodeId &&
        node.meta.nodeType === "token-context"
      ) {
        contextNodes.push(node as TreeNode<ContextMeta>);
      }
    }
    contextNodes.sort(compareTreeNodes);

    // Build contexts map
    const contexts: Record<string, any[]> = {};
    for (const contextNode of contextNodes) {
      // Create subtree containing only this context's descendants
      const contextSubtree = collectDescendants(contextNode.nodeId);

      // Serialize tokens/groups under this context
      // Note: serializeDesignTokens inlines all sources
      const serialized = serializeDesignTokens(
        contextSubtree as Map<string, TreeNode<TokenMeta | GroupMeta>>,
        nodes as Map<string, TreeNode<TokenMeta | GroupMeta>>, // Pass all nodes for cross-set reference lookup
      );
      contexts[contextNode.meta.name] = [serialized];
    }

    // Find default context name from default NodeRef
    let defaultContextName: string | undefined;
    if (modifierNode.meta.default) {
      const defaultNode = nodes.get(modifierNode.meta.default.ref);
      if (defaultNode?.meta.nodeType === "token-context") {
        defaultContextName = defaultNode.meta.name;
      }
    }

    // Build ResolverModifier
    const modifier: ResolverModifier = {
      type: "modifier",
      name: modifierNode.meta.name,
      contexts,
      ...(modifierNode.meta.description && {
        description: modifierNode.meta.description,
      }),
      ...(defaultContextName && { default: defaultContextName }),
      ...(modifierNode.meta.extensions && {
        $extensions: modifierNode.meta.extensions,
      }),
    };

    resolutionOrder.push(modifier);
  }

  return {
    version: "2025.10",
    name: metadata?.name,
    description: metadata?.description,
    resolutionOrder,
  };
};
