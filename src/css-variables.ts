import { kebabCase, noCase } from "change-case";
import { serializeColor, parseColor } from "./color";
import type {
  ColorValue,
  GradientValue,
  ShadowObject,
  Token,
} from "./dtcg.schema";
import { createEffectiveTree, type EffectiveTreeNode } from "./effective-tree";
import {
  type CubicBezierValue,
  type DimensionValue,
  type DurationValue,
  type FontFamilyValue,
  type StrokeStyleValue,
  type RawBorderValue,
  type RawGradientValue,
  type RawShadowValue,
  type RawTransitionValue,
  type RawTypographyValue,
  isNodeRef,
  type NodeRef,
} from "./schema";
import type { TreeNode } from "./store";
import type { TreeNodeMeta } from "./state.svelte";

export const toDimensionValue = (value: DimensionValue) => {
  return `${value.value}${value.unit}`;
};

export const toDurationValue = (value: DurationValue) => {
  return `${value.value}${value.unit}`;
};

export const toCubicBezierValue = (value: CubicBezierValue) => {
  return `cubic-bezier(${value.join(", ")})`;
};

export const toFontFamilyValue = (value: FontFamilyValue) => {
  return Array.isArray(value) ? value.join(", ") : value;
};

export const toStrokeStyleValue = (value: StrokeStyleValue) => {
  return typeof value === "string" ? value : "solid";
};

/**
 * Generate CSS variable name a token reference
 */
export const referenceToVariable = (
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
  // Convert to kebab-case and create CSS variable
  return `var(--${kebabCase(noCase(path.join("-")))})`;
};

/**
 * Convert a value or reference to a string or nested var()
 */
const valueOrVar = <T>(
  value: T | NodeRef,
  converter: (v: T) => string,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): string => {
  if (isNodeRef(value)) {
    return referenceToVariable(value, nodes);
  }
  return converter(value as T);
};

