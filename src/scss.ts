import { kebabCase, noCase } from "change-case";
import { serializeColor } from "./color";
import {
  toCubicBezierValue,
  toDimensionValue,
  toDurationValue,
  toFontFamilyValue,
  toStrokeStyleValue,
} from "./css-variables";
import { createEffectiveTree, type EffectiveTreeNode } from "./effective-tree";
import {
  isNodeRef,
  type NodeRef,
  type RawBorderValue,
  type RawGradientValue,
  type RawShadowValue,
  type RawTransitionValue,
  type RawTypographyValue,
  type StrokeStyleValue,
} from "./schema";
import type { TreeNode } from "./store";
import type { TreeNodeMeta } from "./state.svelte";

const referenceToVariable = (
  nodeRef: NodeRef,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): string => {
  const path: string[] = [];
  let currentId: string | undefined = nodeRef.ref;
  while (currentId) {
    const node = nodes.get(currentId);
    // token set is the root of the tree
    if (!node || node.meta.nodeType === "token-set") {
      break;
    }
    path.unshift(node.meta.name);
    currentId = node.parentId;
  }
  // Convert to kebab-case and create SCSS variable
  return `$${kebabCase(noCase(path.join("-")))}`;
};

/**
 * Convert a value or reference to a string or nested var()
 */
const valueOrVariable = <T>(
  value: T | NodeRef,
  converter: (v: T) => string,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): string => {
  if (isNodeRef(value)) {
    return referenceToVariable(value, nodes);
  }
  return converter(value as T);
};

const toShadowValue = (
  value: RawShadowValue,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const shadows = Array.isArray(value) ? value : [value];
  const shadowStrings = shadows.map((shadow) => {
    const color = valueOrVariable(shadow.color, serializeColor, nodes);
    const inset = shadow.inset ? "inset " : "";
    const offsetX = valueOrVariable(shadow.offsetX, toDimensionValue, nodes);
    const offsetY = valueOrVariable(shadow.offsetY, toDimensionValue, nodes);
    const blur = valueOrVariable(shadow.blur, toDimensionValue, nodes);
    const spread = valueOrVariable(shadow.spread, toDimensionValue, nodes);
    return `${inset}${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
  });
  return shadowStrings.join(", ");
};

const toGradientValue = (
  value: RawGradientValue,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const stops = value.map((stop) => {
    const color = valueOrVariable(stop.color, serializeColor, nodes);
    return `${color} ${stop.position * 100}%`;
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
};

const toBorderValue = (
  value: RawBorderValue,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const style = valueOrVariable(value.style, toStrokeStyleValue, nodes);
  const width = valueOrVariable(value.width, toDimensionValue, nodes);
  const color = valueOrVariable(value.color, serializeColor, nodes);
  return `${width} ${style} ${color}`;
};

const toTransitionValue = (
  value: RawTransitionValue,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const duration = valueOrVariable(value.duration, toDurationValue, nodes);
  const timingFunction = valueOrVariable(
    value.timingFunction,
    toCubicBezierValue,
    nodes,
  );
  const delay = valueOrVariable(value.delay, toDurationValue, nodes);
  return `${duration} ${timingFunction} ${delay}`;
};

const addStrokeStyle = (
  variableName: string,
  value: StrokeStyleValue | NodeRef,
  lines: string[],
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  if (isNodeRef(value)) {
    lines.push(`${variableName}: ${referenceToVariable(value, nodes)};`);
    return;
  }
  if (typeof value === "string") {
    lines.push(`${variableName}: ${value};`);
  } else {
    const dashArray = value.dashArray
      .map((d) => valueOrVariable(d, toDimensionValue, nodes))
      .join(", ");
    lines.push(`${variableName}-dash-array: ${dashArray};`);
    lines.push(`${variableName}-line-cap: ${value.lineCap};`);
  }
};

const addTypography = (
  variableName: string,
  value: RawTypographyValue,
  lines: string[],
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const fontFamily = valueOrVariable(
    value.fontFamily,
    toFontFamilyValue,
    nodes,
  );
  const fontSize = valueOrVariable(value.fontSize, toDimensionValue, nodes);
  const letterSpacing = valueOrVariable(
    value.letterSpacing,
    toDimensionValue,
    nodes,
  );
  const fontWeight = valueOrVariable(value.fontWeight, (v) => `${v}`, nodes);
  const lineHeight = valueOrVariable(value.lineHeight, (v) => `${v}`, nodes);
  lines.push(`${variableName}-font-family: ${fontFamily};`);
  lines.push(`${variableName}-font-size: ${fontSize};`);
  lines.push(`${variableName}-font-weight: ${fontWeight};`);
  lines.push(`${variableName}-line-height: ${lineHeight};`);
  lines.push(`${variableName}-letter-spacing: ${letterSpacing};`);
  lines.push(
    `${variableName}: ${fontWeight} ${fontSize}/${lineHeight} ${fontFamily};`,
  );
};

const processNode = (
  effectiveNode: EffectiveTreeNode,
  path: string[],
  lines: string[],
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const { children, node } = effectiveNode;
  // token-modifier and token-context nodes and their entire subtrees should be skipped
  if (
    node.meta.nodeType === "token-modifier" ||
    node.meta.nodeType === "token-context"
  ) {
    return;
  }

  // token-set is intended for grouping globals
  // and should be omitted in generated variables, but its children are processed
  if (node.meta.nodeType === "token-set") {
    for (const child of children) {
      processNode(child, path, lines, nodes);
    }
    return;
  }

  // group is only added to variable name
  if (node.meta.nodeType === "token-group") {
    for (const child of children) {
      processNode(child, [...path, node.meta.name], lines, nodes);
    }
  }

  if (node.meta.nodeType === "token") {
    const token = node.meta;
    const variableName = `$${kebabCase(noCase([...path, node.meta.name].join("-")))}`;
    // Handle token aliases (references to other tokens)
    if (isNodeRef(token.value)) {
      const variable = referenceToVariable(token.value, nodes);
      lines.push(`${variableName}: ${variable};`);
      return;
    }
    switch (token.type) {
      case "color":
        lines.push(`${variableName}: ${serializeColor(token.value)};`);
        break;
      case "dimension":
        lines.push(`${variableName}: ${toDimensionValue(token.value)};`);
        break;
      case "duration":
        lines.push(`${variableName}: ${toDurationValue(token.value)};`);
        break;
      case "cubicBezier":
        lines.push(`${variableName}: ${toCubicBezierValue(token.value)};`);
        break;
      case "number":
      case "fontWeight":
        lines.push(`${variableName}: ${token.value};`);
        break;
      case "fontFamily":
        lines.push(`${variableName}: ${toFontFamilyValue(token.value)};`);
        break;
      case "shadow":
        lines.push(`${variableName}: ${toShadowValue(token.value, nodes)};`);
        break;
      case "gradient":
        lines.push(`${variableName}: ${toGradientValue(token.value, nodes)};`);
        break;
      case "border":
        lines.push(`${variableName}: ${toBorderValue(token.value, nodes)};`);
        break;
      case "transition":
        lines.push(
          `${variableName}: ${toTransitionValue(token.value, nodes)};`,
        );
        break;
      case "strokeStyle":
        addStrokeStyle(variableName, token.value, lines, nodes);
        break;
      case "typography":
        addTypography(variableName, token.value, lines, nodes);
        break;
      default:
        token satisfies never;
        break;
    }
  }
};

export const generateScssVariables = (
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): string => {
  const lines: string[] = [];
  // render scss variables
  for (const node of createEffectiveTree(nodes)) {
    processNode(node, [], lines, nodes);
  }
  return lines.join("\n");
};
