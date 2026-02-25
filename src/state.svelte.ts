import * as z from "zod/mini";
import { createSubscriber } from "svelte/reactivity";
import { generateKeyBetween } from "fractional-indexing";
import { TreeStore, type Transaction, type TreeNode } from "./store";
import {
  type RawValue,
  type RawValueWithReference,
  type Value,
  type NodeRef,
  RawValueSchema,
  isNodeRef,
} from "./schema";

export type SetMeta = {
  nodeType: "token-set";
  name: string;
  description?: string;
  extensions?: Record<string, unknown>;
};

export type GroupMeta = {
  nodeType: "token-group";
  name: string;
  type?: Value["type"];
  description?: string;
  deprecated?: boolean | string;
  extensions?: Record<string, unknown>;
};

export type TokenMeta = {
  nodeType: "token";
  name: string;
  description?: string;
  deprecated?: boolean | string;
  extensions?: Record<string, unknown>;
} & RawValueWithReference;

export type ModifierMeta = {
  nodeType: "token-modifier";
  name: string;
  description?: string;
  default?: NodeRef;
  extensions?: Record<string, unknown>;
};

export type ContextMeta = {
  nodeType: "token-context";
  name: string;
  description?: string;
  extensions?: Record<string, unknown>;
};

/**
 * Helper function to find the type of a token
 * Searches through reference chain or parent group hierarchy
 */
export const findTokenType = (
  node: TreeNode<TreeNodeMeta>,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): Value["type"] | undefined => {
  // Node types without explicit types (no $type inheritance)
  if (
    node.meta.nodeType === "token-set" ||
    node.meta.nodeType === "token-modifier" ||
    node.meta.nodeType === "token-context"
  ) {
    return;
  }
  // If token has explicit type, use it
  if (node.meta.type) {
    return node.meta.type;
  }
  // If token is a child of a group, check parent group's type
  let currentParentId: string | undefined = node?.parentId;
  while (currentParentId !== undefined) {
    const parentNode = nodes.get(currentParentId);
    if (parentNode?.meta.nodeType === "token-group" && parentNode.meta.type) {
      return parentNode.meta.type;
    }
    currentParentId = parentNode?.parentId;
  }
};

type ResolveContext = {
  nodes: Map<string, TreeNode<TreeNodeMeta>>;
  resolvingStack: Set<string>;
};

/**
 * Helper function to resolve a single token reference
 */
const getToken = (
  ctx: ResolveContext,
  nodeRef: NodeRef,
): TreeNode<TreeNodeMeta> => {
  const nodeId = nodeRef.ref;
  // check for circular references
  if (ctx.resolvingStack.has(nodeId)) {
    throw new Error(
      `Circular reference detected: ${Array.from(ctx.resolvingStack).join(
        " -> ",
      )} -> ${nodeId}`,
    );
  }
  // look up token by nodeId
  const tokenNode = ctx.nodes.get(nodeId);
  if (tokenNode?.meta.nodeType !== "token") {
    throw new Error(`Token node not found while resolving nodeId "${nodeId}"`);
  }
  return tokenNode;
};

/**
 * Resolves token references but does NOT resolve composite component values.
 * This is useful when you want the raw value of a composite token without
 * resolving its internal component references.
 *
 * For example, a border token with component references will return the raw
 * border value with unresolved references, rather than resolving each component.
 *
 * Returns a RawValue which may contain unresolved NodeRef objects in composite types.
 */
