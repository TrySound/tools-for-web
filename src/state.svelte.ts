import { createSubscriber } from "svelte/reactivity";
import { TreeStore, type Transaction, type TreeNode } from "./store";
import type { Value } from "./schema";

export type GroupMeta = {
  nodeType: "token-group";
  name: string;
  type?: string;
  description?: string;
  deprecated?: boolean | string;
  extensions?: Record<string, unknown>;
};

export type TokenMeta = Value & {
  nodeType: "token";
  name: string;
  description?: string;
  deprecated?: boolean | string;
  extensions?: Record<string, unknown>;
};

export class TreeState<Meta> {
  #store = new TreeStore<Meta>();
  #subscribe = createSubscriber((update) => this.#store.subscribe(update));

  transact(callback: (tx: Transaction<Meta>) => void): void {
    this.#store.transact(callback);
  }

  values(): TreeNode<Meta>[] {
    this.#subscribe();
    return this.#store.values();
  }

  nodes(): Map<string, TreeNode<Meta>> {
    this.#subscribe();
    return this.#store.nodes();
  }

  getChildren(nodeId: string | undefined): TreeNode<Meta>[] {
    this.#subscribe();
    return this.#store.getChildren(nodeId);
  }
}

export const treeState = new TreeState<GroupMeta | TokenMeta>();
