import { test, expect, describe } from "vitest";
import {
  TreeState,
  resolveTokenValue,
  type TokenMeta,
  type TreeNodeMeta,
} from "./state.svelte";
import type { TreeNode } from "./store";
import type { Value } from "./schema";

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

test("getParent should return the parent node", () => {
  const state = new TreeState();
  state.transact((tx) => {
    tx.set({ nodeId: "root", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "child", parentId: "root", index: "a0", meta });
  });
  const parent = state.getParent("child");
  expect(parent?.nodeId).toBe("root");
});

test("getParent should return undefined for root nodes", () => {
  const state = new TreeState();
  state.transact((tx) => {
    tx.set({ nodeId: "root", parentId: undefined, index: "a0", meta });
  });
  const parent = state.getParent("root");
  expect(parent).toBeUndefined();
});

test("getPrevSibling should return the previous sibling", () => {
  const state = new TreeState();
  state.transact((tx) => {
    tx.set({ nodeId: "root", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "child1", parentId: "root", index: "a0", meta });
    tx.set({ nodeId: "child2", parentId: "root", index: "b0", meta });
  });
  const prevSibling = state.getPrevSibling("child2");
  expect(prevSibling?.nodeId).toBe("child1");
});

test("getPrevSibling should return undefined for first child", () => {
  const state = new TreeState();
  state.transact((tx) => {
    tx.set({ nodeId: "root", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "child1", parentId: "root", index: "a0", meta });
  });
  const prevSibling = state.getPrevSibling("child1");
  expect(prevSibling).toBeUndefined();
});

test("getNextSibling should return the next sibling", () => {
  const state = new TreeState();
  state.transact((tx) => {
    tx.set({ nodeId: "root", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "child1", parentId: "root", index: "a0", meta });
    tx.set({ nodeId: "child2", parentId: "root", index: "b0", meta });
  });
  const nextSibling = state.getNextSibling("child1");
  expect(nextSibling?.nodeId).toBe("child2");
});

test("getNextSibling should return undefined for last child", () => {
  const state = new TreeState();
  state.transact((tx) => {
    tx.set({ nodeId: "root", parentId: undefined, index: "a0", meta });
    tx.set({ nodeId: "child1", parentId: "root", index: "a0", meta });
  });
  const nextSibling = state.getNextSibling("child1");
  expect(nextSibling).toBeUndefined();
});