export const resolveRawValue = (
  node: TreeNode<TreeNodeMeta>,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
  resolvingStack: Set<string> = new Set(),
): RawValue => {
  const ctx = { nodes, resolvingStack };
  if (node.meta.nodeType !== "token") {
    throw new Error("resolveRawValue requires a token node");
  }
  // Check if value is a token reference string
  if (isNodeRef(node.meta.value)) {
    const tokenNode = getToken(ctx, node.meta.value);
    // resolve token reference but stop at first non-reference
    const newStack = new Set(resolvingStack);
    const nodeId = node.meta.value.ref;
    if (nodeId) {
      newStack.add(nodeId);
    }
    const resolvedValue = resolveRawValue(tokenNode, nodes, newStack);
    const parsed = RawValueSchema.safeParse(resolvedValue);
    if (!parsed.success) {
      throw Error(z.formatError(parsed.error)._errors.join("\n"));
    }
    return resolvedValue;
  }
  switch (node.meta.type) {
    // composite tokens
    case "transition":
      return { type: "transition", value: node.meta.value };
    case "border":
      return { type: "border", value: node.meta.value };
    case "shadow":
      return { type: "shadow", value: node.meta.value };
    case "typography":
      return { type: "typography", value: node.meta.value };
    case "gradient":
      return { type: "gradient", value: node.meta.value };
    // primitive tokens
    case "number":
      return { type: node.meta.type, value: node.meta.value };
    case "color":
      return { type: node.meta.type, value: node.meta.value };
    case "dimension":
      return { type: node.meta.type, value: node.meta.value };
    case "duration":
      return { type: node.meta.type, value: node.meta.value };
    case "cubicBezier":
      return { type: node.meta.type, value: node.meta.value };
    case "fontFamily":
      return { type: node.meta.type, value: node.meta.value };
    case "fontWeight":
      return { type: node.meta.type, value: node.meta.value };
    case "strokeStyle":
      return { type: node.meta.type, value: node.meta.value };
    default:
      node.meta satisfies never;
      throw Error("Unexpected case");
  }
};

const resolveRef = <
  Input extends RawValue,
  Output extends Extract<Value, { type: Input["type"] }>["value"],
>(
  ctx: ResolveContext,
  type: Input["type"],
  value: NodeRef | Output,
): Output => {
  if (!isNodeRef(value)) {
    return value;
  }
  const tokenNode = getToken(ctx, value);
  const nodeId = value.ref;
  const newStack = new Set(ctx.resolvingStack);
  if (nodeId) {
    newStack.add(nodeId);
  }
  const tokenValue = resolveTokenValue(tokenNode, ctx.nodes, newStack);
  if (tokenValue.type !== type) {
    throw Error(
      `${nodeId} is expected to have ${type} type, received ${tokenValue.type}`,
    );
  }
  return tokenValue.value as Output;
};

/**
 * "extends" resolution algorithm for aliases
 *
 * Parse reference: Extract token path from {group.token}
 * Split path: Convert to segments ["group", "token"]
 * Navigate to token: Find the target token object
 * Validate token: Ensure target has $value property
 * Return token value: Extract and return the $value content
 * Check for cycles: Maintain stack of resolving references
 */
export const resolveTokenValue = (
  node: TreeNode<TreeNodeMeta>,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
  resolvingStack: Set<string> = new Set(),
): Value => {
  const ctx = { nodes, resolvingStack };
  const rawValue = resolveRawValue(node, nodes, resolvingStack);
  // Resolve any component-level references in composite values
  switch (rawValue.type) {
    case "transition": {
      const { value } = rawValue;
      return {
        type: "transition",
        value: {
          duration: resolveRef(ctx, "duration", value.duration),
          delay: resolveRef(ctx, "duration", value.delay),
          timingFunction: resolveRef(ctx, "cubicBezier", value.timingFunction),
        },
      };
    }
    case "border": {
      const { value } = rawValue;
      return {
        type: "border",
        value: {
          color: resolveRef(ctx, "color", value.color),
          width: resolveRef(ctx, "dimension", value.width),
          style: resolveRef(ctx, "strokeStyle", value.style),
        },
      };
    }
    case "shadow":
      return {
        type: "shadow",
        value: rawValue.value.map((shadow) => ({
          color: resolveRef(ctx, "color", shadow.color),
          offsetX: resolveRef(ctx, "dimension", shadow.offsetX),
          offsetY: resolveRef(ctx, "dimension", shadow.offsetY),
          blur: resolveRef(ctx, "dimension", shadow.blur),
          spread: resolveRef(ctx, "dimension", shadow.spread),
          inset: shadow.inset,
        })),
      };
    case "typography": {
      const { value } = rawValue;
      return {
        type: "typography",
        value: {
          fontFamily: resolveRef(ctx, "fontFamily", value.fontFamily),
          fontSize: resolveRef(ctx, "dimension", value.fontSize),
          fontWeight: resolveRef(ctx, "fontWeight", value.fontWeight),
          letterSpacing: resolveRef(ctx, "dimension", value.letterSpacing),
          lineHeight: resolveRef(ctx, "number", value.lineHeight),
        },
      };
    }
    case "gradient":
      return {
        type: "gradient",
        value: rawValue.value.map((gradient) => ({
          color: resolveRef(ctx, "color", gradient.color),
          position: gradient.position,
        })),
      };
    // primitive tokens
    case "number":
    case "color":
    case "dimension":
    case "duration":
    case "cubicBezier":
    case "fontFamily":
    case "fontWeight":
    case "strokeStyle":
      return rawValue;
    default:
      rawValue satisfies never;
      throw Error("Unexpected case");
  }
};

