import { kebabCase } from "change-case";
import { compareTreeNodes, type TreeNode } from "./store";
import type { TreeNodeMeta } from "./state.svelte";
import type {
  BorderValue,
  ColorValue,
  CubicBezierValue,
  DimensionValue,
  DurationValue,
  FontFamilyValue,
  GradientValue,
  ShadowValue,
  StrokeStyleValue,
  TransitionValue,
  TypographyValue,
} from "./schema";

// https://www.designtokens.org/tr/2025.10/color

const toComponent = (component: number | "none") => {
  if (component === "none") {
    return 0;
  }
  return component;
};

export const toColorValue = (color: ColorValue) => {
  const c1 = toComponent(color.components[0]);
  const c2 = toComponent(color.components[1]);
  const c3 = toComponent(color.components[2]);
  const alpha = color.alpha !== undefined ? ` / ${color.alpha}` : "";
  switch (color.colorSpace) {
    case "srgb":
      return `rgb(${c1 * 100}% ${c2 * 100}% ${c3 * 100}%${alpha})`;
    case "hsl":
      return `hsl(${c1} ${c2}% ${c3}%${alpha})`;
    case "hwb":
      return `hwb(${c1} ${c2}% ${c3}%${alpha})`;
    case "lab":
      return `lab(${c1} ${c2} ${c3}${alpha})`;
    case "lch":
      return `lch(${c1} ${c2} ${c3}${alpha})`;
    case "oklab":
      return `oklab(${c1} ${c2} ${c3}${alpha})`;
    case "oklch":
      return `oklch(${c1} ${c2} ${c3}${alpha})`;
    case "display-p3":
      return `color(display-p3 ${c1 * 100}% ${c2 * 100}% ${c3 * 100}%${alpha})`;
    case "a98-rgb":
      return `color(a98-rgb ${c1 * 100}% ${c2 * 100}% ${c3 * 100}%${alpha})`;
    case "prophoto-rgb":
      return `color(prophoto-rgb ${c1 * 100}% ${c2 * 100}% ${c3 * 100}%${alpha})`;
    case "rec2020":
      return `color(rec2020 ${c1 * 100}% ${c2 * 100}% ${c3 * 100}%${alpha})`;
    case "srgb-linear":
      return `color(srgb-linear ${c1 * 100}% ${c2 * 100}% ${c3 * 100}%${alpha})`;
    case "xyz-d65":
      return `color(xyz-d65 ${c1 * 100}% ${c2 * 100}% ${c3 * 100}%${alpha})`;
    case "xyz-d50":
      return `color(xyz-d50 ${c1 * 100}% ${c2 * 100}% ${c3 * 100}%${alpha})`;
    default:
      return "transparent";
  }
};

const toDimensionValue = (value: DimensionValue) => {
  return `${value.value}${value.unit}`;
};

const toDurationValue = (value: DurationValue) => {
  return `${value.value}${value.unit}`;
};

const toCubicBezierValue = (value: CubicBezierValue) => {
  return `cubic-bezier(${value.join(", ")})`;
};

const toFontFamily = (value: FontFamilyValue) => {
  return Array.isArray(value) ? value.join(", ") : value;
};

const toShadow = (value: ShadowValue) => {
  const shadows = Array.isArray(value) ? value : [value];
  const shadowStrings = shadows.map((shadow) => {
    const color = toColorValue(shadow.color);
    const inset = shadow.inset ? "inset " : "";
    const offsetX = toDimensionValue(shadow.offsetX);
    const offsetY = toDimensionValue(shadow.offsetY);
    const blur = toDimensionValue(shadow.blur);
    const spread = shadow.spread ? toDimensionValue(shadow.spread) : "";
    return `${inset}${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
  });
  return shadowStrings.join(", ");
};

const toGradient = (value: GradientValue) => {
  const stops = value.map(
    (stop) => `${toColorValue(stop.color)} ${stop.position * 100}%`,
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
  const color = toColorValue(value.color);
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
  cssLines: string[],
) => {
  // group is only added to variable name
  if (node.meta.nodeType === "token-group") {
    const children = childrenByParent.get(node.nodeId) ?? [];
    for (const child of children) {
      processNode(child, [...path, node.meta.name], childrenByParent, cssLines);
    }
  }

  if (node.meta.nodeType === "token") {
    const varName = `--${kebabCase([...path, node.meta.name].join("-"))}`;
    switch (node.meta.type) {
      case "color":
        cssLines.push(`  ${varName}: ${toColorValue(node.meta.value)};`);
        break;
      case "dimension":
        cssLines.push(`  ${varName}: ${toDimensionValue(node.meta.value)};`);
        break;
      case "duration":
        cssLines.push(`  ${varName}: ${toDurationValue(node.meta.value)};`);
        break;
      case "cubicBezier":
        cssLines.push(`  ${varName}: ${toCubicBezierValue(node.meta.value)};`);
        break;
      case "number":
        cssLines.push(`  ${varName}: ${node.meta.value};`);
        break;
      case "fontFamily":
        cssLines.push(`  ${varName}: ${toFontFamily(node.meta.value)};`);
        break;
      case "fontWeight":
        cssLines.push(`  ${varName}: ${node.meta.value};`);
        break;
      case "shadow":
        cssLines.push(`  ${varName}: ${toShadow(node.meta.value)};`);
        break;
      case "gradient":
        cssLines.push(`  ${varName}: ${toGradient(node.meta.value)};`);
        break;
      case "transition":
        addTransition(varName, node.meta.value, cssLines);
        break;
      case "strokeStyle":
        addStrokeStyle(varName, node.meta.value, cssLines);
        break;
      case "border":
        addBorder(varName, node.meta.value, cssLines);
        break;
      case "typography":
        addTypography(varName, node.meta.value, cssLines);
        break;
      default:
        node.meta satisfies never;
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
    processNode(node, [], childrenByParent, cssLines);
  }
  cssLines.push("}");
  return cssLines.join("\n");
};
