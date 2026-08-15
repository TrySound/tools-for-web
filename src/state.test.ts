import { test, expect, describe } from "vitest";
import {
  TreeState,
  resolveTokenValue,
  resolveRawValue,
  isAliasCircular,
  isGroupExtensionCircular,
  type TokenMeta,
  type TreeNodeMeta,
} from "./state.svelte";
import type { TreeNode } from "./store";
import type { RawValue } from "./schema";

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

  test("should return value directly when token has no reference value", () => {
    const token: TreeNode<TokenMeta> = {
      nodeId: "node1",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "primary",
        type: "color",
        value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    };
    const nodes = createNodesMap([]);
    expect(resolveTokenValue(token, nodes)).toEqual({
      type: "color",
      value: { colorSpace: "srgb", components: [1, 0, 0] },
    });
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
    const aliasToken: TreeNode<TokenMeta> = {
      nodeId: "alias-node",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "brand",
        type: "color",
        value: { ref: "node1" },
      },
    };
    const colorsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "colors-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "colors", type: "color" },
    };
    const nodes = createNodesMap([colorToken, colorsGroup]);
    expect(resolveTokenValue(aliasToken, nodes)).toEqual({
      type: "color",
      value: { colorSpace: "srgb", components: [0, 0, 1] },
    });
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
    const aliasToken: TreeNode<TokenMeta> = {
      nodeId: "alias-node",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "highlight",
        type: "color",
        value: { ref: "color-node" },
      },
    };
    const nodes = createNodesMap([colorToken, nestedGroup, colorsGroup]);
    expect(resolveTokenValue(aliasToken, nodes)).toEqual({
      type: "color",
      value: { colorSpace: "srgb", components: [1, 1, 0] },
    });
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
    const aliasToken: TreeNode<TokenMeta> = {
      nodeId: "alias-node",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "spacing",
        type: "dimension",
        value: { ref: "node1" },
      },
    };
    const nodes = createNodesMap([baseToken, baseGroup]);
    expect(resolveTokenValue(aliasToken, nodes)).toEqual({
      type: "dimension",
      value: { value: 16, unit: "px" },
    });
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
        value: { ref: "node1" },
      },
    };
    const semanticGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "semantic-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "semantic" },
    };
    const aliasToken: TreeNode<TokenMeta> = {
      nodeId: "alias-node",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "brand",
        type: "color",
        value: { ref: "intermediate-node" },
      },
    };
    const nodes = createNodesMap([
      originalToken,
      baseGroup,
      intermediateToken,
      semanticGroup,
    ]);
    expect(resolveTokenValue(aliasToken, nodes)).toEqual({
      type: "color",
      value: { colorSpace: "srgb", components: [1, 0, 0] },
    });
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
        value: { ref: "node2" },
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
        value: { ref: "node1" },
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
    const testToken: TreeNode<TokenMeta> = {
      nodeId: "test-node",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "test",
        type: "color",
        value: { ref: "node1" },
      },
    };
    expect(() => resolveTokenValue(testToken, nodes)).toThrow(
      "Circular reference detected",
    );
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
        value: { ref: "node1" },
      },
    };
    const group1: TreeNode<TreeNodeMeta> = {
      nodeId: "group1",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group1" },
    };
    const nodes = createNodesMap([token, group1]);
    expect(() => resolveTokenValue(token, nodes)).toThrow(
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
    const aliasToken: TreeNode<TokenMeta> = {
      nodeId: "alias-node",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "brand",
        type: "color",
        value: { ref: "not-existing" },
      },
    };
    const nodes = createNodesMap([group]);
    expect(() => resolveTokenValue(aliasToken, nodes)).toThrow(
      'Token node not found while resolving nodeId "not-existing"',
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
    const aliasToken: TreeNode<TokenMeta> = {
      nodeId: "alias-node",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "alias",
        type: "number",
        value: { ref: "deep-node" },
      },
    };
    const nodes = createNodesMap([
      deepToken,
      level2Group,
      level1Group,
      rootGroup,
    ]);
    expect(resolveTokenValue(aliasToken, nodes)).toEqual({
      type: "number",
      value: 42,
    });
  });

  test("should resolve various token types", () => {
    const testCases: Array<
      {
        name: string;
      } & RawValue
    > = [
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
        nodeId: testCase.name,
        parentId: "base-group",
        index: "a0",
        meta: { nodeType: "token", ...testCase },
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
      const aliasToken: TreeNode<TokenMeta> = {
        nodeId: "alias-node",
        parentId: undefined,
        index: "a0",
        meta: {
          nodeType: "token",
          name: "alias",
          type: testCase.type,
          value: { ref: testCase.name },
        },
      };
      const nodes = createNodesMap([sourceToken, baseGroup]);
      expect(resolveTokenValue(aliasToken, nodes)).toEqual(
        expect.objectContaining({
          value: testCase.value,
        }),
      );
    }
  });

  test("should resolve type from parent group when token has no explicit type", () => {
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
    const colorsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "colors-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "colors", type: "color" },
    };
    const aliasToken: TreeNode<TokenMeta> = {
      nodeId: "alias-node",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "brand",
        type: "color",
        value: { ref: "node1" },
      },
    };
    const nodes = createNodesMap([colorToken, colorsGroup]);
    expect(resolveTokenValue(aliasToken, nodes)).toEqual({
      type: "color",
      value: { colorSpace: "srgb", components: [0, 0, 1] },
    });
  });

  test("should resolve type from extended token when no parent group type", () => {
    const baseToken: TreeNode<TokenMeta> = {
      nodeId: "base-node",
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
    const aliasToken: TreeNode<TokenMeta> = {
      nodeId: "alias-node",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "spacing",
        type: "dimension",
        value: { ref: "base-node" },
      },
    };
    const nodes = createNodesMap([baseToken, baseGroup]);
    expect(resolveTokenValue(aliasToken, nodes)).toEqual({
      type: "dimension",
      value: { value: 16, unit: "px" },
    });
  });

  test("should resolve type through chained aliases", () => {
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
        value: { ref: "node1" },
      },
    };
    const semanticGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "semantic-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "semantic" },
    };
    const aliasToken: TreeNode<TokenMeta> = {
      nodeId: "alias-node",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "brand",
        type: "color",
        value: { ref: "intermediate-node" },
      },
    };
    const nodes = createNodesMap([
      originalToken,
      baseGroup,
      intermediateToken,
      semanticGroup,
    ]);
    expect(resolveTokenValue(aliasToken, nodes)).toEqual({
      type: "color",
      value: { colorSpace: "srgb", components: [1, 0, 0] },
    });
  });

  test("should resolve number token with 0", () => {
    const token: TreeNode<TokenMeta> = {
      nodeId: "node1",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "original",
        type: "number",
        value: 0,
      },
    };
    const nodes = createNodesMap([token]);
    expect(resolveTokenValue(token, nodes)).toEqual({
      type: "number",
      value: 0,
    });
  });

  test("should resolve shadow with component aliases", () => {
    const colorToken: TreeNode<TokenMeta> = {
      nodeId: "color-node",
      parentId: "colors-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "black",
        type: "color",
        value: { colorSpace: "srgb", components: [0, 0, 0, 0.2] },
      },
    };
    const colorsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "colors-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "colors" },
    };
    const spacingToken: TreeNode<TokenMeta> = {
      nodeId: "spacing-node",
      parentId: "spacing-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "md",
        type: "dimension",
        value: { value: 4, unit: "px" },
      },
    };
    const spacingGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "spacing-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "spacing" },
    };
    const shadowToken: TreeNode<TokenMeta> = {
      nodeId: "shadow-node",
      parentId: "shadows-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "primary",
        type: "shadow",
        value: [
          {
            color: { ref: "color-node" },
            offsetX: { ref: "spacing-node" },
            offsetY: { ref: "spacing-node" },
            blur: { value: 8, unit: "px" },
            spread: { value: 0, unit: "px" },
            inset: false,
          },
        ],
      },
    };
    const shadowsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "shadows-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "shadows" },
    };
    const nodes = createNodesMap([
      colorToken,
      colorsGroup,
      spacingToken,
      spacingGroup,
      shadowToken,
      shadowsGroup,
    ]);
    const resolved = resolveTokenValue(shadowToken, nodes);
    expect(resolved).toEqual({
      type: "shadow",
      value: [
        {
          color: { colorSpace: "srgb", components: [0, 0, 0, 0.2] },
          offsetX: { value: 4, unit: "px" },
          offsetY: { value: 4, unit: "px" },
          blur: { value: 8, unit: "px" },
          spread: { value: 0, unit: "px" },
          inset: false,
        },
      ],
    });
  });

  test("should resolve border with component aliases", () => {
    const colorToken: TreeNode<TokenMeta> = {
      nodeId: "color-node",
      parentId: "colors-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "gray",
        type: "color",
        value: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
      },
    };
    const colorsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "colors-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "colors" },
    };
    const spacingToken: TreeNode<TokenMeta> = {
      nodeId: "spacing-node",
      parentId: "spacing-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "sm",
        type: "dimension",
        value: { value: 1, unit: "px" },
      },
    };
    const spacingGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "spacing-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "spacing" },
    };
    const borderToken: TreeNode<TokenMeta> = {
      nodeId: "border-node",
      parentId: "borders-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "default",
        type: "border",
        value: {
          color: { ref: "color-node" },
          width: { ref: "spacing-node" },
          style: "solid",
        },
      },
    };
    const bordersGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "borders-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "borders" },
    };
    const nodes = createNodesMap([
      colorToken,
      colorsGroup,
      spacingToken,
      spacingGroup,
      borderToken,
      bordersGroup,
    ]);
    const resolved = resolveTokenValue(borderToken, nodes);
    expect(resolved.type).toBe("border");
    const borderValue = resolved.value as {
      color: { colorSpace: string; components: number[] };
      width: { value: number; unit: string };
      style: string;
    };
    expect(borderValue.color).toEqual({
      colorSpace: "srgb",
      components: [0.5, 0.5, 0.5],
    });
    expect(borderValue.width).toEqual({ value: 1, unit: "px" });
    expect(borderValue.style).toBe("solid");
  });

  test("should resolve typography with component aliases", () => {
    const fontToken: TreeNode<TokenMeta> = {
      nodeId: "font-node",
      parentId: "fonts-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "body",
        type: "fontFamily",
        value: "sans-serif",
      },
    };
    const fontsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "fonts-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "fonts" },
    };
    const spacingToken: TreeNode<TokenMeta> = {
      nodeId: "spacing-node",
      parentId: "spacing-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "md",
        type: "dimension",
        value: { value: 16, unit: "px" },
      },
    };
    const spacingGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "spacing-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "spacing" },
    };
    const typographyToken: TreeNode<TokenMeta> = {
      nodeId: "typography-node",
      parentId: "typography-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "base",
        type: "typography",
        value: {
          fontFamily: { ref: "font-node" },
          fontSize: { ref: "spacing-node" },
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: { value: 0, unit: "px" },
        },
      },
    };
    const typographyGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "typography-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "typography" },
    };
    const nodes = createNodesMap([
      fontToken,
      fontsGroup,
      spacingToken,
      spacingGroup,
      typographyToken,
      typographyGroup,
    ]);
    const resolved = resolveTokenValue(typographyToken, nodes);
    expect(resolved.type).toBe("typography");
    const typographyValue = resolved.value as {
      fontFamily: string;
      fontSize: { value: number; unit: string };
      fontWeight: number;
      lineHeight: number;
      letterSpacing: { value: number; unit: string };
    };
    expect(typographyValue.fontFamily).toBe("sans-serif");
    expect(typographyValue.fontSize).toEqual({ value: 16, unit: "px" });
    expect(typographyValue.fontWeight).toBe(400);
    expect(typographyValue.lineHeight).toBe(1.5);
  });

  test("should resolve transition with component aliases", () => {
    const durationToken: TreeNode<TokenMeta> = {
      nodeId: "duration-node",
      parentId: "durations-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "quick",
        type: "duration",
        value: { value: 300, unit: "ms" },
      },
    };
    const durationsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "durations-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "durations" },
    };
    const easingToken: TreeNode<TokenMeta> = {
      nodeId: "easing-node",
      parentId: "easing-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "ease",
        type: "cubicBezier",
        value: [0.25, 0.1, 0.25, 1],
      },
    };
    const easingGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "easing-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "easing" },
    };
    const delayToken: TreeNode<TokenMeta> = {
      nodeId: "delay-node",
      parentId: "durations-group",
      index: "a1",
      meta: {
        nodeType: "token",
        name: "slowDelay",
        type: "duration",
        value: { value: 100, unit: "ms" },
      },
    };
    const transitionToken: TreeNode<TokenMeta> = {
      nodeId: "transition-node",
      parentId: "transitions-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "smooth",
        type: "transition",
        value: {
          duration: { ref: "duration-node" },
          delay: { ref: "delay-node" },
          timingFunction: { ref: "easing-node" },
        },
      },
    };
    const transitionsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "transitions-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "transitions" },
    };
    const nodes = createNodesMap([
      durationToken,
      durationsGroup,
      easingToken,
      easingGroup,
      delayToken,
      transitionToken,
      transitionsGroup,
    ]);
    expect(resolveTokenValue(transitionToken, nodes)).toEqual({
      type: "transition",
      value: {
        duration: { value: 300, unit: "ms" },
        delay: { value: 100, unit: "ms" },
        timingFunction: [0.25, 0.1, 0.25, 1],
      },
    });
  });

  test("should resolve gradient with component aliases", () => {
    const redToken: TreeNode<TokenMeta> = {
      nodeId: "red-node",
      parentId: "colors-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "red",
        type: "color",
        value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    };
    const blueToken: TreeNode<TokenMeta> = {
      nodeId: "blue-node",
      parentId: "colors-group",
      index: "a1",
      meta: {
        nodeType: "token",
        name: "blue",
        type: "color",
        value: { colorSpace: "srgb", components: [0, 0, 1] },
      },
    };
    const colorsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "colors-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "colors" },
    };
    const gradientToken: TreeNode<TokenMeta> = {
      nodeId: "gradient-node",
      parentId: "gradients-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "redToBlue",
        type: "gradient",
        value: [
          {
            color: { ref: "red-node" },
            position: 0,
          },
          {
            color: { ref: "blue-node" },
            position: 1,
          },
        ],
      },
    };
    const gradientsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "gradients-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "gradients" },
    };
    const nodes = createNodesMap([
      redToken,
      blueToken,
      colorsGroup,
      gradientToken,
      gradientsGroup,
    ]);
    const resolved = resolveTokenValue(gradientToken, nodes);
    expect(resolved.type).toBe("gradient");
    const gradientValue = resolved.value as Array<{
      color: { colorSpace: string; components: number[] };
      position: number;
    }>;
    expect(Array.isArray(gradientValue)).toBe(true);
    expect(gradientValue[0].color).toEqual({
      colorSpace: "srgb",
      components: [1, 0, 0],
    });
    expect(gradientValue[1].color).toEqual({
      colorSpace: "srgb",
      components: [0, 0, 1],
    });
  });
});