/**
 * Get the path of a node by traversing up to the root
 * Returns array of node names from root to the node
 */
export const getNodePath = (
  node: TreeNode<TreeNodeMeta>,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): string[] => {
  const path: string[] = [];
  let current: TreeNode<TreeNodeMeta> | undefined = node;

  while (current) {
    path.unshift(current.meta.name);
    if (current.parentId) {
      current = nodes.get(current.parentId);
    } else {
      current = undefined;
    }
  }

  return path;
};

/**
 * Find a node at a given path under a parent context
 * Returns the node or undefined if not found
 */
export const findNodeAtPath = (
  contextId: string,
  path: string[],
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): TreeNode<TreeNodeMeta> | undefined => {
  let currentParentId: string | undefined = contextId;

  for (const segment of path) {
    const children = Array.from(nodes.values()).filter(
      (n) => n.parentId === currentParentId,
    );
    const match = children.find((n) => n.meta.name === segment);
    if (!match) {
      return undefined;
    }
    currentParentId = match.nodeId;
  }

  return currentParentId ? nodes.get(currentParentId) : undefined;
};

/**
 * Check if setting an alias would create a circular dependency
 * Returns true if the alias would be safe (no circular dependency)
 * Returns false if the alias would create a circular dependency
 */
export const isAliasCircular = (
  currentTokenId: string,
  targetTokenId: string,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): boolean => {
  const targetNode = nodes.get(targetTokenId);
  if (!targetNode || targetNode.meta.nodeType !== "token") {
    return false;
  }

  const targetTokenMeta = targetNode.meta;

  // If target doesn't have a reference value, it's safe
  if (!isNodeRef(targetTokenMeta.value)) {
    return false;
  }

  // Build the path of tokens that the target references through
  const visited = new Set<string>();
  let currentRef: string | undefined = targetTokenMeta.value.ref;

  while (currentRef) {
    // Prevent infinite loops in our detection logic
    if (visited.has(currentRef)) {
      return false;
    }
    visited.add(currentRef);

    // Get the next reference node
    const refNode = nodes.get(currentRef);
    if (!refNode || refNode.meta.nodeType !== "token") {
      return false;
    }
    // Check if we found the current token we're trying to set as alias
    if (currentRef === currentTokenId) {
      return true; // Circular dependency detected
    }
    // Move to the next reference in the chain
    currentRef = isNodeRef(refNode.meta.value)
      ? refNode.meta.value.ref
      : undefined;
  }

  return false; // No circular dependency
};

/**
 * Create a path of groups in a context, returning the leaf node ID
 * Creates intermediate groups if they don't exist
 */
export const createPathInContext = (
  contextId: string,
  path: string[],
  tx: Transaction<TreeNodeMeta>,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): string => {
  let currentParentId: string = contextId;

  for (const segment of path) {
    // Check if a group with this name already exists
    const existingGroup = Array.from(nodes.values()).find(
      (n) =>
        n.parentId === currentParentId &&
        n.meta.nodeType === "token-group" &&
        n.meta.name === segment,
    );

    if (existingGroup) {
      currentParentId = existingGroup.nodeId;
    } else {
      // Create new group
      const newGroup: TreeNode<TreeNodeMeta> = {
        nodeId: crypto.randomUUID(),
        parentId: currentParentId,
        index: generateKeyBetween(null, null),
        meta: {
          nodeType: "token-group",
          name: segment,
        } as GroupMeta,
      };
      tx.set(newGroup);
      currentParentId = newGroup.nodeId;
      // Update nodes map for subsequent lookups
      nodes.set(newGroup.nodeId, newGroup);
    }
  }

  return currentParentId;
};

export type TreeNodeMeta =
  | GroupMeta
  | TokenMeta
  | SetMeta
  | ModifierMeta
  | ContextMeta;

export class TreeState<Meta> {
  #store = new TreeStore<Meta>();
  #subscribe = createSubscriber((update) => this.#store.subscribe(update));

  get store() {
    return this.#store;
  }

