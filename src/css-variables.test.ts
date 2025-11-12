import { test, expect, describe } from "vitest";
import { generateCssVariables } from "./css-variables";
import { parseDesignTokens } from "./tokens";
import type { TreeNode } from "./store";
import type { GroupMeta, TokenMeta } from "./state.svelte";

type TreeNodeMeta = GroupMeta | TokenMeta;

// Helper to convert array to Map
const nodesToMap = (nodes: TreeNode<TreeNodeMeta>[]) => {
  const map = new Map<string, TreeNode<TreeNodeMeta>>();
  for (const node of nodes) {
    map.set(node.nodeId, node);
  }
  return map;
};

describe("generateCssVariables", () => {
  test("generates empty CSS for empty nodes", () => {
    const result = generateCssVariables(new Map());
    expect(result).toBe(":root {\n}");
  });

  test("generates CSS variables for simple color token", () => {
    const parsed = parseDesignTokens({
      myColor: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--my-color: rgb(100% 0% 0%);");
  });

  test("generates CSS variables for color with alpha", () => {
    const parsed = parseDesignTokens({
      myColor: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.5 },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--my-color: rgb(0% 0% 0% / 0.5);");
  });

  test("generates CSS variables for dimension token", () => {
    const parsed = parseDesignTokens({
      spacing: {
        $type: "dimension",
        $value: { value: 16, unit: "px" },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--spacing: 16px;");
  });

  test("generates CSS variables for grouped tokens", () => {
    const parsed = parseDesignTokens({
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
        secondary: {
          $value: { colorSpace: "srgb", components: [0.8, 0.2, 0.5] },
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--colors-primary:");
    expect(css).toContain("--colors-secondary:");
  });

  test("generates CSS variables for number token", () => {
    const parsed = parseDesignTokens({
      myNumber: {
        $type: "number",
        $value: 42,
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--my-number: 42;");
  });

  test("generates CSS variables for duration token", () => {
    const parsed = parseDesignTokens({
      fast: {
        $type: "duration",
        $value: { value: 100, unit: "ms" },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--fast: 100ms;");
  });

  test("generates CSS variables for cubicBezier token", () => {
    const parsed = parseDesignTokens({
      ease: {
        $type: "cubicBezier",
        $value: [0.25, 0.1, 0.25, 1],
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--ease: cubic-bezier(0.25, 0.1, 0.25, 1);");
  });

  test("generates CSS variables for fontFamily token as string", () => {
    const parsed = parseDesignTokens({
      sans: {
        $type: "fontFamily",
        $value: "Arial, sans-serif",
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--sans: Arial, sans-serif;");
  });

  test("generates CSS variables for fontFamily token as array", () => {
    const parsed = parseDesignTokens({
      sans: {
        $type: "fontFamily",
        $value: ["Arial", "Helvetica", "sans-serif"],
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--sans: Arial, Helvetica, sans-serif;");
  });

  test("generates CSS variables for fontWeight token", () => {
    const parsed = parseDesignTokens({
      bold: {
        $type: "fontWeight",
        $value: 700,
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--bold: 700;");
  });

  test("generates CSS variables for transition composite token", () => {
    const parsed = parseDesignTokens({
      fast: {
        $type: "transition",
        $value: {
          duration: { value: 100, unit: "ms" },
          delay: { value: 0, unit: "ms" },
          timingFunction: [0.42, 0, 0.58, 1],
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--fast-duration: 100ms;");
    expect(css).toContain("--fast-delay: 0ms;");
    expect(css).toContain(
      "--fast-timing-function: cubic-bezier(0.42, 0, 0.58, 1);",
    );
    expect(css).toContain("--fast: 100ms cubic-bezier(0.42, 0, 0.58, 1) 0ms;");
  });

  test("generates CSS variables for strokeStyle as string", () => {
    const parsed = parseDesignTokens({
      solid: {
        $type: "strokeStyle",
        $value: "solid",
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--solid: solid;");
  });

  test("generates CSS variables for strokeStyle with dashArray", () => {
    const parsed = parseDesignTokens({
      dashed: {
        $type: "strokeStyle",
        $value: {
          dashArray: [
            { value: 4, unit: "px" },
            { value: 2, unit: "px" },
          ],
          lineCap: "round",
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--dashed-dash-array: 4px, 2px;");
    expect(css).toContain("--dashed-line-cap: round;");
  });

  test("generates CSS variables for shadow token", () => {
    const parsed = parseDesignTokens({
      sm: {
        $type: "shadow",
        $value: {
          color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.1 },
          offsetX: { value: 1, unit: "px" },
          offsetY: { value: 2, unit: "px" },
          blur: { value: 4, unit: "px" },
          spread: { value: 0, unit: "px" },
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--sm: 1px 2px 4px 0px rgb(0% 0% 0% / 0.1);");
  });

  test("generates CSS variables for inset shadow", () => {
    const parsed = parseDesignTokens({
      inset: {
        $type: "shadow",
        $value: {
          color: { colorSpace: "srgb", components: [0, 0, 0, 0.1] },
          offsetX: { value: 0, unit: "px" },
          offsetY: { value: 2, unit: "px" },
          blur: { value: 4, unit: "px" },
          inset: true,
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("inset 0px 2px 4px");
  });

  test("generates CSS variables for multiple shadows", () => {
    const parsed = parseDesignTokens({
      multiple: {
        $type: "shadow",
        $value: [
          {
            color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.1 },
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 1, unit: "px" },
            blur: { value: 2, unit: "px" },
          },
          {
            color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.05 },
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 4, unit: "px" },
            blur: { value: 8, unit: "px" },
          },
        ],
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--multiple:");
    expect(css).toContain("rgb(0% 0% 0% / 0.1)");
    expect(css).toContain("rgb(0% 0% 0% / 0.05)");
  });

  test("generates CSS variables for border token", () => {
    const parsed = parseDesignTokens({
      thin: {
        $type: "border",
        $value: {
          color: { colorSpace: "srgb", components: [0.9, 0.9, 0.9] },
          width: { value: 1, unit: "px" },
          style: "solid",
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--thin-color: rgb(90% 90% 90%);");
    expect(css).toContain("--thin-width: 1px;");
    expect(css).toContain("--thin-style: solid;");
    expect(css).toContain("--thin: 1px solid rgb(90% 90% 90%);");
  });

  test("generates CSS variables for typography token", () => {
    const parsed = parseDesignTokens({
      h1: {
        $type: "typography",
        $value: {
          fontFamily: "Inter, sans-serif",
          fontSize: { value: 32, unit: "px" },
          fontWeight: 700,
          lineHeight: 1.2,
          letterSpacing: { value: -0.02, unit: "px" },
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--h1-font-family: Inter, sans-serif;");
    expect(css).toContain("--h1-font-size: 32px;");
    expect(css).toContain("--h1-font-weight: 700;");
    expect(css).toContain("--h1-line-height: 1.2;");
    expect(css).toContain("--h1-letter-spacing: -0.02px;");
    expect(css).toContain("--h1: 700 32px/1.2 Inter, sans-serif;");
  });

  test("generates CSS variables for gradient token", () => {
    const parsed = parseDesignTokens({
      primary: {
        $type: "gradient",
        $value: [
          {
            color: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
            position: 0,
          },
          {
            color: { colorSpace: "srgb", components: [0.1, 0.5, 0.9] },
            position: 1,
          },
        ],
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain(
      "--primary: linear-gradient(90deg, rgb(0% 40% 80%) 0%, rgb(10% 50% 90%) 100%);",
    );
  });

  test("generates CSS for multiple nested groups", () => {
    const parsed = parseDesignTokens({
      design: {
        colors: {
          $type: "color",
          primary: {
            $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
          },
        },
        spacing: {
          $type: "dimension",
          sm: {
            $value: { value: 8, unit: "px" },
          },
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--design-colors-primary:");
    expect(css).toContain("--design-spacing-sm:");
  });

  test("generates CSS that starts and ends with :root", () => {
    const parsed = parseDesignTokens({
      color: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toMatch(/^:root \{/);
    expect(css).toMatch(/\}$/);
  });

  test("generates valid CSS with proper indentation", () => {
    const parsed = parseDesignTokens({
      myColor: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    const lines = css.split("\n");
    expect(lines[1]).toMatch(/^  --my-color:/);
  });
});