describe("isAliasCircular", () => {
  const createNodesMap = (
    nodes: TreeNode<TreeNodeMeta>[],
  ): Map<string, TreeNode<TreeNodeMeta>> => {
    const map = new Map<string, TreeNode<TreeNodeMeta>>();
    for (const node of nodes) {
      map.set(node.nodeId, node);
    }
    return map;
  };

  test("should return false when target has no reference value", () => {
    const sourceToken: TreeNode<TokenMeta> = {
      nodeId: "source-node",
      parentId: "group1",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "source",
        type: "color",
        value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    };
    const targetToken: TreeNode<TokenMeta> = {
      nodeId: "target-node",
      parentId: "group2",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "target",
        type: "color",
        value: { colorSpace: "srgb", components: [0, 1, 0] },
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
    const nodes = createNodesMap([sourceToken, targetToken, group1, group2]);
    expect(isAliasCircular("source-node", "target-node", nodes)).toBe(false);
  });

  test("should detect direct self-reference", () => {
    const token: TreeNode<TokenMeta> = {
      nodeId: "token-node",
      parentId: "group1",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "circular",
        type: "color",
        value: { ref: "token-node" },
      },
    };
    const group1: TreeNode<TreeNodeMeta> = {
      nodeId: "group1",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group1" },
    };
    const nodes = createNodesMap([token, group1]);
    expect(isAliasCircular("token-node", "token-node", nodes)).toBe(true);
  });

  test("should detect two-token circular reference", () => {
    const tokenA: TreeNode<TokenMeta> = {
      nodeId: "token-a",
      parentId: "group1",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenA",
        type: "color",
        value: { ref: "token-b" },
      },
    };
    const tokenB: TreeNode<TokenMeta> = {
      nodeId: "token-b",
      parentId: "group2",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenB",
        type: "color",
        value: { ref: "token-a" },
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
    const nodes = createNodesMap([tokenA, tokenB, group1, group2]);
    expect(isAliasCircular("token-a", "token-b", nodes)).toBe(true);
  });

  test("should detect three-token circular reference", () => {
    const tokenA: TreeNode<TokenMeta> = {
      nodeId: "token-a",
      parentId: "group1",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenA",
        type: "color",
        value: { ref: "token-b" },
      },
    };
    const tokenB: TreeNode<TokenMeta> = {
      nodeId: "token-b",
      parentId: "group2",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenB",
        type: "color",
        value: { ref: "token-c" },
      },
    };
    const tokenC: TreeNode<TokenMeta> = {
      nodeId: "token-c",
      parentId: "group3",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenC",
        type: "color",
        value: { ref: "token-a" },
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
    const group3: TreeNode<TreeNodeMeta> = {
      nodeId: "group3",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group3" },
    };
    const nodes = createNodesMap([
      tokenA,
      tokenB,
      tokenC,
      group1,
      group2,
      group3,
    ]);
    expect(isAliasCircular("token-a", "token-c", nodes)).toBe(true);
  });

  test("should return false for safe chain that doesn't loop back", () => {
    const tokenA: TreeNode<TokenMeta> = {
      nodeId: "token-a",
      parentId: "group1",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenA",
        type: "color",
        value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    };
    const tokenB: TreeNode<TokenMeta> = {
      nodeId: "token-b",
      parentId: "group2",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenB",
        type: "color",
        value: { ref: "token-a" },
      },
    };
    const tokenC: TreeNode<TokenMeta> = {
      nodeId: "token-c",
      parentId: "group3",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenC",
        type: "color",
        value: { colorSpace: "srgb", components: [0, 0, 1] },
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
    const group3: TreeNode<TreeNodeMeta> = {
      nodeId: "group3",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group3" },
    };
    const nodes = createNodesMap([
      tokenA,
      tokenB,
      tokenC,
      group1,
      group2,
      group3,
    ]);
    expect(isAliasCircular("token-c", "token-b", nodes)).toBe(false);
  });

  test("should return false when target is not a token", () => {
    const token: TreeNode<TokenMeta> = {
      nodeId: "token-a",
      parentId: "group1",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenA",
        type: "color",
        value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    };
    const group1: TreeNode<TreeNodeMeta> = {
      nodeId: "group1",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group1" },
    };
    const nodes = createNodesMap([token, group1]);
    expect(isAliasCircular("token-a", "group1", nodes)).toBe(false);
  });

  test("should return false when target does not exist", () => {
    const token: TreeNode<TokenMeta> = {
      nodeId: "token-a",
      parentId: "group1",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenA",
        type: "color",
        value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    };
    const group1: TreeNode<TreeNodeMeta> = {
      nodeId: "group1",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group1" },
    };
    const nodes = createNodesMap([token, group1]);
    expect(isAliasCircular("token-a", "nonexistent", nodes)).toBe(false);
  });

  test("should detect circular reference with nested groups", () => {
    const tokenA: TreeNode<TokenMeta> = {
      nodeId: "token-a",
      parentId: "nested-group1",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenA",
        type: "color",
        value: { ref: "token-b" },
      },
    };
    const tokenB: TreeNode<TokenMeta> = {
      nodeId: "token-b",
      parentId: "group2",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenB",
        type: "color",
        value: { ref: "token-a" },
      },
    };
    const group1: TreeNode<TreeNodeMeta> = {
      nodeId: "group1",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group1" },
    };
    const nestedGroup1: TreeNode<TreeNodeMeta> = {
      nodeId: "nested-group1",
      parentId: "group1",
      index: "a0",
      meta: { nodeType: "token-group", name: "nested" },
    };
    const group2: TreeNode<TreeNodeMeta> = {
      nodeId: "group2",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group2" },
    };
    const nodes = createNodesMap([
      tokenA,
      tokenB,
      group1,
      nestedGroup1,
      group2,
    ]);
    expect(isAliasCircular("token-a", "token-b", nodes)).toBe(true);
  });

  test("should detect circular reference requiring multiple traversals", () => {
    // Setup: token-a -> token-b -> token-c
    // We want to check if setting token-a to reference token-d would be safe
    // where token-d -> token-e -> token-b (which eventually leads back to token-a)
    //
    // The traversal path is: token-d -> token-e -> token-b -> token-c
    // We need to check if "token-a" appears in that chain
    //
    // Actually, let's set it up so:
    // token-b -> token-c -> token-a (exists)
    // Check: Would setting token-a to reference token-d cause a cycle?
    // where token-d -> token-e -> token-b
    // The traversal is: token-d -> token-e -> token-b -> token-c -> token-a (found!)

    const tokenA: TreeNode<TokenMeta> = {
      nodeId: "token-a",
      parentId: "group1",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenA",
        type: "color",
        value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    };
    const tokenB: TreeNode<TokenMeta> = {
      nodeId: "token-b",
      parentId: "group1",
      index: "a1",
      meta: {
        nodeType: "token",
        name: "tokenB",
        type: "color",
        value: { ref: "token-c" },
      },
    };
    const tokenC: TreeNode<TokenMeta> = {
      nodeId: "token-c",
      parentId: "group1",
      index: "a2",
      meta: {
        nodeType: "token",
        name: "tokenC",
        type: "color",
        value: { ref: "token-a" },
      },
    };
    const tokenD: TreeNode<TokenMeta> = {
      nodeId: "token-d",
      parentId: "group1",
      index: "a3",
      meta: {
        nodeType: "token",
        name: "tokenD",
        type: "color",
        value: { ref: "token-e" },
      },
    };
    const tokenE: TreeNode<TokenMeta> = {
      nodeId: "token-e",
      parentId: "group1",
      index: "a4",
      meta: {
        nodeType: "token",
        name: "tokenE",
        type: "color",
        value: { ref: "token-b" },
      },
    };
    const group1: TreeNode<TreeNodeMeta> = {
      nodeId: "group1",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group1" },
    };
    const nodes = createNodesMap([
      tokenA,
      tokenB,
      tokenC,
      tokenD,
      tokenE,
      group1,
    ]);

    // Check if setting token-a to reference token-d would create a cycle
    // Path to check: token-d -> token-e -> token-b -> token-c -> token-a (FOUND!)
    // This requires traversing 4 references to detect the cycle
    expect(isAliasCircular("token-a", "token-d", nodes)).toBe(true);
  });
});

