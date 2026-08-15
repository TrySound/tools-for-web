import { describe, expect, test } from "vitest";
import { createEffectiveTree, type EffectiveTreeNode } from "./effective-tree";
import type { TreeNode } from "./store";
import type { TreeNodeMeta } from "./state.svelte";
import { parseDesignTokens } from "./tokens";

const nodesToMap = (nodes: TreeNode<TreeNodeMeta>[]) =>
  new Map(nodes.map((node) => [node.nodeId, node]));

const childNamed = (node: EffectiveTreeNode, name: string) => {
  const child = node.children.find((item) => item.node.meta.name === name);
  if (!child) throw new Error(`Expected child "${name}"`);
  return child;
};

const rootNamed = (roots: EffectiveTreeNode[], name: string) => {
  const root = roots.find((item) => item.node.meta.name === name);
  if (!root) throw new Error(`Expected root "${name}"`);
  return root;
};

describe("createEffectiveTree", () => {
  test("assigns distinct paths when one group is inherited by multiple groups", () => {
    const parsed = parseDesignTokens({
      base: { alias: { $type: "number", $value: 1 } },
      first: { $extends: "{base}" },
      second: { $extends: "{base}" },
    });

    const roots = createEffectiveTree(nodesToMap(parsed.nodes));

    expect(childNamed(rootNamed(roots, "base"), "alias").path).toEqual([
      "base",
      "alias",
    ]);
    expect(childNamed(rootNamed(roots, "first"), "alias").path).toEqual([
      "first",
      "alias",
    ]);
    expect(childNamed(rootNamed(roots, "second"), "alias").path).toEqual([
      "second",
      "alias",
    ]);
  });

  test("recursively includes inherited tokens and nested groups", () => {
    const parsed = parseDesignTokens({
      base: {
        direct: { $type: "number", $value: 1 },
        nested: { deep: { $type: "number", $value: 2 } },
      },
      derived: { $extends: "{base}" },
    });

    const roots = createEffectiveTree(nodesToMap(parsed.nodes));
    const derived = rootNamed(roots, "derived");

    expect(childNamed(derived, "direct").node.meta.nodeType).toBe("token");
    expect(
      childNamed(childNamed(derived, "nested"), "deep").node.meta.nodeType,
    ).toBe("token");
  });

  test("replaces an inherited token completely with a local same-name token", () => {
    const parsed = parseDesignTokens({
      base: {
        value: {
          $type: "number",
          $value: 1,
          $description: "inherited",
        },
      },
      derived: {
        $extends: "{base}",
        value: { $type: "number", $value: 2 },
      },
    });

    const derived = rootNamed(
      createEffectiveTree(nodesToMap(parsed.nodes)),
      "derived",
    );
    const value = childNamed(derived, "value").node;

    expect(value.meta).toMatchObject({
      nodeType: "token",
      name: "value",
      value: 2,
    });
    expect(value.meta.description).toBeUndefined();
  });

  test("recursively overlays local same-name groups", () => {
    const parsed = parseDesignTokens({
      base: {
        nested: {
          inherited: { $type: "number", $value: 1 },
          replaced: { $type: "number", $value: 2 },
        },
      },
      derived: {
        $extends: "{base}",
        nested: {
          replaced: { $type: "number", $value: 3 },
          local: { $type: "number", $value: 4 },
        },
      },
    });

    const derived = rootNamed(
      createEffectiveTree(nodesToMap(parsed.nodes)),
      "derived",
    );
    const nested = childNamed(derived, "nested");

    expect(nested.children.map((item) => item.node.meta.name)).toEqual([
      "inherited",
      "replaced",
      "local",
    ]);
    expect(childNamed(nested, "replaced").node.meta).toMatchObject({
      value: 3,
    });
  });

  test("resolves multi-level group extensions", () => {
    const parsed = parseDesignTokens({
      base: { baseToken: { $type: "number", $value: 1 } },
      middle: {
        $extends: "{base}",
        middleToken: { $type: "number", $value: 2 },
      },
      leaf: {
        $extends: "{middle}",
        leafToken: { $type: "number", $value: 3 },
      },
    });

    const leaf = rootNamed(
      createEffectiveTree(nodesToMap(parsed.nodes)),
      "leaf",
    );

    expect(leaf.children.map((item) => item.node.meta.name)).toEqual([
      "baseToken",
      "middleToken",
      "leafToken",
    ]);
  });

  test("resolves an inherited nested group's own extension before overlay", () => {
    const parsed = parseDesignTokens({
      shared: { sharedToken: { $type: "number", $value: 1 } },
      base: {
        nested: {
          $extends: "{shared}",
          baseToken: { $type: "number", $value: 2 },
        },
      },
      derived: {
        $extends: "{base}",
        nested: { localToken: { $type: "number", $value: 3 } },
      },
    });

    const nested = childNamed(
      rootNamed(createEffectiveTree(nodesToMap(parsed.nodes)), "derived"),
      "nested",
    );

    expect(nested.children.map((item) => item.node.meta.name)).toEqual([
      "sharedToken",
      "baseToken",
      "localToken",
    ]);
    expect(nested.children.map((item) => item.path)).toEqual([
      ["derived", "nested", "sharedToken"],
      ["derived", "nested", "baseToken"],
      ["derived", "nested", "localToken"],
    ]);
  });

  test("does not mutate authored nodes, parents, or references", () => {
    const parsed = parseDesignTokens({
      target: { $type: "number", $value: 1 },
      base: { alias: { $type: "number", $value: "{target}" } },
      derived: { $extends: "{base}" },
    });
    const nodes = nodesToMap(parsed.nodes);
    const before = structuredClone(parsed.nodes);

    createEffectiveTree(nodes);

    expect(parsed.nodes).toEqual(before);
  });

  test("throws clearly when an extension target is missing", () => {
    const group: TreeNode<TreeNodeMeta> = {
      nodeId: "group",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token-group",
        name: "group",
        extends: { ref: "missing" },
      },
    };

    expect(() => createEffectiveTree(new Map([[group.nodeId, group]]))).toThrow(
      'Group "group" extension target "missing" not found',
    );
  });

  test("throws clearly when an extension target is not a group", () => {
    const token: TreeNode<TreeNodeMeta> = {
      nodeId: "token",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token", name: "token", type: "number", value: 1 },
    };
    const group: TreeNode<TreeNodeMeta> = {
      nodeId: "group",
      parentId: undefined,
      index: "a1",
      meta: {
        nodeType: "token-group",
        name: "group",
        extends: { ref: token.nodeId },
      },
    };

    expect(() =>
      createEffectiveTree(
        new Map([
          [token.nodeId, token],
          [group.nodeId, group],
        ]),
      ),
    ).toThrow('Group "group" cannot extend token "token"');
  });

  test("rejects duplicate names in a local authored sibling layer", () => {
    const group: TreeNode<TreeNodeMeta> = {
      nodeId: "group",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "group" },
    };
    const first: TreeNode<TreeNodeMeta> = {
      nodeId: "first",
      parentId: group.nodeId,
      index: "a0",
      meta: { nodeType: "token", name: "value", type: "number", value: 1 },
    };
    const second: TreeNode<TreeNodeMeta> = {
      nodeId: "second",
      parentId: group.nodeId,
      index: "a1",
      meta: { nodeType: "token", name: "value", type: "number", value: 2 },
    };

    expect(() =>
      createEffectiveTree(
        new Map([
          [group.nodeId, group],
          [first.nodeId, first],
          [second.nodeId, second],
        ]),
      ),
    ).toThrow('Duplicate sibling name "value" under group "group"');
  });

  test("rejects duplicate names in an inherited authored sibling layer", () => {
    const base: TreeNode<TreeNodeMeta> = {
      nodeId: "base",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-group", name: "base" },
    };
    const derived: TreeNode<TreeNodeMeta> = {
      nodeId: "derived",
      parentId: undefined,
      index: "a1",
      meta: {
        nodeType: "token-group",
        name: "derived",
        extends: { ref: base.nodeId },
      },
    };
    const first: TreeNode<TreeNodeMeta> = {
      nodeId: "first",
      parentId: base.nodeId,
      index: "a0",
      meta: { nodeType: "token", name: "value", type: "number", value: 1 },
    };
    const second: TreeNode<TreeNodeMeta> = {
      nodeId: "second",
      parentId: base.nodeId,
      index: "a1",
      meta: { nodeType: "token", name: "value", type: "number", value: 2 },
    };

    expect(() =>
      createEffectiveTree(
        new Map([
          [base.nodeId, base],
          [derived.nodeId, derived],
          [first.nodeId, first],
          [second.nodeId, second],
        ]),
      ),
    ).toThrow('Duplicate sibling name "value" under group "base"');
  });

  test("allows the same child name in isolated modifier contexts", () => {
    const modifier: TreeNode<TreeNodeMeta> = {
      nodeId: "modifier",
      parentId: undefined,
      index: "a0",
      meta: { nodeType: "token-modifier", name: "theme" },
    };
    const light: TreeNode<TreeNodeMeta> = {
      nodeId: "light",
      parentId: modifier.nodeId,
      index: "a0",
      meta: { nodeType: "token-context", name: "light" },
    };
    const dark: TreeNode<TreeNodeMeta> = {
      nodeId: "dark",
      parentId: modifier.nodeId,
      index: "a1",
      meta: { nodeType: "token-context", name: "dark" },
    };
    const lightToken: TreeNode<TreeNodeMeta> = {
      nodeId: "light-token",
      parentId: light.nodeId,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "background",
        type: "number",
        value: 1,
      },
    };
    const darkToken: TreeNode<TreeNodeMeta> = {
      nodeId: "dark-token",
      parentId: dark.nodeId,
      index: "a0",
      meta: {
        nodeType: "token",
        name: "background",
        type: "number",
        value: 2,
      },
    };

    expect(() =>
      createEffectiveTree(
        new Map([
          [modifier.nodeId, modifier],
          [light.nodeId, light],
          [dark.nodeId, dark],
          [lightToken.nodeId, lightToken],
          [darkToken.nodeId, darkToken],
        ]),
      ),
    ).not.toThrow();
  });

  test("throws clearly when extensions form a cycle", () => {
    const first: TreeNode<TreeNodeMeta> = {
      nodeId: "first",
      parentId: undefined,
      index: "a0",
      meta: {
        nodeType: "token-group",
        name: "first",
        extends: { ref: "second" },
      },
    };
    const second: TreeNode<TreeNodeMeta> = {
      nodeId: "second",
      parentId: undefined,
      index: "a1",
      meta: {
        nodeType: "token-group",
        name: "second",
        extends: { ref: "first" },
      },
    };

    expect(() =>
      createEffectiveTree(
        new Map([
          [first.nodeId, first],
          [second.nodeId, second],
        ]),
      ),
    ).toThrow("Circular group extension detected: first -> second -> first");
  });
});
