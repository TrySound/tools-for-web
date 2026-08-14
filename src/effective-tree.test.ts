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
