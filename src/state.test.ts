import { test, expect } from "vitest";
import { TreeState } from "./state.svelte";

const meta = undefined;

test("should work as a regular tree store", () => {
  const state = new TreeState();
  state.transact((tx) => {
    tx.set({ nodeId: "node1", parentId: undefined, index: "", meta });
  });
  const nodes = state.values();
  expect(nodes).toHaveLength(1);
  expect(nodes[0].nodeId).toBe("node1");
});

test("should support multiple operations", () => {
  const state = new TreeState();
  state.transact((tx) => {
    tx.set({ nodeId: "root", parentId: undefined, index: "", meta });
    tx.set({ nodeId: "child1", parentId: "root", index: "", meta });
    tx.set({ nodeId: "child2", parentId: "root", index: "", meta });
  });
  const children = state.getChildren("root");
  expect(children).toHaveLength(2);
  state.transact((tx) => {
    tx.delete("child1");
  });
  expect(state.getChildren("root")).toHaveLength(1);
});

test("should maintain tree structure", () => {
  const state = new TreeState();
  state.transact((tx) => {
    tx.set({ nodeId: "root", parentId: undefined, index: "", meta });
    tx.set({ nodeId: "parent1", parentId: "root", index: "", meta });
    tx.set({ nodeId: "child1", parentId: "parent1", index: "", meta });
  });
  const allNodes = state.values();
  expect(allNodes).toHaveLength(3);
  const parent1Children = state.getChildren("parent1");
  expect(parent1Children).toHaveLength(1);
  expect(parent1Children[0].nodeId).toBe("child1");
});

test("should auto-generate indices", () => {
  const state = new TreeState();
  state.transact((tx) => {
    tx.set({ nodeId: "node1", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "node2", parentId: undefined, index: "b0", meta });
  });
  const children = state.getChildren(undefined);
  expect(children[0].index).toBe("a0");
  expect(children[0].index < children[1].index).toBe(true);
});

test("should support explicit indices", () => {
  const state = new TreeState();
  state.transact((tx) => {
    tx.set({ nodeId: "node1", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "node2", parentId: undefined, index: "z0", meta });
  });
  const children = state.getChildren(undefined);
  expect(children[0].index).toBe("a0");
  expect(children[1].index).toBe("z0");
});

test("should update existing nodes", () => {
  const state = new TreeState();
  state.transact((tx) => {
    tx.set({ nodeId: "node1", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "node1", parentId: "parent1", index: "b0", meta });
  });
  const nodes = state.values();
  expect(nodes).toHaveLength(1);
  expect(nodes[0].parentId).toBe("parent1");
  expect(nodes[0].index).toBe("b0");
});

test("should return nodes as Map", () => {
  const state = new TreeState();
  state.transact((tx) => {
    tx.set({ nodeId: "node1", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "node2", parentId: "node1", index: "a0", meta });
  });
  const nodesMap = state.nodes();
  expect(nodesMap).toBeInstanceOf(Map);
  expect(nodesMap.size).toBe(2);
  expect(nodesMap.has("node1")).toBe(true);
  expect(nodesMap.has("node2")).toBe(true);
  expect(nodesMap.get("node1")?.nodeId).toBe("node1");
  expect(nodesMap.get("node2")?.parentId).toBe("node1");
});
