import { createSubscriber } from "svelte/reactivity";
import { TreeStore, type Transaction, type TreeNode } from "./store";
import type { Value } from "./schema";
import { serializeDesignTokens } from "./tokens";
import { setDataInUrl } from "./url-data";

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
  type?: Value["type"];
  value?: unknown;
  extends?: string;
  description?: string;
  deprecated?: boolean | string;
  extensions?: Record<string, unknown>;
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
export function resolveTokenValue(
  token: TokenMeta,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
  resolvingStack: Set<string> = new Set(),
): Value {
  // stop early with existing value
  if (!token.extends) {
    if (token.value) {
      return token as Value;
    }
    throw new Error(`Token "${token.name}" has no value to resolve`);
  }
  const extendsRef = token.extends;
  // check for circular references
  if (resolvingStack.has(extendsRef)) {
    throw new Error(
      `Circular reference detected: ${Array.from(resolvingStack).join(" -> ")} -> ${extendsRef}`,
    );
  }
  // extract token path from "group.token" or "group.nested.token"
  const segments = extendsRef.replace(/[{}]/g, "").split(".").filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`Invalid reference format: "${extendsRef}"`);
  }
  const nodesList = Array.from(nodes.values());
  let currentNodeId: string | undefined;
  // navigate through remaining segments
  for (const segment of segments) {
    // find child with matching name
    const nextNode = nodesList.find(
      (n) => n.parentId === currentNodeId && n.meta.name === segment,
    );
    currentNodeId = nextNode?.nodeId;
  }
  // final token node
  const tokenNode = currentNodeId ? nodes.get(currentNodeId) : undefined;
  if (tokenNode?.meta.nodeType !== "token") {
    throw new Error(
      `Final token node not found while resolving "${extendsRef}"`,
    );
  }
  // resolve token further if has extends too
  const newStack = new Set(resolvingStack);
  newStack.add(extendsRef);
  return resolveTokenValue(tokenNode.meta, nodes, newStack);
}

export type TreeNodeMeta = GroupMeta | TokenMeta;

export class TreeState<Meta> {
  #store = new TreeStore<Meta>();
  #subscribe = createSubscriber((update) => this.#store.subscribe(update));
  #syncToUrl: boolean = false;

  transact(callback: (tx: Transaction<Meta>) => void): void {
    this.#store.transact(callback);
    // Sync to URL after transaction completes
    if (this.#syncToUrl) {
      this.#updateUrl();
    }
  }

  enableUrlSync(): void {
    this.#syncToUrl = true;
  }

  #updateUrl(): void {
    const allNodes = this.#store.nodes() as Map<string, TreeNode<TreeNodeMeta>>;
    const serialized = serializeDesignTokens(allNodes);
    setDataInUrl(serialized).catch((error) => {
      console.error("Failed to sync design tokens to URL:", error);
    });
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
}

export const treeState = new TreeState<TreeNodeMeta>();