export const toShadowValue = (
  value: RawShadowValue,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const shadows = Array.isArray(value) ? value : [value];
  const shadowStrings = shadows.map((shadow) => {
    const color = valueOrVar(shadow.color, serializeColor, nodes);
    const inset = shadow.inset ? "inset " : "";
    const offsetX = valueOrVar(shadow.offsetX, toDimensionValue, nodes);
    const offsetY = valueOrVar(shadow.offsetY, toDimensionValue, nodes);
    const blur = valueOrVar(shadow.blur, toDimensionValue, nodes);
    const spread = valueOrVar(shadow.spread, toDimensionValue, nodes);
    return `${inset}${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
  });
  return shadowStrings.join(", ");
};

export const toGradientValue = (
  value: RawGradientValue,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const stops = value.map((stop) => {
    const color = valueOrVar(stop.color, serializeColor, nodes);
    return `${color} ${stop.position * 100}%`;
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
};

const toBorderValue = (
  value: RawBorderValue,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const style = valueOrVar(value.style, toStrokeStyleValue, nodes);
  const width = valueOrVar(value.width, toDimensionValue, nodes);
  const color = valueOrVar(value.color, serializeColor, nodes);
  return `${width} ${style} ${color}`;
};

const toTransitionValue = (
  value: RawTransitionValue,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const duration = valueOrVar(value.duration, toDurationValue, nodes);
  const timingFunction = valueOrVar(
    value.timingFunction,
    toCubicBezierValue,
    nodes,
  );
  const delay = valueOrVar(value.delay, toDurationValue, nodes);
  return `${duration} ${timingFunction} ${delay}`;
};

const addStrokeStyle = (
  propertyName: string,
  value: StrokeStyleValue | string,
  lines: string[],
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  if (isNodeRef(value)) {
    lines.push(`  ${propertyName}: ${referenceToVariable(value, nodes)};`);
    return;
  }
  if (typeof value === "string") {
    lines.push(`  ${propertyName}: ${value};`);
  } else {
    const dashArray = value.dashArray
      .map((d) => valueOrVar(d, toDimensionValue, nodes))
      .join(", ");
    lines.push(`  ${propertyName}-dash-array: ${dashArray};`);
    lines.push(`  ${propertyName}-line-cap: ${value.lineCap};`);
  }
};

const addTypography = (
  propertyName: string,
  value: RawTypographyValue,
  lines: string[],
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const fontFamily = valueOrVar(value.fontFamily, toFontFamilyValue, nodes);
  const fontSize = valueOrVar(value.fontSize, toDimensionValue, nodes);
  const letterSpacing = valueOrVar(
    value.letterSpacing,
    toDimensionValue,
    nodes,
  );
  const fontWeight = valueOrVar(value.fontWeight, (v) => `${v}`, nodes);
  const lineHeight = valueOrVar(value.lineHeight, (v) => `${v}`, nodes);
  lines.push(`  ${propertyName}-font-family: ${fontFamily};`);
  lines.push(`  ${propertyName}-font-size: ${fontSize};`);
  lines.push(`  ${propertyName}-font-weight: ${fontWeight};`);
  lines.push(`  ${propertyName}-line-height: ${lineHeight};`);
  lines.push(`  ${propertyName}-letter-spacing: ${letterSpacing};`);
  lines.push(
    `  ${propertyName}: ${fontWeight} ${fontSize}/${lineHeight} ${fontFamily};`,
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
    const propertyName = `--${kebabCase([...path, node.meta.name].join("-"))}`;
    // Handle token aliases (references to other tokens)
    if (isNodeRef(token.value)) {
      const variable = referenceToVariable(token.value, nodes);
      lines.push(`  ${propertyName}: ${variable};`);
      return;
    }
    switch (token.type) {
      case "color":
        lines.push(`  ${propertyName}: ${serializeColor(token.value)};`);
        break;
      case "dimension":
        lines.push(`  ${propertyName}: ${toDimensionValue(token.value)};`);
        break;
      case "duration":
        lines.push(`  ${propertyName}: ${toDurationValue(token.value)};`);
        break;
      case "cubicBezier":
        lines.push(`  ${propertyName}: ${toCubicBezierValue(token.value)};`);
        break;
      case "number":
      case "fontWeight":
        lines.push(`  ${propertyName}: ${token.value};`);
        break;
      case "fontFamily":
        lines.push(`  ${propertyName}: ${toFontFamilyValue(token.value)};`);
        break;
      case "shadow":
        lines.push(`  ${propertyName}: ${toShadowValue(token.value, nodes)};`);
        break;
      case "gradient":
        lines.push(
          `  ${propertyName}: ${toGradientValue(token.value, nodes)};`,
        );
        break;
      case "border":
        lines.push(`  ${propertyName}: ${toBorderValue(token.value, nodes)};`);
        break;
      case "transition":
        lines.push(
          `  ${propertyName}: ${toTransitionValue(token.value, nodes)};`,
        );
        break;
      case "strokeStyle":
        addStrokeStyle(propertyName, token.value, lines, nodes);
        break;
      case "typography":
        addTypography(propertyName, token.value, lines, nodes);
        break;
      default:
        token satisfies never;
        break;
    }
  }
};

export const generateCssVariables = (
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): string => {
  const lines: string[] = [];
  // render css variables in root element
  lines.push(":root {");
  for (const node of createEffectiveTree(nodes)) {
    processNode(node, [], lines, nodes);
  }
  lines.push("}");
  return lines.join("\n");
};

/**
 * Split by character like space or comma ignoring internals of functions
 */
const splitBy = (value: string, separator: string | RegExp) => {
  const parts: string[] = [];
  let currentPart = "";
  let depth = 0;
  for (const character of value) {
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
    } else if (
      depth === 0 &&
      currentPart &&
      (character === separator || character.match(separator))
    ) {
      parts.push(currentPart.trim());
      currentPart = "";
      continue;
    }
    currentPart += character;
  }
  if (currentPart.trim()) {
    parts.push(currentPart.trim());
  }
  return parts;
};

const parseAliasValue = (value: string): undefined | string => {
  const match = value.match(/^var\(--([a-zA-Z0-9_-]+)\)$/);
  if (match) {
    return `{${match[1]}}`;
  }
};

const parseAliasToken = (value: string): undefined | Token => {
  const alias = parseAliasValue(value);
  if (alias) {
    return {
      $value: alias,
    };
  }
};

const parseColorValue = (value: string): undefined | ColorValue => {
  const colorValue = parseColor(value);
  // Check if valid color (not the fallback transparent from failed parse)
  // parseColor returns transparent {colorSpace: "srgb", components: [0,0,0], alpha: 0} on parse failure
  // We want to accept it only if the input was actually "transparent"
  const isValidColor =
    colorValue.alpha !== 0 ||
    value.toLowerCase() === "transparent" ||
    colorValue.components.some((c) => c !== 0);
  if (isValidColor) {
    return colorValue;
  }
};

const parseColorToken = (value: string): undefined | Token => {
  const colorValue = parseColorValue(value);
  if (colorValue) {
    return { $type: "color", $value: colorValue };
  }
};

const parseDimensionValue = (
  value: string,
  unitlessZero?: boolean,
): undefined | DimensionValue => {
  if (unitlessZero && value === "0") {
    return {
      value: 0,
      unit: "px",
    };
  }
  let match = value.match(/^([\d.-]+)(px|rem)$/);
  if (!match) {
    return;
  }
  return {
    value: Number.parseFloat(match[1]),
    unit: match[2] as "px" | "rem",
  };
};

const parseDimensionToken = (value: string): undefined | Token => {
  const dimension = parseDimensionValue(value);
  if (dimension) {
    return { $type: "dimension", $value: dimension };
  }
};

const parseDurationValue = (value: string): undefined | DurationValue => {
  const match = value.match(/^([\d.-]+)(ms|s)$/);
  if (!match) {
    return;
  }
  return {
    value: Number.parseFloat(match[1]),
    unit: match[2] as "ms" | "s",
  };
};

const parseDurationToken = (value: string): undefined | Token => {
  const duration = parseDurationValue(value);
  if (duration) {
    return { $type: "duration", $value: duration };
  }
};

const parseFontWeightToken = (value: string): undefined | Token => {
  // Try font-weight detection (1-1000, but only specific common values)
  const match = value.match(/^(\d+)$/);
  if (match) {
    const weight = Number.parseInt(match[1], 10);
    // Only treat as font-weight if it's a common weight value
    if (weight >= 100 && weight <= 900 && weight % 100 === 0) {
      return {
        $type: "fontWeight",
        $value: weight,
      };
    }
  }
};

const parseNumberToken = (value: string): undefined | Token => {
  // Try number detection (plain numeric values)
  const match = value.match(/^-?[\d.]+$/);
  if (match) {
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num)) {
      return {
        $type: "number",
        $value: num,
      };
    }
  }
};

const parseCubicBezierValue = (value: string): undefined | CubicBezierValue => {
  const match = value.match(
    /^cubic-bezier\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)$/,
  );
  if (match) {
    return [
      Number.parseFloat(match[1]),
      Number.parseFloat(match[2]),
      Number.parseFloat(match[3]),
      Number.parseFloat(match[4]),
    ];
  }
};

const parseCubicBezierToken = (value: string): undefined | Token => {
  const cubicBezier = parseCubicBezierValue(value);
  if (cubicBezier) {
    return { $type: "cubicBezier", $value: cubicBezier };
  }
};

/**
 * Parse single shadow value
 */
const parseShadowItem = (value: string): undefined | ShadowObject => {
  const parts = splitBy(value, /\s+/);
  const inset = parts.some((part) => part === "inset");
  const color = parts
    .map((part) => parseAliasValue(part) ?? parseColorValue(part))
    .filter((item) => item !== undefined)
    .at(0);
  const dimensions = parts
    .map((item) => parseDimensionValue(item, true))
    .filter((item) => item !== undefined);
  const offsetX = dimensions.at(0);
  const offsetY = dimensions.at(1);
  const blur = dimensions.at(2);
  const spread = dimensions.at(3);
  if (!offsetX || !offsetY) {
    return;
  }
  const shadow: ShadowObject = {
    color: color ?? { colorSpace: "srgb", components: [0, 0, 0] },
    offsetX,
    offsetY,
    blur: blur ?? { value: 0, unit: "px" },
    spread: spread ?? { value: 0, unit: "px" },
  };
  if (inset) {
    shadow.inset = true;
  }
  return shadow;
};

const parseShadowToken = (value: string): undefined | Token => {
  // Handle multiple shadows separated by commas (not inside functions)
  const shadows = splitBy(value, ",");
  const parsedShadows = shadows
    .map(parseShadowItem)
    .filter((item) => item !== undefined);
  if (parsedShadows.length === 0) {
    return;
  }
  return {
    $type: "shadow",
    $value: parsedShadows.length === 1 ? parsedShadows[0] : parsedShadows,
  };
};

/**
 * Parse border value into DTCG border format
 */
const parseBorderToken = (value: string): undefined | Token => {
  // Border format: width style color
  const parts = splitBy(value, /\s+/);
  if (parts.length !== 3) {
    return;
  }
  // Check for style keyword
  const styleKeywords = [
    "solid",
    "dashed",
    "dotted",
    "double",
    "groove",
    "ridge",
    "inset",
    "outset",
  ];
  const style = parts.find((p) => styleKeywords.includes(p));
  if (!style) {
    return;
  }
  const aliases = parts
    .map(parseAliasValue)
    .filter((item) => item !== undefined);
  const width = parts.map((item) => parseDimensionValue(item, true)).at(0);
  const color = parts.map(parseColorValue).at(0);
  return {
    $type: "border",
    $value: {
      width: width ?? aliases.at(0) ?? { value: 0, unit: "px" },
      style,
      color: color ??
        aliases.at(1) ??
        aliases.at(0) ?? { colorSpace: "srgb", components: [0, 0, 0] },
    },
  };
};

const parseTransition = (value: string): undefined | Token => {
  const parts = splitBy(value, /\s+/);
  const durations = parts
    .map(parseDurationValue)
    .filter((item) => item !== undefined);
  const aliases = parts
    .map(parseAliasValue)
    .filter((item) => item !== undefined);
  const duration = durations.at(0) ?? aliases.at(0);
  const timingFunction =
    parts.map(parseCubicBezierValue).find((item) => item !== undefined) ??
    aliases.at(1) ??
    aliases.at(0);
  const delay = durations.at(1);
  if (!duration || !timingFunction) {
    return;
  }
  return {
    $type: "transition",
    $value: {
      duration,
      delay: delay ?? { value: 0, unit: "ms" },
      timingFunction,
    },
  };
};

const parseGradientToken = (value: string): undefined | Token => {
  // Only support linear-gradient for now
  const linearMatch = value.match(
    /^linear-gradient\(\s*([^,]+)\s*,\s*(.+)\s*\)$/,
  );
  if (!linearMatch) {
    return;
  }
  const stops: GradientValue = [];
  // Split by comma (not inside functions)
  const stopParts = splitBy(linearMatch[2], ",");

  // Parse each stop
  for (let i = 0; i < stopParts.length; i++) {
    const stop = stopParts[i].trim();
    // Format: color position%
    const parts = splitBy(stop, /\s+/);
    if (parts.length === 0) {
      continue;
    }
    const color = parts
      .map((part) => parseColorValue(part) ?? parseAliasValue(part))
      .find((item) => item !== undefined);
    if (!color) {
      continue;
    }
    const position = parts
      .map((part) =>
        part.includes("%") ? Number.parseFloat(part) / 100 : undefined,
      )
      .at(0);
    stops.push({
      color,
      position: position ?? i / (stopParts.length - 1),
    });
  }
  if (stops.length === 0) {
    return;
  }
  return { $type: "gradient", $value: stops };
};

const parseFontFamily = (value: string): undefined | Token => {
  // Try font-family detection (contains commas outside of functions, or quotes)
  // Check for commas but make sure they're not inside functions like cubic-bezier()
  if (value.includes('"') || value.includes("'")) {
    const families = value
      .split(",")
      .map((f) => f.trim().replace(/^["']|["']$/g, ""));
    if (families.length > 1) {
      return {
        $type: "fontFamily",
        $value: families,
      };
    } else if (families.length === 1) {
      return {
        $type: "fontFamily",
        $value: families[0],
      };
    }
  }
  // Check for commas, but only if not part of a function
  if (value.includes(",") && !value.includes("(")) {
    const families = value
      .split(",")
      .map((f) => f.trim().replace(/^["']|["']$/g, ""));
    if (families.length > 1) {
      return {
        $type: "fontFamily",
        $value: families,
      };
    }
  }
};

/**
 * Parse CSS variables string and convert to DTCG format
 */
export const parseCssVariables = (input: string): Record<string, Token> => {
  // Extract variable declarations from input
  let cssText = input.trim();
  // Remove /* comments */
  cssText = cssText.replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, "");
  // Remove :root wrapper if present
  const rootMatch = cssText.match(/:root\s*\{([^}]*)\}/s);
  if (rootMatch) {
    cssText = rootMatch[1];
  }
  const result: Record<string, Token> = {};
  // Split by semicolon and parse each declaration
  const declarations = cssText
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);
  for (const decl of declarations) {
    const colonIndex = decl.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const propertyName = decl.slice(0, colonIndex).trim();
    const propertyValue = decl.slice(colonIndex + 1).trim();
    if (!propertyName.startsWith("--")) {
      continue;
    }
    const tokenName = propertyName.slice(2); // Remove '--' prefix
    // Try to detect type and parse value
    const token =
      parseAliasToken(propertyValue) ??
      parseColorToken(propertyValue) ??
      parseDimensionToken(propertyValue) ??
      parseDurationToken(propertyValue) ??
      parseFontWeightToken(propertyValue) ??
      parseNumberToken(propertyValue) ??
      parseCubicBezierToken(propertyValue) ??
      parseShadowToken(propertyValue) ??
      parseBorderToken(propertyValue) ??
      parseTransition(propertyValue) ??
      parseGradientToken(propertyValue) ??
      parseFontWeightToken(propertyValue) ??
      parseFontFamily(propertyValue);
    if (token) {
      result[tokenName] = token;
    }
  }
  return result;
};