  transact(callback: (tx: Transaction<Meta>) => void): void {
    this.#store.transact(callback);
  }

  subscribe(callback: () => void): () => void {
    return this.#store.subscribe(callback);
  }

  values(): TreeNode<Meta>[] {
    this.#subscribe();
    return this.#store.values();
  }

  nodes(): Map<string, TreeNode<Meta>> {
    this.#subscribe();
    return this.#store.nodes();
  }

  getNode(nodeId: string): undefined | TreeNode<Meta> {
    this.#subscribe();
    return this.#store.nodes().get(nodeId);
  }

  getChildren(nodeId: string | undefined): TreeNode<Meta>[] {
    this.#subscribe();
    return this.#store.getChildren(nodeId);
  }

  getParent(nodeId: string): TreeNode<Meta> | undefined {
    this.#subscribe();
    return this.#store.getParent(nodeId);
  }

  getPrevSibling(nodeId: string): TreeNode<Meta> | undefined {
    this.#subscribe();
    return this.#store.getPrevSibling(nodeId);
  }

  getNextSibling(nodeId: string): TreeNode<Meta> | undefined {
    this.#subscribe();
    return this.#store.getNextSibling(nodeId);
  }

  /**
   * Get all base set nodes (token-set children excluding modifiers)
   */
  getBaseNodes(): TreeNode<Meta>[] {
    this.#subscribe();
    return this.#store
      .getChildren(undefined)
      .filter((n) => (n.meta as TreeNodeMeta).nodeType === "token-set");
  }

  /**
   * Get all tokens under a parent (recursive)
   */
  getAllTokensUnder(parentId: string | undefined): TreeNode<Meta>[] {
    this.#subscribe();
    const tokens: TreeNode<Meta>[] = [];
    const collect = (id: string | undefined) => {
      const children = this.#store.getChildren(id);
      for (const child of children) {
        const meta = child.meta as TreeNodeMeta;
        if (meta.nodeType === "token") {
          tokens.push(child);
        } else if (
          meta.nodeType === "token-group" ||
          meta.nodeType === "token-set" ||
          meta.nodeType === "token-context"
        ) {
          collect(child.nodeId);
        }
      }
    };
    collect(parentId);
    return tokens;
  }

  /**
   * Create a token override in a context based on a source token
   * Returns the new token's nodeId
   */
  createContextOverride(
    contextId: string,
    sourceTokenId: string,
    tokenData: Partial<TokenMeta>,
  ): string {
    const nodes = this.#store.nodes();
    const sourceToken = nodes.get(sourceTokenId);
    if (
      !sourceToken ||
      (sourceToken.meta as TreeNodeMeta).nodeType !== "token"
    ) {
      throw new Error("Source token not found");
    }

    const sourceMeta = sourceToken.meta as TokenMeta;

    // Get the path of the source token (excluding the root set name)
    const fullPath = getNodePath(
      sourceToken as TreeNode<TreeNodeMeta>,
      nodes as Map<string, TreeNode<TreeNodeMeta>>,
    );
    // Remove the root set name from the path
    const pathWithoutRoot = fullPath.slice(1, -1); // Exclude root and token name

    let newTokenId: string | undefined;

    this.transact((tx) => {
      // Create the path in the context
      const parentId = createPathInContext(
        contextId,
        pathWithoutRoot,
        tx as Transaction<TreeNodeMeta>,
        nodes as Map<string, TreeNode<TreeNodeMeta>>,
      );

      // Generate index for the new token
      const siblings = this.#store.getChildren(parentId);
      const lastIndex =
        siblings.at(-1)?.index ?? generateKeyBetween(null, null);
      const newIndex = generateKeyBetween(lastIndex, null);

      // Create the token override
      const newToken: TreeNode<TreeNodeMeta> = {
        nodeId: crypto.randomUUID(),
        parentId,
        index: newIndex,
        meta: {
          nodeType: "token",
          name: sourceMeta.name,
          description: tokenData.description ?? sourceMeta.description,
          deprecated: tokenData.deprecated ?? sourceMeta.deprecated,
          type: tokenData.type ?? sourceMeta.type,
          value: tokenData.value ?? sourceMeta.value,
        } as TokenMeta,
      };

      tx.set(newToken as TreeNode<Meta>);
      newTokenId = newToken.nodeId;
    });

    return newTokenId!;
  }
}

export const treeState = new TreeState<TreeNodeMeta>();
