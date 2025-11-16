import * as colorjs from "colorjs.io/fn";
import type { ColorValue } from "./schema";

colorjs.ColorSpace.register(colorjs.sRGB);
colorjs.ColorSpace.register(colorjs.sRGB_Linear);
colorjs.ColorSpace.register(colorjs.HSL);
colorjs.ColorSpace.register(colorjs.HWB);
colorjs.ColorSpace.register(colorjs.Lab);
colorjs.ColorSpace.register(colorjs.LCH);
colorjs.ColorSpace.register(colorjs.OKLab);
colorjs.ColorSpace.register(colorjs.OKLCH);
colorjs.ColorSpace.register(colorjs.P3);
colorjs.ColorSpace.register(colorjs.A98RGB);
colorjs.ColorSpace.register(colorjs.ProPhoto);
colorjs.ColorSpace.register(colorjs.REC_2020);
colorjs.ColorSpace.register(colorjs.XYZ_D65);
colorjs.ColorSpace.register(colorjs.XYZ_D50);

/**
 * Converts hex color to 6-digit format
 */
const expandHexTo6Digits = (hex: string) => {
  if (hex.length === 4 && hex.startsWith("#")) {
    // #RGB -> #RRGGBB
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
};

/**
 * Extracts raw numeric value from colorjs.io coordinate or alpha value
 * Handles special Number objects with metadata
 */
const getCoord = (value: number): number | "none" => {
  // Check for "none" property
  if ((value as any)?.none === true) {
    return "none";
  }
  return value.valueOf();
};

// Mapping from design token color spaces to colorjs.io space ID
const spaceIdByColorSpace: Record<ColorValue["colorSpace"], string> = {
  srgb: "srgb",
  "display-p3": "p3",
  "srgb-linear": "srgb-linear",
  hsl: "hsl",
  hwb: "hwb",
  lab: "lab",
  lch: "lch",
  oklab: "oklab",
  oklch: "oklch",
  "a98-rgb": "a98rgb",
  "prophoto-rgb": "prophoto",
  rec2020: "rec2020",
  "xyz-d65": "xyz-d65",
  "xyz-d50": "xyz-d50",
};

const colorSpaceBySpaceId = Object.fromEntries(
  Object.entries(spaceIdByColorSpace).map(([colorSpace, spaceId]) => [
    spaceId,
    colorSpace,
  ]),
) as Record<string, ColorValue["colorSpace"]>;

/**
 * Parses a CSS color string into the design tokens color format
 * Uses colorjs.io to parse and normalize color values.
 */
export const parseColor = (input: string): ColorValue => {
  try {
    const color = colorjs.parse(input);
    const components = color.coords.map(getCoord);
    const hasNoneComponent = components.some((c) => c === "none");
    const alphaCoord = getCoord(color.alpha ?? 1);
    const alpha = alphaCoord === "none" ? 1 : alphaCoord;
    const result: ColorValue = {
      colorSpace: colorSpaceBySpaceId[color.spaceId],
      components,
    };
    // Only add alpha if not fully opaque
    if (alpha !== 1) {
      result.alpha = alpha;
    }
    // For sRGB colors, add hex if fully opaque and no "none" components
    if (color.spaceId === "srgb" && !hasNoneComponent && alpha === 1) {
      result.hex = expandHexTo6Digits(
        colorjs.serialize(color, { format: "hex" }),
      );
    }
    return result;
  } catch {
    // For invalid color return transparent
    return {
      colorSpace: "srgb",
      components: [0, 0, 0],
      alpha: 0,
    };
  }
};

/**
 * Converts a design tokens color value back to a CSS color string
 * Uses colorjs.io to ensure proper serialization across all color spaces
 */
export const serializeColor = (colorValue: ColorValue): string => {
  try {
    const spaceId = spaceIdByColorSpace[colorValue.colorSpace];
    return colorjs.serialize(
      {
        spaceId,
        coords: colorValue.components as any,
        alpha: colorValue.alpha,
      },
      { precision: 2 },
    );
  } catch {
    // Fallback to transparent if serialization fails
    return "transparent";
  }
};
