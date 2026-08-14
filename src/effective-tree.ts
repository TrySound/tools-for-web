import { compareTreeNodes, type TreeNode } from "./store";
import type { TreeNodeMeta } from "./state.svelte";

export type EffectiveTreeNode = {
  node: TreeNode<TreeNodeMeta>;
  children: EffectiveTreeNode[];
};

export const createEffectiveTree = (
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): EffectiveTreeNode[] => {
  const childrenByParent = new Map<
    string | undefined,
    TreeNode<TreeNodeMeta>[]
  >();
  for (const node of nodes.values()) {
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }
  for (const children of childrenByParent.values()) {
    children.sort(compareTreeNodes);
  }

  const resolvedGroups = new Map<string, EffectiveTreeNode>();

  const mergeChildren = (
    inherited: EffectiveTreeNode[],
    local: EffectiveTreeNode[],
  ): EffectiveTreeNode[] => {
    const merged = [...inherited];
    for (const localChild of local) {
      const inheritedIndex = merged.findIndex(
        (child) => child.node.meta.name === localChild.node.meta.name,
      );
      if (inheritedIndex === -1) {
        merged.push(localChild);
        continue;
      }

      const inheritedChild = merged[inheritedIndex];
      if (
        inheritedChild.node.meta.nodeType === "token-group" &&
        localChild.node.meta.nodeType === "token-group"
      ) {
        merged[inheritedIndex] = {
          node: localChild.node,
          children: mergeChildren(inheritedChild.children, localChild.children),
        };
      } else {
        merged[inheritedIndex] = localChild;
      }
    }
    return merged;
  };

  const buildNode = (
    node: TreeNode<TreeNodeMeta>,
    extensionStack: TreeNode<TreeNodeMeta>[] = [],
  ): EffectiveTreeNode => {
    if (node.meta.nodeType !== "token-group") {
      return {
        node,
        children: (childrenByParent.get(node.nodeId) ?? []).map((child) =>
          buildNode(child, extensionStack),
        ),
      };
    }

    const cached = resolvedGroups.get(node.nodeId);
    if (cached) return cached;

    const cycleIndex = extensionStack.findIndex(
      (group) => group.nodeId === node.nodeId,
    );
    if (cycleIndex !== -1) {
      const cycle = [...extensionStack.slice(cycleIndex), node]
        .map((group) => group.meta.name)
        .join(" -> ");
      throw new Error(`Circular group extension detected: ${cycle}`);
    }

    const nextStack = [...extensionStack, node];
    let inheritedChildren: EffectiveTreeNode[] = [];
    if (node.meta.extends) {
      const target = nodes.get(node.meta.extends.ref);
      if (!target) {
        throw new Error(
          `Group "${node.meta.name}" extension target "${node.meta.extends.ref}" not found`,
        );
      }
      if (target.meta.nodeType !== "token-group") {
        throw new Error(
          `Group "${node.meta.name}" cannot extend ${target.meta.nodeType} "${target.meta.name}"`,
        );
      }
      inheritedChildren = buildNode(target, nextStack).children;
    }

    const localChildren = (childrenByParent.get(node.nodeId) ?? []).map(
      (child) => buildNode(child, nextStack),
    );
    const effectiveNode = {
      node,
      children: mergeChildren(inheritedChildren, localChildren),
    };
    resolvedGroups.set(node.nodeId, effectiveNode);
    return effectiveNode;
  };

  for (const node of nodes.values()) {
    if (node.meta.nodeType === "token-group" && node.meta.extends) {
      buildNode(node);
    }
  }

  return (childrenByParent.get(undefined) ?? []).map((node) => buildNode(node));
};
