import { test, expect } from "vitest";
import { TreeStore } from "./store";

const meta = undefined;

test("should add a node with auto-generated index", () => {
  const store = new TreeStore();
  store.transact((tx) => {
    tx.set({
      nodeId: "node1",
      parentId: undefined,
      index: "a0",
      meta: undefined,
    });
  });
  const nodes = store.values();
  expect(nodes).toHaveLength(1);
  expect(nodes[0].nodeId).toBe("node1");
  expect(nodes[0].parentId).toBeUndefined();
  expect(nodes[0].index).toBe("a0");
});

test("should add multiple nodes and sort by index", () => {
  const store = new TreeStore<undefined>();
  store.transact((tx) => {
    tx.set({ nodeId: "node1", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "node2", parentId: undefined, index: "b0", meta });
    tx.set({ nodeId: "node3", parentId: undefined, index: "c0", meta });
  });
  const nodes = store.values();
  expect(nodes).toHaveLength(3);
  // Verify order by index
  const children = store.getChildren(undefined);
  expect(children[0].nodeId).toBe("node1");
  expect(children[1].nodeId).toBe("node2");
  expect(children[2].nodeId).toBe("node3");
  // Verify indices are in correct order
  expect(children[0].index < children[1].index).toBe(true);
  expect(children[1].index < children[2].index).toBe(true);
});

test("should add nodes with specific indices", () => {
  const store = new TreeStore();
  store.transact((tx) => {
    tx.set({ nodeId: "node1", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "node2", parentId: undefined, index: "z0", meta });
  });
  const children = store.getChildren(undefined);
  expect(children[0].index).toBe("a0");
  expect(children[1].index).toBe("z0");
});

test("should support hierarchical nodes", () => {
  const store = new TreeStore();
  store.transact((tx) => {
    tx.set({ nodeId: "root", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "child1", parentId: "root", index: "a0", meta });
    tx.set({ nodeId: "child2", parentId: "root", index: "b0", meta });
  });
  const rootChildren = store.getChildren("root");
  expect(rootChildren).toHaveLength(2);
  expect(rootChildren.every((n) => n.parentId === "root")).toBe(true);
  const otherChildren = store.getChildren("other");
  expect(otherChildren).toHaveLength(0);
});

test("should delete nodes", () => {
  const store = new TreeStore();
  store.transact((tx) => {
    tx.set({ nodeId: "node1", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "node2", parentId: undefined, index: "b0", meta });
  });
  expect(store.values()).toHaveLength(2);
  store.transact((tx) => {
    tx.delete("node1");
  });
  const nodes = store.values();
  expect(nodes).toHaveLength(1);
  expect(nodes[0].nodeId).toBe("node2");
});

test("should update existing node", () => {
  const store = new TreeStore();
  store.transact((tx) => {
    tx.set({ nodeId: "node1", parentId: undefined, index: "a0", meta });
  });
  store.transact((tx) => {
    tx.set({ nodeId: "node1", parentId: "parent1", index: "b0", meta });
  });
  const nodes = store.values();
  expect(nodes).toHaveLength(1);
  expect(nodes[0].parentId).toBe("parent1");
  expect(nodes[0].index).toBe("b0");
});

test("should return values() correctly", () => {
  const store = new TreeStore();
  store.transact((tx) => {
    tx.set({ nodeId: "node1", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "node2", parentId: "node1", index: "a0", meta });
    tx.set({ nodeId: "node3", parentId: "node1", index: "b0", meta });
  });
  const values = store.values();
  expect(values).toHaveLength(3);
  expect(values.map((n) => n.nodeId).sort()).toEqual([
    "node1",
    "node2",
    "node3",
  ]);
});

test("should maintain fractional indices for proper ordering", () => {
  const store = new TreeStore();
  store.transact((tx) => {
    tx.set({ nodeId: "node2", parentId: undefined, index: "b0", meta });
    tx.set({ nodeId: "node1", parentId: undefined, index: "a0", meta });
  });
  const children = store.getChildren(undefined);
  expect(children[0].index < children[1].index).toBe(true);
});

test("should handle nested hierarchies", () => {
  const store = new TreeStore();
  store.transact((tx) => {
    tx.set({ nodeId: "root", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "parent1", parentId: "root", index: "a0", meta });
    tx.set({ nodeId: "child1", parentId: "parent1", index: "a0", meta });
    tx.set({ nodeId: "child2", parentId: "parent1", index: "b0", meta });
  });
  const rootChildren = store.getChildren("root");
  expect(rootChildren).toHaveLength(1);
  const parent1Children = store.getChildren("parent1");
  expect(parent1Children).toHaveLength(2);
  const allNodes = store.values();
  expect(allNodes).toHaveLength(4);
});

test("should notify subscribers only once per transaction", () => {
  const store = new TreeStore();
  let notifyCount = 0;
  store.subscribe(() => {
    notifyCount++;
  });
  store.transact((tx) => {
    tx.set({ nodeId: "node1", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "node2", parentId: undefined, index: "b0", meta });
    tx.set({ nodeId: "node3", parentId: undefined, index: "c0", meta });
  });
  // Should notify only once after the transaction completes
  expect(notifyCount).toBe(1);
});

test("should return nodes as Map", () => {
  const store = new TreeStore();
  store.transact((tx) => {
    tx.set({ nodeId: "node1", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "node2", parentId: "node1", index: "a0", meta });
    tx.set({ nodeId: "node3", parentId: "node1", index: "b0", meta });
  });
  const nodesMap = store.nodes();
  expect(nodesMap).toBeInstanceOf(Map);
  expect(nodesMap.size).toBe(3);
  expect(nodesMap.has("node1")).toBe(true);
  expect(nodesMap.has("node2")).toBe(true);
  expect(nodesMap.has("node3")).toBe(true);
  expect(nodesMap.get("node1")?.nodeId).toBe("node1");
  expect(nodesMap.get("node2")?.parentId).toBe("node1");
});

test("nodes() should return a copy of the internal map", () => {
  const store = new TreeStore();
  store.transact((tx) => {
    tx.set({ nodeId: "node1", parentId: undefined, index: "a0", meta });
  });
  const nodesMap1 = store.nodes();
  const nodesMap2 = store.nodes();
  // Should be different Map instances
  expect(nodesMap1).not.toBe(nodesMap2);
  // But have the same content
  expect(nodesMap1.size).toBe(nodesMap2.size);
  expect(nodesMap1.get("node1")).toEqual(nodesMap2.get("node1"));
});
