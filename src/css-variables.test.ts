import { test, expect, describe } from "vitest";
import { generateCssVariables, parseCssVariables } from "./css-variables";
import { parseDesignTokens } from "./tokens";
import { parseTokenResolver } from "./resolver";
import type { TreeNode } from "./store";
import type { TreeNodeMeta } from "./state.svelte";

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
          spread: { value: 0, unit: "px" },
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
            spread: { value: 0, unit: "px" },
          },
          {
            color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.05 },
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 4, unit: "px" },
            blur: { value: 8, unit: "px" },
            spread: { value: 0, unit: "px" },
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

  test("generates nested var() for token alias with reference", () => {
    const parsed = parseDesignTokens({
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
      myAlias: {
        $type: "color",
        $value: "{colors.primary}",
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--my-alias: var(--colors-primary);");
  });

  test("generates nested var() for nested token alias", () => {
    const parsed = parseDesignTokens({
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
      theme: {
        $type: "color",
        accent: {
          $value: "{colors.primary}",
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--theme-accent: var(--colors-primary);");
  });

  test("generates nested var() for dimension alias", () => {
    const parsed = parseDesignTokens({
      spacing: {
        $type: "dimension",
        base: {
          $value: { value: 8, unit: "px" },
        },
      },
      mySpacing: {
        $type: "dimension",
        $value: "{spacing.base}",
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--my-spacing: var(--spacing-base);");
  });

  test("generates nested var() for deeply nested token alias", () => {
    const parsed = parseDesignTokens({
      design: {
        colors: {
          $type: "color",
          primary: {
            $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
          },
        },
      },
      aliases: {
        $type: "color",
        buttonColor: {
          $value: "{design.colors.primary}",
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain(
      "--aliases-button-color: var(--design-colors-primary);",
    );
  });

  test("handles multiple aliases referencing same token", () => {
    const parsed = parseDesignTokens({
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
      primary: {
        $type: "color",
        $value: "{colors.primary}",
      },
      brand: {
        $type: "color",
        $value: "{colors.primary}",
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--primary: var(--colors-primary);");
    expect(css).toContain("--brand: var(--colors-primary);");
  });

  test("can chain aliases through var references", () => {
    const parsed = parseDesignTokens({
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
      theme: {
        $type: "color",
        brand: {
          $value: "{colors.primary}",
        },
      },
      ui: {
        $type: "color",
        button: {
          $value: "{theme.brand}",
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--colors-primary: rgb(0% 40% 80%);");
    expect(css).toContain("--theme-brand: var(--colors-primary);");
    expect(css).toContain("--ui-button: var(--theme-brand);");
  });

  test("generates nested var() for composite shadow with color reference", () => {
    const parsed = parseDesignTokens({
      colors: {
        $type: "color",
        shadow: {
          $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.1 },
        },
      },
      shadows: {
        $type: "shadow",
        card: {
          $value: {
            color: "{colors.shadow}",
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 2, unit: "px" },
            blur: { value: 4, unit: "px" },
            spread: { value: 0, unit: "px" },
          },
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--colors-shadow: rgb(0% 0% 0% / 0.1);");
    expect(css).toContain(
      "--shadows-card: 0px 2px 4px 0px var(--colors-shadow);",
    );
  });

  test("generates nested var() for composite border with references", () => {
    const parsed = parseDesignTokens({
      colors: {
        $type: "color",
        border: {
          $value: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
        },
      },
      dimensions: {
        $type: "dimension",
        thin: {
          $value: { value: 1, unit: "px" },
        },
      },
      borders: {
        $type: "border",
        default: {
          $value: {
            color: "{colors.border}",
            width: "{dimensions.thin}",
            style: "solid",
          },
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--colors-border: rgb(50% 50% 50%);");
    expect(css).toContain("--dimensions-thin: 1px;");
    expect(css).toContain(
      "--borders-default: var(--dimensions-thin) solid var(--colors-border);",
    );
  });

  test("generates nested var() for transition with references", () => {
    const parsed = parseDesignTokens({
      durations: {
        $type: "duration",
        fast: {
          $value: { value: 150, unit: "ms" },
        },
      },
      easings: {
        $type: "cubicBezier",
        smooth: {
          $value: [0.4, 0, 0.2, 1],
        },
      },
      transitions: {
        $type: "transition",
        fadeIn: {
          $value: {
            duration: "{durations.fast}",
            delay: { value: 0, unit: "ms" },
            timingFunction: "{easings.smooth}",
          },
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--durations-fast: 150ms;");
    expect(css).toContain("--easings-smooth: cubic-bezier(0.4, 0, 0.2, 1);");
    expect(css).toContain(
      "--transitions-fade-in: var(--durations-fast) var(--easings-smooth) 0ms;",
    );
  });

  test("generates nested var() for typography with references", () => {
    const parsed = parseDesignTokens({
      fonts: {
        $type: "fontFamily",
        body: {
          $value: "Inter, sans-serif",
        },
      },
      sizes: {
        $type: "dimension",
        base: {
          $value: { value: 16, unit: "px" },
        },
      },
      weights: {
        $type: "fontWeight",
        normal: {
          $value: 400,
        },
      },
      typography: {
        $type: "typography",
        body: {
          $value: {
            fontFamily: "{fonts.body}",
            fontSize: "{sizes.base}",
            fontWeight: "{weights.normal}",
            lineHeight: 1.5,
            letterSpacing: { value: 0, unit: "px" },
          },
        },
      },
    });
    const css = generateCssVariables(nodesToMap(parsed.nodes));
    expect(css).toContain("--typography-body-font-family: var(--fonts-body)");
    expect(css).toContain("--typography-body-font-size: var(--sizes-base)");
    expect(css).toContain(
      "--typography-body-font-weight: var(--weights-normal)",
    );
    expect(css).toContain(
      "--typography-body: var(--weights-normal) var(--sizes-base)/1.5 var(--fonts-body)",
    );
  });

  test("generates effective inherited variables under the extending path", () => {
    const parsed = parseDesignTokens({
      target: { $type: "number", $value: 1 },
      base: {
        alias: { $type: "number", $value: "{target}" },
        replaced: { $type: "number", $value: 2 },
        nested: {
          inherited: { $type: "number", $value: 3 },
          replaced: { $type: "number", $value: 4 },
        },
      },
      middle: {
        $extends: "{base}",
        middleOnly: { $type: "number", $value: 5 },
      },
      derived: {
        $extends: "{middle}",
        replaced: { $type: "number", $value: 6 },
        nested: {
          replaced: { $type: "number", $value: 7 },
          local: { $type: "number", $value: 8 },
        },
      },
    });

    const css = generateCssVariables(nodesToMap(parsed.nodes));

    expect(css).toContain("--derived-alias: var(--target);");
    expect(css).toContain("--derived-replaced: 6;");
    expect(css).toContain("--derived-middle-only: 5;");
    expect(css).toContain("--derived-nested-inherited: 3;");
    expect(css).toContain("--derived-nested-replaced: 7;");
    expect(css).toContain("--derived-nested-local: 8;");
    expect(css).not.toContain("--derived-replaced: 2;");
  });
});

describe("parseCssVariables", () => {
  test("returns empty object for empty input", () => {
    expect(parseCssVariables("")).toEqual({});
    expect(parseCssVariables("   ")).toEqual({});
  });

  test("returns empty object for invalid input", () => {
    expect(parseCssVariables("not valid css")).toEqual({});
    expect(parseCssVariables(":root { invalid }")).toEqual({});
  });

  test("parses :root CSS block with color", () => {
    const result = parseCssVariables(":root { --primary: rgb(0, 102, 204); }");
    expect(result).toHaveProperty("primary");
    expect(result).toMatchObject({
      primary: {
        $type: "color",
        $value: {
          colorSpace: "srgb",
          components: expect.any(Array),
        },
      },
    });
  });

  test("parses bare CSS variable declarations", () => {
    const result = parseCssVariables("--primary: #0066cc; --spacing: 16px;");
    expect(result).toHaveProperty("primary");
    expect(result).toHaveProperty("spacing");
  });

  test("parses hex color", () => {
    const result = parseCssVariables("--color: #ff0000;");
    expect(result).toMatchObject({
      color: {
        $type: "color",
        $value: {
          colorSpace: "srgb",
          hex: "#ff0000",
        },
      },
    });
  });

  test("parses rgb color", () => {
    const result = parseCssVariables("--color: rgb(255, 0, 0);");
    expect(result.color).toHaveProperty("$type", "color");
    expect(result.color?.$value).toHaveProperty("colorSpace", "srgb");
  });

  test("parses rgba color with alpha", () => {
    const result = parseCssVariables("--color: rgba(0, 0, 0, 0.5);");
    expect(result.color).toMatchObject({
      $type: "color",
      $value: {
        alpha: 0.5,
      },
    });
  });

  test("parses hsl color", () => {
    const result = parseCssVariables("--color: hsl(120, 100%, 50%);");
    expect(result.color).toHaveProperty("$type", "color");
    expect(result.color?.$value).toHaveProperty("colorSpace", "hsl");
  });

  test("parses oklch color", () => {
    const result = parseCssVariables("--color: oklch(0.7 0.15 180);");
    expect(result.color).toHaveProperty("$type", "color");
    expect(result.color?.$value).toHaveProperty("colorSpace", "oklch");
  });

  test("parses dimension with px", () => {
    const result = parseCssVariables("--spacing: 16px;");
    expect(result).toMatchObject({
      spacing: {
        $type: "dimension",
        $value: {
          value: 16,
          unit: "px",
        },
      },
    });
  });

  test("parses dimension with rem", () => {
    const result = parseCssVariables("--spacing: 2.5rem;");
    expect(result).toMatchObject({
      spacing: {
        $type: "dimension",
        $value: {
          value: 2.5,
          unit: "rem",
        },
      },
    });
  });

  test("skips dimension with unsupported units", () => {
    const result = parseCssVariables("--spacing: 16em;");
    expect(result).toEqual({});
  });

  test("parses duration with ms", () => {
    const result = parseCssVariables("--duration: 300ms;");
    expect(result).toMatchObject({
      duration: {
        $type: "duration",
        $value: {
          value: 300,
          unit: "ms",
        },
      },
    });
  });

  test("parses duration with s", () => {
    const result = parseCssVariables("--duration: 1.5s;");
    expect(result).toMatchObject({
      duration: {
        $type: "duration",
        $value: {
          value: 1.5,
          unit: "s",
        },
      },
    });
  });

  test("parses cubic-bezier", () => {
    const result = parseCssVariables(
      "--easing: cubic-bezier(0.25, 0.1, 0.25, 1);",
    );
    expect(result).toMatchObject({
      easing: {
        $type: "cubicBezier",
        $value: [0.25, 0.1, 0.25, 1],
      },
    });
  });

  test("parses font-family as string", () => {
    expect(parseCssVariables('--font: "Arial", sans-serif;')).toMatchObject({
      font: {
        $type: "fontFamily",
        $value: ["Arial", "sans-serif"],
      },
    });
  });

  test("parses font-weight", () => {
    const result = parseCssVariables("--weight: 700;");
    expect(result).toMatchObject({
      weight: {
        $type: "fontWeight",
        $value: 700,
      },
    });
  });

  test("parses number", () => {
    const result = parseCssVariables("--count: 42;");
    expect(result).toMatchObject({
      count: {
        $type: "number",
        $value: 42,
      },
    });
  });

  test("parses negative number", () => {
    const result = parseCssVariables("--value: -3.14;");
    expect(result).toMatchObject({
      value: {
        $type: "number",
        $value: -3.14,
      },
    });
  });

  test("parses simple shadow", () => {
    const result = parseCssVariables(
      "--shadow: 0px 2px 4px 0px rgba(0, 0, 0, 0.1);",
    );
    expect(result.shadow).toMatchObject({
      $type: "shadow",
      $value: {
        offsetX: { value: 0, unit: "px" },
        offsetY: { value: 2, unit: "px" },
        blur: { value: 4, unit: "px" },
        spread: { value: 0, unit: "px" },
        color: expect.any(Object),
      },
    });
  });

  test("parses shadow with unitless zeros", () => {
    const result = parseCssVariables(
      "--shadow: inset 0 0 0 1px hsl(220 3% 15% / 10%);",
    );
    expect(result.shadow?.$value).toHaveProperty("inset", true);
  });

  test("parses inset shadow", () => {
    const result = parseCssVariables(
      "--shadow: inset 0px 2px 4px 0px rgba(0, 0, 0, 0.1);",
    );
    expect(result.shadow?.$value).toHaveProperty("inset", true);
  });

  test("parses multiple shadows", () => {
    const result = parseCssVariables(
      "--shadow: 0px 1px 2px rgba(0,0,0,0.1), 0px 4px 8px rgba(0,0,0,0.05);",
    );
    expect(result.shadow?.$value).toBeInstanceOf(Array);
    if (Array.isArray(result.shadow?.$value)) {
      expect(result.shadow.$value).toHaveLength(2);
    }
  });

  test("parses border", () => {
    const result = parseCssVariables("--border: 1px solid rgb(200, 200, 200);");
    expect(result.border).toMatchObject({
      $type: "border",
      $value: {
        width: { value: 1, unit: "px" },
        style: "solid",
        color: expect.any(Object),
      },
    });
  });

  test("parses transition", () => {
    const result = parseCssVariables(
      "--transition: 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;",
    );
    expect(result.transition).toMatchObject({
      $type: "transition",
      $value: {
        duration: { value: 300, unit: "ms" },
        timingFunction: [0.4, 0, 0.2, 1],
        delay: { value: 0, unit: "ms" },
      },
    });
  });

  test("parses gradient", () => {
    const result = parseCssVariables(
      "--gradient: linear-gradient(90deg, rgb(0, 102, 204) 0%, rgb(25, 128, 230) 100%);",
    );
    expect(result.gradient).toMatchObject({
      $type: "gradient",
      $value: [
        {
          color: expect.any(Object),
          position: 0,
        },
        {
          color: expect.any(Object),
          position: 1,
        },
      ],
    });
  });

  test("parses var() reference", () => {
    const result = parseCssVariables("--alias: var(--primary);");
    expect(result).toMatchObject({
      alias: {
        $value: "{primary}",
      },
    });
  });

  test("parses var() reference in shadow", () => {
    const result = parseCssVariables(
      "--shadow: 0px 2px 4px 0px var(--shadow-color);",
    );
    expect(result.shadow?.$value).toHaveProperty("color", "{shadow-color}");
  });

  test("parses var() reference in border", () => {
    const result = parseCssVariables(
      "--border: var(--border-width) solid var(--border-color);",
    );
    expect(result.border?.$value).toHaveProperty("width", "{border-width}");
    expect(result.border?.$value).toHaveProperty("color", "{border-color}");
  });

  test("parses var() reference in gradient", () => {
    const result = parseCssVariables(
      "--gradient: linear-gradient(90deg, var(--color1) 0%, var(--color2) 100%);",
    );
    if (Array.isArray(result.gradient?.$value)) {
      expect(result.gradient.$value[0]).toHaveProperty("color", "{color1}");
      expect(result.gradient.$value[1]).toHaveProperty("color", "{color2}");
    }
  });

  test("parses multiple variables", () => {
    const css = `
      :root {
        --primary: #0066cc;
        --spacing-sm: 8px;
        --spacing-lg: 16px;
        --duration-fast: 150ms;
        --shadow-sm: 0px 1px 2px rgba(0,0,0,0.1);
      }
    `;
    const result = parseCssVariables(css);
    expect(Object.keys(result)).toHaveLength(5);
    expect(result).toHaveProperty("primary");
    expect(result).toHaveProperty("spacing-sm");
    expect(result).toHaveProperty("spacing-lg");
    expect(result).toHaveProperty("duration-fast");
    expect(result).toHaveProperty("shadow-sm");
  });

  test("skips unparsable values", () => {
    const result = parseCssVariables(
      "--valid: 16px; --invalid: something-weird; --also-valid: 42;",
    );
    expect(result).toHaveProperty("valid");
    expect(result).toHaveProperty("also-valid");
    expect(result).not.toHaveProperty("invalid");
  });

  test("handles kebab-case variable names", () => {
    const result = parseCssVariables("--colors-primary-light: #0066cc;");
    expect(result).toHaveProperty("colors-primary-light");
  });

  test("integrates with parseDesignTokens", () => {
    const cssResult = parseCssVariables("--primary: #0066cc; --spacing: 16px;");
    const parsed = parseDesignTokens(cssResult);
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.errors).toHaveLength(0);
  });

  test("strips out comments", () => {
    expect(
      parseCssVariables(`
        --four: 4;
        /* values tier */
        --five: 5;
      `),
    ).toEqual({
      four: { $type: "number", $value: 4 },
      five: { $type: "number", $value: 5 },
    });
  });

  test("strips inline comments after declarations", () => {
    const result = parseCssVariables(`
      --primary: #ff0000; /* red color */
      --spacing: 16px; /* base spacing */
    `);
    expect(result.primary).toMatchObject({
      $type: "color",
      $value: { colorSpace: "srgb", hex: "#ff0000" },
    });
    expect(result.spacing).toEqual({
      $type: "dimension",
      $value: { value: 16, unit: "px" },
    });
  });

  test("strips multi-line comments", () => {
    expect(
      parseCssVariables(`
        --one: 1;
        /*
         * This is a multi-line comment
         * with multiple lines
         */
        --two: 2;
      `),
    ).toEqual({
      one: { $type: "number", $value: 1 },
      two: { $type: "number", $value: 2 },
    });
  });

  test("strips multiple comments in one line", () => {
    expect(
      parseCssVariables(
        "--one: 1; /* first */ --two: 2; /* second */ --three: 3;",
      ),
    ).toEqual({
      one: { $type: "number", $value: 1 },
      two: { $type: "number", $value: 2 },
      three: { $type: "number", $value: 3 },
    });
  });

  test("strips comments with asterisks inside", () => {
    expect(
      parseCssVariables(`
        --value: 10px; /* This is a comment with ** asterisks *** inside */
      `),
    ).toEqual({
      value: { $type: "dimension", $value: { value: 10, unit: "px" } },
    });
  });

  test("strips comments before :root", () => {
    const result = parseCssVariables(`
      /* Global design tokens */
      :root {
        --primary: #0066cc;
      }
    `);
    expect(result.primary).toMatchObject({
      $type: "color",
      $value: { colorSpace: "srgb", hex: "#0066cc" },
    });
  });

  test("strips comments inside :root", () => {
    const result = parseCssVariables(`
      :root {
        /* Colors section */
        --primary: #0066cc;
        /* Spacing section */
        --spacing: 8px;
      }
    `);
    expect(result.primary).toMatchObject({
      $type: "color",
      $value: { colorSpace: "srgb", hex: "#0066cc" },
    });
    expect(result.spacing).toEqual({
      $type: "dimension",
      $value: { value: 8, unit: "px" },
    });
  });

  test("strips empty comments", () => {
    expect(
      parseCssVariables(`
        --one: 1; /**/
        /**/ --two: 2;
      `),
    ).toEqual({
      one: { $type: "number", $value: 1 },
      two: { $type: "number", $value: 2 },
    });
  });

  test("strips comments with special characters", () => {
    expect(
      parseCssVariables(`
        --value: 16px; /* TODO: update this @author John (2024) */
      `),
    ).toEqual({
      value: { $type: "dimension", $value: { value: 16, unit: "px" } },
    });
  });

  test("handles complex values with comments", () => {
    expect(
      parseCssVariables(`
        /* Shadow definition */
        --shadow: 0px 2px 4px 0px rgba(0, 0, 0, 0.1); /* subtle shadow */
        /* Border definition */
        --border: 1px solid #ccc; /* gray border */
      `),
    ).toEqual({
      shadow: {
        $type: "shadow",
        $value: {
          offsetX: { value: 0, unit: "px" },
          offsetY: { value: 2, unit: "px" },
          blur: { value: 4, unit: "px" },
          spread: { value: 0, unit: "px" },
          color: expect.any(Object),
        },
      },
      border: {
        $type: "border",
        $value: {
          width: { value: 1, unit: "px" },
          style: "solid",
          color: expect.any(Object),
        },
      },
    });
  });

  test("strips comments between property and value", () => {
    // Comments between property and value should be stripped
    // though this is unusual CSS
    expect(
      parseCssVariables(`
        --value /* weird comment */ : 42;
      `),
    ).toEqual({
      value: { $type: "number", $value: 42 },
    });
  });
});

describe("generateCssVariables with modifiers and contexts", () => {
  test("skips modifier nodes and their entire subtrees", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "base",
          sources: [
            {
              baseColor: {
                $type: "color",
                $value: { colorSpace: "srgb", components: [1, 0, 0] },
              },
            },
          ],
        },
        {
          type: "modifier",
          name: "theme",
          description: "Color theme",
          contexts: {
            light: [
              {
                primary: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 1] },
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.errors).toHaveLength(0);
    const css = generateCssVariables(nodesToMap(result.nodes));

    // Should contain token from set
    expect(css).toContain("--base-color: rgb(100% 0% 0%);");

    // Should NOT contain token from modifier's context (entire subtree skipped)
    expect(css).not.toContain("--primary:");
    expect(css).not.toContain("theme");
    expect(css).not.toContain("light");
  });

  test("skips tokens in all modifier contexts", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "theme",
          contexts: {
            light: [
              {
                background: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [1, 1, 1] },
                },
              },
            ],
            dark: [
              {
                background: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 0] },
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.errors).toHaveLength(0);
    const css = generateCssVariables(nodesToMap(result.nodes));

    // Should NOT contain background token from any context
    expect(css).toContain(":root {\n}");
  });

  test("skips nested groups and tokens under modifier contexts", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "contrast",
          contexts: {
            high: [
              {
                colors: {
                  $type: "color",
                  text: {
                    $value: { colorSpace: "srgb", components: [0, 0, 0] },
                  },
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.errors).toHaveLength(0);
    const css = generateCssVariables(nodesToMap(result.nodes));

    // Should NOT contain any token from modifier context (entire subtree skipped)
    expect(css).toContain(":root {\n}");
  });

  test("skips tokens from multiple modifiers", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "theme",
          contexts: {
            light: [
              {
                background: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [1, 1, 1] },
                },
              },
            ],
          },
        },
        {
          type: "modifier",
          name: "contrast",
          contexts: {
            high: [
              {
                text: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 0] },
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.errors).toHaveLength(0);
    const css = generateCssVariables(nodesToMap(result.nodes));

    // Should NOT contain tokens from any modifier
    expect(css).toContain(":root {\n}");
  });
});
