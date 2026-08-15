import { compareTreeNodes, type TreeNode } from "./store";
import type { TreeNodeMeta } from "./state.svelte";

export type EffectiveTreeNode = {
  node: TreeNode<TreeNodeMeta>;
  path: string[];
  children: EffectiveTreeNode[];
};

type ResolvedTreeNode = {
  node: TreeNode<TreeNodeMeta>;
  children: ResolvedTreeNode[];
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

  const getAuthoredPath = (node: TreeNode<TreeNodeMeta>): string => {
    const path = [node.meta.name];
    let parentId = node.parentId;
    while (parentId) {
      const parent = nodes.get(parentId);
      if (!parent) break;
      path.unshift(parent.meta.name);
      parentId = parent.parentId;
    }
    return path.join(".");
  };

  for (const [parentId, children] of childrenByParent) {
    const names = new Set<string>();
    for (const child of children) {
      if (names.has(child.meta.name)) {
        if (!parentId) {
          throw new Error(
            `Duplicate sibling name "${child.meta.name}" at root`,
          );
        }
        const parent = nodes.get(parentId);
        const parentType =
          parent?.meta.nodeType === "token-group"
            ? "group"
            : (parent?.meta.nodeType ?? "node");
        const parentPath = parent ? getAuthoredPath(parent) : parentId;
        throw new Error(
          `Duplicate sibling name "${child.meta.name}" under ${parentType} "${parentPath}"`,
        );
      }
      names.add(child.meta.name);
    }
  }

  const resolvedGroups = new Map<string, ResolvedTreeNode>();

  const mergeChildren = (
    inherited: ResolvedTreeNode[],
    local: ResolvedTreeNode[],
  ): ResolvedTreeNode[] => {
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
  ): ResolvedTreeNode => {
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
    let inheritedChildren: ResolvedTreeNode[] = [];
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

  const addOccurrencePaths = (
    resolvedNode: ResolvedTreeNode,
    parentPath: string[],
  ): EffectiveTreeNode => {
    const { node } = resolvedNode;
    const path =
      node.meta.nodeType === "token-group" || node.meta.nodeType === "token"
        ? [...parentPath, node.meta.name]
        : parentPath;
    return {
      node,
      path,
      children: resolvedNode.children.map((child) =>
        addOccurrencePaths(child, path),
      ),
    };
  };

  return (childrenByParent.get(undefined) ?? []).map((node) =>
    addOccurrencePaths(buildNode(node), []),
  );
};