describe("resolveTokenValue", () => {
  const createNodesMap = (
    nodes: TreeNode<TreeNodeMeta>[],
  ): Map<string, TreeNode<TreeNodeMeta>> => {
    const map = new Map<string, TreeNode<TreeNodeMeta>>();
    for (const node of nodes) {
      map.set(node.nodeId, node);
    }
    return map;
  };

  test("should return value directly when token has no extends", () => {
    const token: TokenMeta = {
      nodeType: "token",
      name: "primary",
      type: "color",
      value: { colorSpace: "srgb", components: [1, 0, 0] },
    };
    const nodes = createNodesMap([]);
    expect(resolveTokenValue(token, nodes)).toEqual({
      nodeType: "token",
      name: "primary",
      type: "color",
      value: { colorSpace: "srgb", components: [1, 0, 0] },
    });
  });

  test("should throw error when token has no extends and no value", () => {
    const token: TokenMeta = {
      nodeType: "token",
      name: "broken",
      type: "color",
    };
    const nodes = createNodesMap([]);
    expect(() => resolveTokenValue(token, nodes)).toThrow(
      'Token "broken" has no value to resolve',
    );
  });

  test("should resolve single-level token reference", () => {
    const colorToken: TreeNode<TokenMeta> = {
      nodeId: "node1",
      parentId: "colors-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "primary",
        type: "color",
        value: { colorSpace: "srgb", components: [0, 0, 1] },
      },
    };
    const aliasToken: TokenMeta = {
      nodeType: "token",
      name: "brand",
      type: "color",
      extends: "{colors.primary}",
    };
    const colorsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "colors-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "colors", type: "color" },
    };
    const nodes = createNodesMap([colorToken, colorsGroup]);
    expect(resolveTokenValue(aliasToken, nodes)).toEqual(
      expect.objectContaining({
        name: "primary",
        type: "color",
        value: { colorSpace: "srgb", components: [0, 0, 1] },
      }),
    );
  });

  test("should resolve nested token references", () => {
    const colorToken: TreeNode<TokenMeta> = {
      nodeId: "color-node",
      parentId: "nested-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "accent",
        type: "color",
        value: { colorSpace: "srgb", components: [1, 1, 0] },
      },
    };
    const nestedGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "nested-group",
      parentId: "colors-group",
      index: "a0",
      meta: { nodeType: "token-group", name: "secondary" },
    };
    const colorsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "colors-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "colors", type: "color" },
    };
    const aliasToken: TokenMeta = {
      nodeType: "token",
      name: "highlight",
      type: "color",
      extends: "{colors.secondary.accent}",
    };
    const nodes = createNodesMap([colorToken, nestedGroup, colorsGroup]);
    expect(resolveTokenValue(aliasToken, nodes)).toEqual(
      expect.objectContaining({
        name: "accent",
        type: "color",
        value: { colorSpace: "srgb", components: [1, 1, 0] },
      }),
    );
  });

  test("should handle curly braces in reference correctly", () => {
    const baseToken: TreeNode<TokenMeta> = {
      nodeId: "node1",
      parentId: "base-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "size",
        type: "dimension",
        value: { value: 16, unit: "px" },
      },
    };
    const baseGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "base-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "base" },
    };
    const aliasToken: TokenMeta = {
      nodeType: "token",
      name: "spacing",
      type: "dimension",
      extends: "{base.size}",
    };
    const nodes = createNodesMap([baseToken, baseGroup]);
    expect(resolveTokenValue(aliasToken, nodes)).toEqual(
      expect.objectContaining({
        name: "size",
        value: { value: 16, unit: "px" },
      }),
    );
  });

  test("should resolve chained aliases", () => {
    const originalToken: TreeNode<TokenMeta> = {
      nodeId: "node1",
      parentId: "base-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "original",
        type: "color",
        value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    };
    const baseGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "base-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "base" },
    };
    const intermediateToken: TreeNode<TokenMeta> = {
      nodeId: "intermediate-node",
      parentId: "semantic-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "primary",
        type: "color",
        extends: "{base.original}",
      },
    };
    const semanticGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "semantic-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "semantic" },
    };
    const aliasToken: TokenMeta = {
      nodeType: "token",
      name: "brand",
      type: "color",
      extends: "{semantic.primary}",
    };
    const nodes = createNodesMap([
      originalToken,
      baseGroup,
      intermediateToken,
      semanticGroup,
    ]);
    expect(resolveTokenValue(aliasToken, nodes)).toEqual(
      expect.objectContaining({
        name: "original",
        type: "color",
        value: { colorSpace: "srgb", components: [1, 0, 0] },
      }),
    );
  });

  test("should detect circular references between two tokens", () => {
    const token1: TreeNode<TokenMeta> = {
      nodeId: "node1",
      parentId: "group1",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenA",
        type: "color",
        extends: "{group2.tokenB}",
      },
    };
    const token2: TreeNode<TokenMeta> = {
      nodeId: "node2",
      parentId: "group2",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenB",
        type: "color",
        extends: "{group1.tokenA}",
      },
    };
    const group1: TreeNode<TreeNodeMeta> = {
      nodeId: "group1",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group1" },
    };
    const group2: TreeNode<TreeNodeMeta> = {
      nodeId: "group2",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group2" },
    };
    const nodes = createNodesMap([token1, token2, group1, group2]);
    expect(() =>
      resolveTokenValue(
        {
          nodeType: "token",
          name: "test",
          type: "color",
          extends: "{group1.tokenA}",
        },
        nodes,
      ),
    ).toThrow("Circular reference detected");
  });

  test("should detect self-referencing circular reference", () => {
    const token: TreeNode<TokenMeta> = {
      nodeId: "node1",
      parentId: "group1",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "circular",
        type: "color",
        extends: "{group1.circular}",
      },
    };
    const group1: TreeNode<TreeNodeMeta> = {
      nodeId: "group1",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group1" },
    };
    const nodes = createNodesMap([token, group1]);
    expect(() => resolveTokenValue(token.meta as TokenMeta, nodes)).toThrow(
      "Circular reference detected",
    );
  });

  test("should throw error when reference target not found", () => {
    const group: TreeNode<TreeNodeMeta> = {
      nodeId: "group1",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token-group",
        name: "colors",
      },
    };
    const aliasToken: TokenMeta = {
      nodeType: "token",
      name: "brand",
      type: "color",
      extends: "{colors.nonexistent}",
    };
    const nodes = createNodesMap([group]);
    expect(() => resolveTokenValue(aliasToken, nodes)).toThrow(
      'Final token node not found while resolving "{colors.nonexistent}"',
    );
  });

  test("should throw error when intermediate path not found", () => {
    const token: TokenMeta = {
      nodeType: "token",
      name: "test",
      type: "color",
      extends: "{colors.nested.deep}",
    };
    const nodes = createNodesMap([]);
    expect(() => resolveTokenValue(token, nodes)).toThrow(
      'Final token node not found while resolving "{colors.nested.deep}"',
    );
  });

  test("should throw error for invalid reference format with empty braces", () => {
    const token: TokenMeta = {
      nodeType: "token",
      name: "test",
      type: "color",
      extends: "{}",
    };
    const nodes = createNodesMap([]);
    expect(() => resolveTokenValue(token, nodes)).toThrow(
      'Invalid reference format: "{}"',
    );
  });

  test("should resolve token with multiple nesting levels correctly", () => {
    const deepToken: TreeNode<TokenMeta> = {
      nodeId: "deep-node",
      parentId: "level2-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "final",
        type: "number",
        value: 42,
      },
    };
    const level2Group: TreeNode<TreeNodeMeta> = {
      nodeId: "level2-group",
      parentId: "level1-group",
      index: "a0",
      meta: { nodeType: "token-group", name: "level2" },
    };
    const level1Group: TreeNode<TreeNodeMeta> = {
      nodeId: "level1-group",
      parentId: "root-group",
      index: "a0",
      meta: { nodeType: "token-group", name: "level1" },
    };
    const rootGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "root-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "root" },
    };
    const aliasToken: TokenMeta = {
      nodeType: "token",
      name: "alias",
      type: "number",
      extends: "{root.level1.level2.final}",
    };
    const nodes = createNodesMap([
      deepToken,
      level2Group,
      level1Group,
      rootGroup,
    ]);
    expect(resolveTokenValue(aliasToken, nodes)).toEqual(
      expect.objectContaining({
        name: "final",
        value: 42,
      }),
    );
  });

  test("should preserve token metadata when resolving", () => {
    const sourceToken: TreeNode<TokenMeta> = {
      nodeId: "source-node",
      parentId: "colors-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "primary",
        type: "color",
        value: { colorSpace: "srgb", components: [0, 0, 1] },
        description: "Primary color",
        deprecated: "Use semantic.primary instead",
      },
    };
    const colorsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "colors-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "colors" },
    };
    const aliasToken: TokenMeta = {
      nodeType: "token",
      name: "brand",
      type: "color",
      extends: "{colors.primary}",
    };
    const nodes = createNodesMap([sourceToken, colorsGroup]);
    expect(resolveTokenValue(aliasToken, nodes)).toEqual(
      expect.objectContaining({
        description: "Primary color",
        deprecated: "Use semantic.primary instead",
      }),
    );
  });

  test("should resolve various token types", () => {
    const testCases: Array<{
      name: string;
      value: unknown;
      type: Value["type"];
    }> = [
      {
        name: "dimension",
        value: { value: 16, unit: "px" },
        type: "dimension",
      },
      {
        name: "duration",
        value: { value: 300, unit: "ms" },
        type: "duration",
      },
      { name: "number", value: 42, type: "number" },
      { name: "fontFamily", value: "Arial, sans-serif", type: "fontFamily" },
      { name: "fontWeight", value: 600, type: "fontWeight" },
    ];
    for (const testCase of testCases) {
      const sourceToken: TreeNode<TokenMeta> = {
        nodeId: "source-node",
        parentId: "base-group",
        index: "a0",
        meta: {
          nodeType: "token",
          name: testCase.name,
          type: testCase.type,
          value: testCase.value,
        },
      };
      const baseGroup: TreeNode<TreeNodeMeta> = {
        nodeId: "base-group",
        parentId: undefined,
        index: "a0",
        meta: {
          nodeType: "token-group",
          name: "base",
        },
      };
      const aliasToken: TokenMeta = {
        nodeType: "token",
        name: "alias",
        type: testCase.type,
        extends: `{base.${testCase.name}}`,
      };
      const nodes = createNodesMap([sourceToken, baseGroup]);
      expect(resolveTokenValue(aliasToken, nodes)).toEqual(
        expect.objectContaining({
          value: testCase.value,
        }),
      );
    }
  });
});
