import { kebabCase } from "change-case";
import { compareTreeNodes, type TreeNode } from "./store";
import type { TreeNodeMeta } from "./state.svelte";
import { resolveTokenValue } from "./state.svelte";
import { serializeColor } from "./color";
import type {
  BorderValue,
  CubicBezierValue,
  DimensionValue,
  DurationValue,
  FontFamilyValue,
  GradientValue,
  ShadowValue,
  StrokeStyleValue,
  TransitionValue,
  TypographyValue,
  Value,
} from "./schema";

// https://www.designtokens.org/tr/2025.10/color

export const toDimensionValue = (value: DimensionValue) => {
  return `${value.value}${value.unit}`;
};

export const toDurationValue = (value: DurationValue) => {
  return `${value.value}${value.unit}`;
};

export const toCubicBezierValue = (value: CubicBezierValue) => {
  return `cubic-bezier(${value.join(", ")})`;
};

export const toFontFamily = (value: FontFamilyValue) => {
  return Array.isArray(value) ? value.join(", ") : value;
};

export const toShadow = (value: ShadowValue) => {
  const shadows = Array.isArray(value) ? value : [value];
  const shadowStrings = shadows.map((shadow) => {
    const color = serializeColor(shadow.color);
    const inset = shadow.inset ? "inset " : "";
    const offsetX = toDimensionValue(shadow.offsetX);
    const offsetY = toDimensionValue(shadow.offsetY);
    const blur = toDimensionValue(shadow.blur);
    const spread = shadow.spread ? toDimensionValue(shadow.spread) : "";
    return `${inset}${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
  });
  return shadowStrings.join(", ");
};

export const toGradient = (value: GradientValue) => {
  const stops = value.map(
    (stop) => `${serializeColor(stop.color)} ${stop.position * 100}%`,
  );
  return `linear-gradient(90deg, ${stops.join(", ")})`;
};

const addTransition = (
  varName: string,
  value: TransitionValue,
  cssLines: string[],
) => {
  const duration = toDurationValue(value.duration);
  const delay = toDurationValue(value.delay);
  const timingFunction = toCubicBezierValue(value.timingFunction);
  cssLines.push(`  ${varName}-duration: ${duration};`);
  cssLines.push(`  ${varName}-delay: ${delay};`);
  cssLines.push(`  ${varName}-timing-function: ${timingFunction};`);
  cssLines.push(`  ${varName}: ${duration} ${timingFunction} ${delay};`);
};

const addStrokeStyle = (
  varName: string,
  value: StrokeStyleValue,
  cssLines: string[],
) => {
  if (typeof value === "string") {
    cssLines.push(`  ${varName}: ${value};`);
  } else {
    const dashArray = value.dashArray.map(toDimensionValue).join(", ");
    cssLines.push(`  ${varName}-dash-array: ${dashArray};`);
    cssLines.push(`  ${varName}-line-cap: ${value.lineCap};`);
  }
};

const addBorder = (varName: string, value: BorderValue, cssLines: string[]) => {
  const color = serializeColor(value.color);
  const width = toDimensionValue(value.width);
  const style = typeof value.style === "string" ? value.style : "solid";
  cssLines.push(`  ${varName}-color: ${color};`);
  cssLines.push(`  ${varName}-width: ${width};`);
  cssLines.push(`  ${varName}-style: ${style};`);
  cssLines.push(`  ${varName}: ${width} ${style} ${color};`);
};

const addTypography = (
  varName: string,
  value: TypographyValue,
  cssLines: string[],
) => {
  const fontFamily = toFontFamily(value.fontFamily);
  const fontSize = toDimensionValue(value.fontSize);
  const letterSpacing = toDimensionValue(value.letterSpacing);
  cssLines.push(`  ${varName}-font-family: ${fontFamily};`);
  cssLines.push(`  ${varName}-font-size: ${fontSize};`);
  cssLines.push(`  ${varName}-font-weight: ${value.fontWeight};`);
  cssLines.push(`  ${varName}-line-height: ${value.lineHeight};`);
  cssLines.push(`  ${varName}-letter-spacing: ${letterSpacing};`);
  cssLines.push(
    `  ${varName}: ${value.fontWeight} ${fontSize}/${value.lineHeight} ${fontFamily};`,
  );
};

const processNode = (
  node: TreeNode<TreeNodeMeta>,
  path: string[],
  childrenByParent: Map<string | undefined, TreeNode<TreeNodeMeta>[]>,
  allNodes: Map<string, TreeNode<TreeNodeMeta>>,
  cssLines: string[],
) => {
  // group is only added to variable name
  if (node.meta.nodeType === "token-group") {
    const children = childrenByParent.get(node.nodeId) ?? [];
    for (const child of children) {
      processNode(
        child,
        [...path, node.meta.name],
        childrenByParent,
        allNodes,
        cssLines,
      );
    }
  }

  if (node.meta.nodeType === "token") {
    const tokenValue = resolveTokenValue(node.meta, allNodes);
    const varName = `--${kebabCase([...path, node.meta.name].join("-"))}`;
    switch (tokenValue.type) {
      case "color":
        cssLines.push(`  ${varName}: ${serializeColor(tokenValue.value)};`);
        break;
      case "dimension":
        cssLines.push(`  ${varName}: ${toDimensionValue(tokenValue.value)};`);
        break;
      case "duration":
        cssLines.push(`  ${varName}: ${toDurationValue(tokenValue.value)};`);
        break;
      case "cubicBezier":
        cssLines.push(`  ${varName}: ${toCubicBezierValue(tokenValue.value)};`);
        break;
      case "number":
        cssLines.push(`  ${varName}: ${tokenValue.value};`);
        break;
      case "fontFamily":
        cssLines.push(`  ${varName}: ${toFontFamily(tokenValue.value)};`);
        break;
      case "fontWeight":
        cssLines.push(`  ${varName}: ${tokenValue.value};`);
        break;
      case "shadow":
        cssLines.push(`  ${varName}: ${toShadow(tokenValue.value)};`);
        break;
      case "gradient":
        cssLines.push(`  ${varName}: ${toGradient(tokenValue.value)};`);
        break;
      case "transition":
        addTransition(varName, tokenValue.value, cssLines);
        break;
      case "strokeStyle":
        addStrokeStyle(varName, tokenValue.value, cssLines);
        break;
      case "border":
        addBorder(varName, tokenValue.value, cssLines);
        break;
      case "typography":
        addTypography(varName, tokenValue.value, cssLines);
        break;
      default:
        tokenValue satisfies never;
        break;
    }
  }
};

export const generateCssVariables = (
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): string => {
  const cssLines: string[] = [];
  const childrenByParent = new Map<
    string | undefined,
    TreeNode<TreeNodeMeta>[]
  >();
  // build index for children
  for (const node of nodes.values()) {
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }
  for (const children of childrenByParent.values()) {
    children.sort(compareTreeNodes);
  }
  // render css variables in root element
  cssLines.push(":root {");
  const rootChildren = childrenByParent.get(undefined) ?? [];
  for (const node of rootChildren) {
    processNode(node, [], childrenByParent, nodes, cssLines);
  }
  cssLines.push("}");
  return cssLines.join("\n");
};
