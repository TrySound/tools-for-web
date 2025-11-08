export interface Transaction<Meta> {
  set: (node: TreeNode<Meta>) => void;
  delete: (nodeId: string) => void;
}

export interface TreeNode<Meta> {
  nodeId: string;
  parentId: string | undefined;
  index: string;
  meta: Meta;
}

export const compareTreeNodes = <Meta>(
  a: TreeNode<Meta>,
  b: TreeNode<Meta>,
) => {
  if (a.index < b.index) {
    return -1;
  }
  if (a.index > b.index) {
    return 1;
  }
  return 0;
};

export class TreeStore<Meta> {
  #nodes = new Map<string, TreeNode<Meta>>();
  #subscribers = new Set<() => void>();

  transact(callback: (tx: Transaction<Meta>) => void): void {
    callback({
      set: (node) => {
        this.#nodes.set(node.nodeId, node);
      },
      delete: (nodeId): void => {
        this.#nodes.delete(nodeId);
      },
    });
    this.#notify();
  }

  values(): TreeNode<Meta>[] {
    return Array.from(this.#nodes.values());
  }

  nodes(): Map<string, TreeNode<Meta>> {
    return new Map(this.#nodes);
  }

  getChildren(nodeId: string | undefined): TreeNode<Meta>[] {
    return Array.from(this.#nodes.values())
      .filter((node) => node.parentId === nodeId)
      .sort(compareTreeNodes);
  }

  subscribe(callback: () => void): () => void {
    this.#subscribers.add(callback);
    return () => {
      this.#subscribers.delete(callback);
    };
  }

  #notify(): void {
    this.#subscribers.forEach((callback) => callback());
  }
}