describe("isGroupExtensionCircular", () => {
  test("detects when a group extension chain reaches the current group", () => {
    const nodes = new Map<string, TreeNode<TreeNodeMeta>>([
      [
        "base",
        {
          nodeId: "base",
          parentId: undefined,
          index: "a0",
          meta: { nodeType: "token-group", name: "base" },
        },
      ],
      [
        "middle",
        {
          nodeId: "middle",
          parentId: undefined,
          index: "a1",
          meta: {
            nodeType: "token-group",
            name: "middle",
            extends: { ref: "base" },
          },
        },
      ],
    ]);

    expect(isGroupExtensionCircular("base", "middle", nodes)).toBe(true);
  });

  test("allows a group extension chain that does not reach the current group", () => {
    const nodes = new Map<string, TreeNode<TreeNodeMeta>>([
      [
        "base",
        {
          nodeId: "base",
          parentId: undefined,
          index: "a0",
          meta: { nodeType: "token-group", name: "base" },
        },
      ],
      [
        "other",
        {
          nodeId: "other",
          parentId: undefined,
          index: "a1",
          meta: { nodeType: "token-group", name: "other" },
        },
      ],
    ]);

    expect(isGroupExtensionCircular("base", "other", nodes)).toBe(false);
  });
});

describe("resolveRawValue", () => {
  const createNodesMap = (
    nodes: TreeNode<TreeNodeMeta>[],
  ): Map<string, TreeNode<TreeNodeMeta>> => {
    const map = new Map<string, TreeNode<TreeNodeMeta>>();
    for (const node of nodes) {
      map.set(node.nodeId, node);
    }
    return map;
  };

  test("should return value directly for primitive tokens without references", () => {
    const token: TreeNode<TokenMeta> = {
      nodeId: "node1",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "primary",
        type: "color",
        value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    };
    const nodes = createNodesMap([]);
    const resolved = resolveRawValue(token, nodes);
    expect(resolved).toEqual({
      type: "color",
      value: { colorSpace: "srgb", components: [1, 0, 0] },
    });
  });

  test("should resolve token reference to primitive token", () => {
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
    const aliasToken: TreeNode<TokenMeta> = {
      nodeId: "alias-node",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "brand",
        type: "color",
        value: { ref: "node1" },
      },
    };
    const colorsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "colors-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "colors", type: "color" },
    };
    const nodes = createNodesMap([colorToken, colorsGroup]);
    expect(resolveRawValue(aliasToken, nodes)).toEqual({
      type: "color",
      value: { colorSpace: "srgb", components: [0, 0, 1] },
    });
  });

  test("should return composite token with unresolved component references", () => {
    const colorToken: TreeNode<TokenMeta> = {
      nodeId: "color-node",
      parentId: "colors-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "black",
        type: "color",
        value: { colorSpace: "srgb", components: [0, 0, 0, 0.2] },
      },
    };
    const colorsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "colors-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "colors" },
    };
    const spacingToken: TreeNode<TokenMeta> = {
      nodeId: "spacing-node",
      parentId: "spacing-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "md",
        type: "dimension",
        value: { value: 4, unit: "px" },
      },
    };
    const spacingGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "spacing-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "spacing" },
    };
    const shadowToken: TreeNode<TokenMeta> = {
      nodeId: "shadow-node",
      parentId: "shadows-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "primary",
        type: "shadow",
        value: [
          {
            color: { ref: "color-node" },
            offsetX: { ref: "spacing-node" },
            offsetY: { ref: "spacing-node" },
            blur: { value: 8, unit: "px" },
            spread: { value: 0, unit: "px" },
            inset: false,
          },
        ],
      },
    };
    const shadowsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "shadows-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "shadows" },
    };
    const nodes = createNodesMap([
      colorToken,
      colorsGroup,
      spacingToken,
      spacingGroup,
      shadowToken,
      shadowsGroup,
    ]);
    const resolved = resolveRawValue(shadowToken, nodes);
    expect(resolved.type).toBe("shadow");
    const shadowValue = resolved.value as Array<{
      color: { ref: string } | { colorSpace: string; components: number[] };
      offsetX: { ref: string } | { value: number; unit: string };
      offsetY: { ref: string } | { value: number; unit: string };
      blur: { value: number; unit: string };
      spread: { value: number; unit: string };
      inset: boolean;
    }>;
    // Component references should be unresolved (as NodeRef)
    expect(shadowValue[0].color).toEqual({ ref: "color-node" });
    expect(shadowValue[0].offsetX).toEqual({ ref: "spacing-node" });
    expect(shadowValue[0].offsetY).toEqual({ ref: "spacing-node" });
    // Direct values should remain as-is
    expect(shadowValue[0].blur).toEqual({ value: 8, unit: "px" });
    expect(shadowValue[0].spread).toEqual({ value: 0, unit: "px" });
  });

  test("should resolve alias to composite token and return it with unresolved references", () => {
    const colorToken: TreeNode<TokenMeta> = {
      nodeId: "color-node",
      parentId: "colors-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "gray",
        type: "color",
        value: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
      },
    };
    const colorsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "colors-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "colors" },
    };
    const spacingToken: TreeNode<TokenMeta> = {
      nodeId: "spacing-node",
      parentId: "spacing-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "sm",
        type: "dimension",
        value: { value: 1, unit: "px" },
      },
    };
    const spacingGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "spacing-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "spacing" },
    };
    const borderToken: TreeNode<TokenMeta> = {
      nodeId: "border-node",
      parentId: "borders-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "default",
        type: "border",
        value: {
          color: { ref: "color-node" },
          width: { ref: "spacing-node" },
          style: "solid",
        },
      },
    };
    const bordersGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "borders-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "borders" },
    };
    const aliasBorderToken: TreeNode<TokenMeta> = {
      nodeId: "alias-border-node",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "primaryBorder",
        type: "border",
        value: { ref: "border-node" },
      },
    };
    const nodes = createNodesMap([
      colorToken,
      colorsGroup,
      spacingToken,
      spacingGroup,
      borderToken,
      bordersGroup,
      aliasBorderToken,
    ]);
    const resolved = resolveRawValue(aliasBorderToken, nodes);
    expect(resolved.type).toBe("border");
    const borderValue = resolved.value as {
      color: { ref: string } | { colorSpace: string; components: number[] };
      width: { ref: string } | { value: number; unit: string };
      style: string;
    };
    // Component references should be unresolved
    expect(borderValue.color).toEqual({ ref: "color-node" });
    expect(borderValue.width).toEqual({ ref: "spacing-node" });
    expect(borderValue.style).toBe("solid");
  });

  test("should compare raw vs deep resolution for composite tokens", () => {
    const colorToken: TreeNode<TokenMeta> = {
      nodeId: "color-node",
      parentId: "colors-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "black",
        type: "color",
        value: { colorSpace: "srgb", components: [0, 0, 0, 0.2] },
      },
    };
    const colorsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "colors-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "colors" },
    };
    const spacingToken: TreeNode<TokenMeta> = {
      nodeId: "spacing-node",
      parentId: "spacing-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "md",
        type: "dimension",
        value: { value: 4, unit: "px" },
      },
    };
    const spacingGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "spacing-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "spacing" },
    };
    const shadowToken: TreeNode<TokenMeta> = {
      nodeId: "shadow-node",
      parentId: "shadows-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "primary",
        type: "shadow",
        value: [
          {
            color: { ref: "color-node" },
            offsetX: { ref: "spacing-node" },
            offsetY: { ref: "spacing-node" },
            blur: { value: 8, unit: "px" },
            spread: { value: 0, unit: "px" },
            inset: false,
          },
        ],
      },
    };
    const shadowsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "shadows-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "shadows" },
    };
    const nodes = createNodesMap([
      colorToken,
      colorsGroup,
      spacingToken,
      spacingGroup,
      shadowToken,
      shadowsGroup,
    ]);

    // Deep resolution (resolveTokenValue) should resolve all references
    const deepResolved = resolveTokenValue(shadowToken, nodes);
    const deepShadowValue = deepResolved.value as Array<{
      color: { colorSpace: string; components: number[] };
      offsetX: { value: number; unit: string };
      offsetY: { value: number; unit: string };
      blur: { value: number; unit: string };
      spread: { value: number; unit: string };
      inset: boolean;
    }>;
    expect(deepShadowValue[0].color).toEqual({
      colorSpace: "srgb",
      components: [0, 0, 0, 0.2],
    });
    expect(deepShadowValue[0].offsetX).toEqual({ value: 4, unit: "px" });

    // Shallow resolution should NOT resolve component refs
    const rawValue = resolveRawValue(shadowToken, nodes);
    const rawShadowValue = rawValue.value as Array<{
      color: { ref: string };
      offsetX: { ref: string };
      offsetY: { ref: string };
      blur: { value: number; unit: string };
      spread: { value: number; unit: string };
      inset: boolean;
    }>;
    expect(rawShadowValue[0].color).toEqual({ ref: "color-node" });
    expect(rawShadowValue[0].offsetX).toEqual({ ref: "spacing-node" });
  });

  test("should detect circular reference with self-referencing token", () => {
    const token: TreeNode<TokenMeta> = {
      nodeId: "node1",
      parentId: "group1",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "circular",
        type: "color",
        value: { ref: "node1" },
      },
    };
    const group1: TreeNode<TreeNodeMeta> = {
      nodeId: "group1",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group1" },
    };
    const nodes = createNodesMap([token, group1]);
    expect(() => resolveRawValue(token, nodes)).toThrow(
      "Circular reference detected",
    );
  });

  test("should detect circular reference between two tokens", () => {
    const token1: TreeNode<TokenMeta> = {
      nodeId: "node1",
      parentId: "group1",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenA",
        type: "color",
        value: { ref: "node2" },
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
        value: { ref: "node1" },
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
    const testToken: TreeNode<TokenMeta> = {
      nodeId: "test-node",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "test",
        type: "color",
        value: { ref: "node1" },
      },
    };
    expect(() => resolveRawValue(testToken, nodes)).toThrow(
      "Circular reference detected",
    );
  });

  test("should detect circular reference in chained aliases", () => {
    const tokenA: TreeNode<TokenMeta> = {
      nodeId: "token-a",
      parentId: "group1",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "tokenA",
        type: "color",
        value: { ref: "token-b" },
      },
    };
    const tokenB: TreeNode<TokenMeta> = {
      nodeId: "token-b",
      parentId: "group1",
      index: "a1",
      meta: {
        nodeType: "token",
        name: "tokenB",
        type: "color",
        value: { ref: "token-c" },
      },
    };
    const tokenC: TreeNode<TokenMeta> = {
      nodeId: "token-c",
      parentId: "group1",
      index: "a2",
      meta: {
        nodeType: "token",
        name: "tokenC",
        type: "color",
        value: { ref: "token-a" },
      },
    };
    const group1: TreeNode<TreeNodeMeta> = {
      nodeId: "group1",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group1" },
    };
    const nodes = createNodesMap([tokenA, tokenB, tokenC, group1]);
    expect(() => resolveRawValue(tokenA, nodes)).toThrow(
      "Circular reference detected",
    );
  });

  test("should detect circular reference that includes composite token", () => {
    const colorToken: TreeNode<TokenMeta> = {
      nodeId: "color-node",
      parentId: "colors-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "primary",
        type: "color",
        value: { ref: "alias-shadow" },
      },
    };
    const colorsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "colors-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "colors" },
    };
    const shadowToken: TreeNode<TokenMeta> = {
      nodeId: "shadow-node",
      parentId: "shadows-group",
      index: "a0",
      meta: {
        nodeType: "token",
        name: "shadow",
        type: "shadow",
        value: [
          {
            color: { colorSpace: "srgb", components: [0, 0, 0] },
            offsetX: { value: 1, unit: "px" },
            offsetY: { value: 1, unit: "px" },
            blur: { value: 1, unit: "px" },
            spread: { value: 1, unit: "px" },
            inset: false,
          },
        ],
      },
    };
    const shadowsGroup: TreeNode<TreeNodeMeta> = {
      nodeId: "shadows-group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "shadows" },
    };
    const aliasShadow: TreeNode<TokenMeta> = {
      nodeId: "alias-shadow",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "aliasShadow",
        type: "shadow",
        value: { ref: "color-node" },
      },
    };
    const nodes = createNodesMap([
      colorToken,
      colorsGroup,
      shadowToken,
      shadowsGroup,
      aliasShadow,
    ]);
    expect(() => resolveRawValue(colorToken, nodes)).toThrow(
      "Circular reference detected",
    );
  });
});
