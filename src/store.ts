export interface Transaction<Meta> {
  set: (node: TreeNode<Meta>) => void;
  delete: (nodeId: string) => void;
  clear: () => void;
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
      clear: (): void => {
        this.#nodes.clear();
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

  getParent(nodeId: string): TreeNode<Meta> | undefined {
    const node = this.#nodes.get(nodeId);
    if (!node?.parentId) {
      return;
    }
    return this.#nodes.get(node.parentId);
  }

  getPrevSibling(nodeId: string): TreeNode<Meta> | undefined {
    const node = this.#nodes.get(nodeId);
    if (!node) {
      return;
    }
    const siblings = this.getChildren(node.parentId);
    const index = siblings.findIndex((n) => n.nodeId === nodeId);
    if (index > 0) {
      return siblings[index - 1];
    }
  }

  getNextSibling(nodeId: string): TreeNode<Meta> | undefined {
    const node = this.#nodes.get(nodeId);
    if (!node) {
      return;
    }
    const siblings = this.getChildren(node.parentId);
    const index = siblings.findIndex((n) => n.nodeId === nodeId);
    if (index >= 0 && index < siblings.length - 1) {
      return siblings[index + 1];
    }
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
