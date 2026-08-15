import { test, expect, describe } from "vitest";
import { parseDesignTokens, serializeDesignTokens } from "./tokens";
import type { TreeNode } from "./store";
import type { GroupMeta, TokenMeta } from "./state.svelte";

// Helper to convert array to Map
const nodesToMap = (nodes: TreeNode<GroupMeta | TokenMeta>[]) => {
  const map = new Map<string, TreeNode<GroupMeta | TokenMeta>>();
  for (const node of nodes) {
    map.set(node.nodeId, node);
  }
  return map;
};

describe("parseDesignTokens", () => {
  test("returns empty nodes and errors for non-object input", () => {
    const result = parseDesignTokens(null);
    expect(result.nodes).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  test("parses basic token at root level", () => {
    const result = parseDesignTokens({
      myToken: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes[0].meta).toBeDefined();
  });

  test("parses basic group structure", () => {
    const result = parseDesignTokens({
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
    });
    expect(result.nodes).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  test("inherits type through nested groups", () => {
    const result = parseDesignTokens({
      color: {
        $type: "color",
        primitive: {
          blue: {
            "500": { $value: { colorSpace: "srgb", components: [0, 0, 1] } },
          },
        },
      },
    });
    expect(result.errors).toEqual([]);
    expect(result.nodes).toHaveLength(4);
  });

  test("excludes invalid token with bad name from tree", () => {
    const result = parseDesignTokens({
      ".invalid": {
        $type: "number",
        $value: 123,
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("must not contain '.'");
  });

  test("excludes token with forbidden characters from tree", () => {
    const result = parseDesignTokens({
      "bad{name}": {
        $type: "number",
        $value: 123,
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  test("handles $root token in group", () => {
    const result = parseDesignTokens({
      colors: {
        $type: "color",
        $root: {
          $value: { colorSpace: "srgb", components: [1, 1, 1] },
        },
      },
    });
    expect(result.nodes).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects names containing '{'", () => {
    const result = parseDesignTokens({
      "bad{name": {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("must not contain '{'");
  });

  test("rejects names containing '}'", () => {
    const result = parseDesignTokens({
      "bad}name": {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("must not contain '}'");
  });

  test("rejects names containing '.'", () => {
    const result = parseDesignTokens({
      "bad.name": {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("must not contain '.'");
  });

  test("rejects group names containing forbidden characters", () => {
    const result = parseDesignTokens({
      colors: {
        $type: "color",
        "bad.primary": {
          $value: { colorSpace: "srgb", components: [1, 0, 0] },
        },
      },
    });
    // The group "colors" is valid, but the token "bad.primary" is invalid
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("must not contain '.'");
  });

  test("ignores unknown fields at root level starting with $", () => {
    const result = parseDesignTokens({
      $extensions: { custom: "value" },
      $metadata: { version: "1.0" },
      $custom: { anything: true },
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [1, 0, 0] },
        },
      },
    });
    expect(result.nodes).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts valid reference with multiple segments", () => {
    const result = parseDesignTokens({
      semantic: {
        primary: {
          $type: "color",
          $value: "{colors.primary.base}",
        },
      },
      colors: {
        primary: {
          base: {
            $type: "color",
            $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
          },
        },
      },
    });
    expect(result.errors).toHaveLength(0);
    expect(result.nodes.length).toBeGreaterThan(0);
  });

  test("accepts reference with $root segment", () => {
    const result = parseDesignTokens({
      colors: {
        $type: "color",
        $root: {
          $value: { colorSpace: "srgb", components: [1, 1, 1] },
        },
        derived: {
          $value: "{colors.$root}",
        },
      },
    });
    expect(result.errors).toHaveLength(0);
    expect(result.nodes.length).toBeGreaterThan(0);
  });

  test("accepts reference with all valid segment names", () => {
    const result = parseDesignTokens({
      semantic: {
        primary: {
          $type: "color",
          $value: "{colors.primary}",
        },
      },
      colors: {
        primary: {
          $type: "color",
          $value: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
        },
      },
    });
    expect(result.errors).toHaveLength(0);
    expect(result.nodes.length).toBeGreaterThan(0);
  });

  test("rejects reference with segment starting with '$' (except $root)", () => {
    const result = parseDesignTokens({
      semantic: {
        primary: {
          $type: "color",
          $value: "{$invalid.name}",
        },
      },
    });
    // The semantic group is created but primary token is rejected due to invalid reference
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });

  test("rejects reference with segment containing forbidden character", () => {
    const result = parseDesignTokens({
      semantic: {
        primary: {
          $type: "color",
          $value: "{colors.bad.name.here}",
        },
      },
    });
    // The semantic group is created but primary token is rejected due to invalid reference
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });

  test("rejects reference missing opening brace", () => {
    const result = parseDesignTokens({
      semantic: {
        primary: {
          $type: "color",
          $value: "colors.primary}",
        },
      },
    });
    // The semantic group is created but primary token is rejected due to invalid reference
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });

  test("rejects reference missing closing brace", () => {
    const result = parseDesignTokens({
      semantic: {
        primary: {
          $type: "color",
          $value: "{colors.primary",
        },
      },
    });
    // The semantic group is created but primary token is rejected due to invalid reference
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });

  test("excludes token without determinable type", () => {
    const result = parseDesignTokens({
      noType: {
        // valid number token value
        $value: 5,
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe("Token type cannot be determined");
  });

  test("ignores children on token", () => {
    const result = parseDesignTokens({
      bad: {
        $type: "number",
        $value: 123,
        child: { $value: 456 },
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].meta).toEqual({
      nodeType: "token",
      name: "bad",
      type: "number",
      value: 123,
    });
    expect(result.errors).toHaveLength(0);
  });

  test("excludes invalid dimension from tree", () => {
    const result = parseDesignTokens({
      spacing: {
        $type: "dimension",
        $value: { value: 16, unit: "em" },
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  test("preserves description and extensions", () => {
    const result = parseDesignTokens({
      myToken: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0] },
        $description: "A red token",
        $extensions: { "org.example": { custom: "data" } },
      },
    });
    const meta = result.nodes[0].meta;
    expect(meta.description).toBe("A red token");
    expect(meta.extensions).toEqual({ "org.example": { custom: "data" } });
  });

  test("accepts valid color value", () => {
    const result = parseDesignTokens({
      myColor: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes[0].meta).toEqual(
      expect.objectContaining({
        value: { colorSpace: "srgb", components: [1, 0, 0] },
      }),
    );
  });

  test("rejects invalid color value", () => {
    const result = parseDesignTokens({
      myColor: {
        $type: "color",
        $value: { colorSpace: "srgb", components: ["red", "green", "blue"] },
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  test("accepts valid dimension value", () => {
    const result = parseDesignTokens({
      spacing: {
        $type: "dimension",
        $value: { value: 16, unit: "px" },
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes[0].meta).toEqual(
      expect.objectContaining({
        value: { value: 16, unit: "px" },
      }),
    );
  });

  test("accepts valid duration value", () => {
    const result = parseDesignTokens({
      transition: {
        $type: "duration",
        $value: { value: 300, unit: "ms" },
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes[0].meta).toEqual(
      expect.objectContaining({
        value: { value: 300, unit: "ms" },
      }),
    );
  });

  test("accepts valid cubicBezier value", () => {
    const result = parseDesignTokens({
      easing: {
        $type: "cubicBezier",
        $value: [0.25, 0.1, 0.25, 1],
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes[0].meta).toEqual(
      expect.objectContaining({
        value: [0.25, 0.1, 0.25, 1],
      }),
    );
  });

  test("accepts valid number value", () => {
    const result = parseDesignTokens({
      myNumber: {
        $type: "number",
        $value: 42,
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes[0].meta).toEqual(
      expect.objectContaining({
        value: 42,
      }),
    );
  });

  test("rejects invalid number value", () => {
    const result = parseDesignTokens({
      myNumber: {
        $type: "number",
        $value: true,
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  test("accepts valid fontFamily value", () => {
    const result = parseDesignTokens({
      myFontFamily: {
        $type: "fontFamily",
        $value: "Arial, sans-serif",
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes[0].meta).toEqual(
      expect.objectContaining({
        value: "Arial, sans-serif",
      }),
    );
  });

  test("accepts valid fontWeight value", () => {
    const result = parseDesignTokens({
      myFontWeight: {
        $type: "fontWeight",
        $value: 600,
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes[0].meta).toEqual(
      expect.objectContaining({
        value: 600,
      }),
    );
  });

  test("accepts valid transition value", () => {
    const result = parseDesignTokens({
      myTransition: {
        $type: "transition",
        $value: {
          duration: { value: 300, unit: "ms" },
          delay: { value: 100, unit: "ms" },
          timingFunction: [0.25, 0.1, 0.25, 1],
        },
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes[0].meta).toEqual(
      expect.objectContaining({
        value: expect.objectContaining({
          duration: { value: 300, unit: "ms" },
        }),
      }),
    );
  });

  test("accepts valid stroke value", () => {
    const result = parseDesignTokens({
      myStroke: {
        $type: "strokeStyle",
        $value: "solid",
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes[0].meta).toEqual(
      expect.objectContaining({
        value: "solid",
      }),
    );
  });

  test("rejects invalid stroke value with missing color", () => {
    const result = parseDesignTokens({
      myStroke: {
        $type: "stroke",
        $value: {
          width: { value: 2, unit: "px" },
        },
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  test("accepts valid shadow value", () => {
    const result = parseDesignTokens({
      myShadow: {
        $type: "shadow",
        $value: {
          color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.2 },
          offsetX: { value: 0, unit: "px" },
          offsetY: { value: 4, unit: "px" },
          blur: { value: 8, unit: "px" },
          spread: { value: 0, unit: "px" },
          inset: false,
        },
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes[0].meta).toEqual(
      expect.objectContaining({
        value: [
          {
            color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.2 },
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 4, unit: "px" },
            blur: { value: 8, unit: "px" },
            spread: { value: 0, unit: "px" },
            inset: false,
          },
        ],
      }),
    );
  });

  test("rejects invalid shadow value with missing blur", () => {
    const result = parseDesignTokens({
      myShadow: {
        $type: "shadow",
        $value: {
          color: { colorSpace: "srgb", components: [0, 0, 0] },
          offsetX: { value: 0, unit: "px" },
          offsetY: { value: 4, unit: "px" },
        },
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  test("accepts valid border value", () => {
    const result = parseDesignTokens({
      myBorder: {
        $type: "border",
        $value: {
          color: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
          width: { value: 1, unit: "px" },
          style: "solid",
        },
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes[0].meta).toEqual(
      expect.objectContaining({
        value: {
          color: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
          width: { value: 1, unit: "px" },
          style: "solid",
        },
      }),
    );
  });

  test("accepts valid typography value", () => {
    const result = parseDesignTokens({
      myTypography: {
        $type: "typography",
        $value: {
          fontFamily: "sans-serif",
          fontSize: { value: 16, unit: "px" },
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: { value: 0, unit: "px" },
        },
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes[0].meta).toEqual(
      expect.objectContaining({
        value: {
          fontFamily: "sans-serif",
          fontSize: { value: 16, unit: "px" },
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: { value: 0, unit: "px" },
        },
      }),
    );
  });

  test("rejects invalid typography value with missing fontFamily", () => {
    const result = parseDesignTokens({
      myTypography: {
        $type: "typography",
        $value: {
          fontSize: { value: 16, unit: "px" },
          fontWeight: 400,
          lineHeight: 1.5,
        },
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  test("accepts valid gradient value", () => {
    const result = parseDesignTokens({
      myGradient: {
        $type: "gradient",
        $value: [
          {
            color: { colorSpace: "srgb", components: [1, 0, 0] },
            position: 0,
          },
          {
            color: { colorSpace: "srgb", components: [0, 0, 1] },
            position: 1,
          },
        ],
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes[0].meta).toEqual(
      expect.objectContaining({
        value: [
          {
            color: { colorSpace: "srgb", components: [1, 0, 0] },
            position: 0,
          },
          {
            color: { colorSpace: "srgb", components: [0, 0, 1] },
            position: 1,
          },
        ],
      }),
    );
  });

  test("rejects invalid gradient value with invalid stop position", () => {
    const result = parseDesignTokens({
      myGradient: {
        $type: "gradient",
        $value: {
          type: "linear",
          stops: [
            {
              color: { colorSpace: "srgb", components: [1, 0, 0] },
              position: 1.5,
            },
          ],
        },
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  test("accepts gradient value with radial type", () => {
    const result = parseDesignTokens({
      myRadialGradient: {
        $type: "gradient",
        $value: [
          {
            color: { colorSpace: "srgb", components: [1, 1, 1] },
            position: 0,
          },
        ],
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects gradient with invalid type", () => {
    const result = parseDesignTokens({
      myGradient: {
        $type: "gradient",
        $value: {
          type: "conic",
          stops: [
            {
              color: { colorSpace: "srgb", components: [1, 0, 0] },
              position: 0,
            },
          ],
        },
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  test("parses token with $value containing reference", () => {
    const result = parseDesignTokens({
      semantic: {
        brand: {
          $type: "color",
          $value: "{colors.primary}",
        },
      },
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
    });
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toHaveLength(4);
    const brandToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "brand",
    );
    expect(brandToken?.meta.nodeType).toBe("token");
    if (brandToken?.meta.nodeType === "token") {
      expect(brandToken.meta).toEqual(
        expect.objectContaining({
          nodeType: "token",
          name: "brand",
          type: "color",
        }),
      );
      // Value should be TokenRef with node ID
      expect(brandToken.meta.value).toEqual(
        expect.objectContaining({
          ref: expect.any(String),
        }),
      );
    }
  });

  test("allows token with $value reference but no $type", () => {
    const result = parseDesignTokens({
      semantic: {
        brand: {
          $value: "{colors.primary}",
        },
      },
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
    });
    expect(result.errors).toEqual([]);
    const brandToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "brand",
    );
    expect(brandToken?.meta.nodeType).toBe("token");
    if (brandToken?.meta.nodeType === "token") {
      expect(brandToken.meta).toEqual(
        expect.objectContaining({
          nodeType: "token",
          name: "brand",
          type: "color", // Type should be resolved from referenced token
        }),
      );
      // Value should be TokenRef with node ID
      expect(brandToken.meta.value).toEqual(
        expect.objectContaining({
          ref: expect.any(String),
        }),
      );
    }
  });

  test("resolves type recursively for chained token aliases", () => {
    const result = parseDesignTokens({
      aliases: {
        mainBrand: {
          $value: "{semantic.brand}",
        },
      },
      semantic: {
        brand: {
          $value: "{colors.primary}",
        },
      },
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
    });
    expect(result.errors).toHaveLength(0);

    const brandToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "brand",
    );
    expect(brandToken?.meta?.type).toBe("color");

    const mainBrandToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "mainBrand",
    );
    // mainBrand should resolve type through the chain: mainBrand -> brand -> colors.primary
    expect(mainBrandToken?.meta?.type).toBe("color");
  });

  test("allow numeric segment names", () => {
    const result = parseDesignTokens({
      blue: {
        $type: "color",
        "500": {
          $value: { colorSpace: "srgb", components: [0, 0, 1] },
        },
        alias: { $value: "{blue.500}" },
      },
    });
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toHaveLength(3);
  });

  test("accepts shadow with component aliases", () => {
    const result = parseDesignTokens({
      colors: {
        $type: "color",
        black: {
          $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.2 },
        },
      },
      spacing: {
        $type: "dimension",
        md: {
          $value: { value: 4, unit: "px" },
        },
      },
      shadows: {
        $type: "shadow",
        primary: {
          $value: {
            color: "{colors.black}",
            offsetX: "{spacing.md}",
            offsetY: "{spacing.md}",
            blur: { value: 8, unit: "px" },
            spread: { value: 0, unit: "px" },
            inset: false,
          },
        },
      },
    });
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toHaveLength(6);
    const shadowToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "primary",
    );
    expect(shadowToken?.meta).toEqual(
      expect.objectContaining({
        nodeType: "token",
        name: "primary",
        type: "shadow",
        value: [
          expect.objectContaining({
            color: expect.objectContaining({ ref: expect.any(String) }),
            offsetX: expect.objectContaining({ ref: expect.any(String) }),
            offsetY: expect.objectContaining({ ref: expect.any(String) }),
            blur: { value: 8, unit: "px" },
          }),
        ],
      }),
    );
  });

  test("accepts border with component aliases", () => {
    const result = parseDesignTokens({
      colors: {
        $type: "color",
        gray: {
          $value: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
        },
      },
      spacing: {
        $type: "dimension",
        sm: {
          $value: { value: 1, unit: "px" },
        },
      },
      borders: {
        $type: "border",
        default: {
          $value: {
            color: "{colors.gray}",
            width: "{spacing.sm}",
            style: "solid",
          },
        },
      },
    });
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toHaveLength(6);
    const borderToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "default",
    );
    expect(borderToken?.meta).toEqual(
      expect.objectContaining({
        nodeType: "token",
        name: "default",
        type: "border",
        value: expect.objectContaining({
          color: expect.objectContaining({ ref: expect.any(String) }),
          width: expect.objectContaining({ ref: expect.any(String) }),
          style: "solid",
        }),
      }),
    );
  });

  test("accepts typography with component aliases", () => {
    const result = parseDesignTokens({
      fonts: {
        $type: "fontFamily",
        body: {
          $value: "sans-serif",
        },
      },
      spacing: {
        $type: "dimension",
        md: {
          $value: { value: 16, unit: "px" },
        },
      },
      typography: {
        $type: "typography",
        base: {
          $value: {
            fontFamily: "{fonts.body}",
            fontSize: "{spacing.md}",
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: { value: 0, unit: "px" },
          },
        },
      },
    });
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toHaveLength(6);
    const typographyToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "base",
    );
    expect(typographyToken?.meta).toEqual(
      expect.objectContaining({
        nodeType: "token",
        name: "base",
        type: "typography",
        value: expect.objectContaining({
          fontFamily: expect.objectContaining({ ref: expect.any(String) }),
          fontSize: expect.objectContaining({ ref: expect.any(String) }),
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: { value: 0, unit: "px" },
        }),
      }),
    );
  });

  test("accepts transition with component aliases", () => {
    const result = parseDesignTokens({
      durations: {
        $type: "duration",
        quick: {
          $value: { value: 300, unit: "ms" },
        },
        slowDelay: {
          $value: { value: 100, unit: "ms" },
        },
      },
      easing: {
        $type: "cubicBezier",
        ease: {
          $value: [0.25, 0.1, 0.25, 1],
        },
      },
      transitions: {
        $type: "transition",
        smooth: {
          $value: {
            duration: "{durations.quick}",
            delay: "{durations.slowDelay}",
            timingFunction: "{easing.ease}",
          },
        },
      },
    });
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toHaveLength(7);
    const transitionToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "smooth",
    );
    expect(transitionToken?.meta).toEqual(
      expect.objectContaining({
        nodeType: "token",
        name: "smooth",
        type: "transition",
        value: expect.objectContaining({
          duration: expect.objectContaining({ ref: expect.any(String) }),
          delay: expect.objectContaining({ ref: expect.any(String) }),
          timingFunction: expect.objectContaining({ ref: expect.any(String) }),
        }),
      }),
    );
  });

  test("accepts gradient with component aliases", () => {
    const result = parseDesignTokens({
      colors: {
        $type: "color",
        red: {
          $value: { colorSpace: "srgb", components: [1, 0, 0] },
        },
        blue: {
          $value: { colorSpace: "srgb", components: [0, 0, 1] },
        },
      },
      gradients: {
        $type: "gradient",
        redToBlue: {
          $value: [
            {
              color: "{colors.red}",
              position: 0,
            },
            {
              color: "{colors.blue}",
              position: 1,
            },
          ],
        },
      },
    });
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toHaveLength(5);
    const gradientToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "redToBlue",
    );
    expect(gradientToken?.meta.nodeType).toBe("token");
    if (gradientToken?.meta.nodeType === "token") {
      expect(gradientToken.meta).toEqual(
        expect.objectContaining({
          nodeType: "token",
          name: "redToBlue",
          type: "gradient",
        }),
      );
      const gradientValue = gradientToken.meta.value as Array<{
        color: string | object;
        position: number;
      }>;
      expect(Array.isArray(gradientValue)).toBe(true);
      expect(gradientValue[0]).toEqual(
        expect.objectContaining({
          color: expect.objectContaining({ ref: expect.any(String) }),
          position: 0,
        }),
      );
      expect(gradientValue[1]).toEqual(
        expect.objectContaining({
          color: expect.objectContaining({ ref: expect.any(String) }),
          position: 1,
        }),
      );
    }
  });

  test("catches validation errors during token type parsing", () => {
    const result = parseDesignTokens({
      weight: {
        $type: "fontWeight",
        $value: "900",
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toEqual([
      {
        path: "weight",
        message: "Token type cannot be determined",
      },
    ]);
  });

  test("allows valid tokens even when other tokens have validation errors", () => {
    const result = parseDesignTokens({
      validColor: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
      invalidBorder: {
        $type: "border",
        $value: {
          color: "not-a-color",
          width: { value: 1, unit: "px" },
          style: "solid",
        },
      },
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].meta.name).toBe("validColor");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe("invalidBorder");
  });

  test("materializes token value JSON references and serializes inline values", () => {
    const result = parseDesignTokens({
      numbers: {
        $type: "number",
        base: { $value: 4 },
        copied: { $value: { $ref: "#/numbers/base/$value" } },
      },
    });

    expect(result.errors).toEqual([]);
    expect(
      result.nodes.find(
        (node) => node.meta.nodeType === "token" && node.meta.name === "copied",
      )?.meta,
    ).toEqual(
      expect.objectContaining({ nodeType: "token", type: "number", value: 4 }),
    );
    expect(serializeDesignTokens(nodesToMap(result.nodes))).toEqual({
      numbers: {
        $type: "number",
        base: { $value: 4 },
        copied: { $value: 4 },
      },
    });
  });

  test("materializes composite property JSON references and serializes inline values", () => {
    const result = parseDesignTokens({
      dimensions: {
        $type: "dimension",
        thin: { $value: { value: 1, unit: "px" } },
      },
      borders: {
        $type: "border",
        subtle: {
          $value: {
            color: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
            width: { $ref: "#/dimensions/thin/$value" },
            style: "solid",
          },
        },
      },
    });

    expect(result.errors).toEqual([]);
    expect(
      result.nodes.find(
        (node) => node.meta.nodeType === "token" && node.meta.name === "subtle",
      )?.meta,
    ).toEqual(
      expect.objectContaining({
        nodeType: "token",
        type: "border",
        value: {
          color: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
          width: { value: 1, unit: "px" },
          style: "solid",
        },
      }),
    );
    expect(serializeDesignTokens(nodesToMap(result.nodes))).toEqual({
      dimensions: {
        $type: "dimension",
        thin: { $value: { value: 1, unit: "px" } },
      },
      borders: {
        $type: "border",
        subtle: {
          $value: {
            color: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
            width: { value: 1, unit: "px" },
            style: "solid",
          },
        },
      },
    });
  });

  test("preserves opaque extension references while materializing token values", () => {
    const result = parseDesignTokens({
      base: { $type: "number", $value: 4 },
      copied: {
        $type: "number",
        $value: { $ref: "#/base/$value" },
        $extensions: {
          "org.example": { metadata: { $ref: "#/base/$value" } },
        },
      },
    });

    expect(result.errors).toEqual([]);
    expect(serializeDesignTokens(nodesToMap(result.nodes))).toEqual({
      base: { $type: "number", $value: 4 },
      copied: {
        $type: "number",
        $value: 4,
        $extensions: {
          "org.example": { metadata: { $ref: "#/base/$value" } },
        },
      },
    });
  });

  test("merges JSON reference errors while retaining valid parsed tokens", () => {
    const result = parseDesignTokens({
      valid: { $type: "number", $value: 4 },
      broken: {
        $type: "number",
        $value: { $ref: "#/missing/$value" },
      },
    });

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].meta.name).toBe("valid");
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          path: "/broken/$value/$ref",
          message: 'JSON Pointer target not found: "#/missing/$value"',
        },
        {
          path: "broken",
          message: "✖ Invalid input",
        },
      ]),
    );
  });

  test("reports external JSON references without mutating the input", () => {
    const input = {
      valid: { $type: "number", $value: 4 },
      external: {
        $type: "number",
        $value: { $ref: "tokens.json#/numbers/base/$value" },
      },
    };
    const original = structuredClone(input);

    const result = parseDesignTokens(input);

    expect(result.errors).toContainEqual({
      path: "/external/$value/$ref",
      message:
        'External JSON reference is not supported: "tokens.json#/numbers/base/$value"',
    });
    expect(input).toEqual(original);
  });

  test("stores group $extends as a reference to the target group", () => {
    const result = parseDesignTokens({
      base: {
        value: { $type: "number", $value: 1 },
      },
      derived: {
        $extends: "{base}",
      },
    });

    expect(result.errors).toEqual([]);
    const base = result.nodes.find((node) => node.meta.name === "base");
    const derived = result.nodes.find((node) => node.meta.name === "derived");
    expect(base?.meta.nodeType).toBe("token-group");
    expect(derived?.meta).toEqual(
      expect.objectContaining({
        nodeType: "token-group",
        extends: { ref: base?.nodeId },
      }),
    );
  });

  test("reports a missing $extends group target", () => {
    const result = parseDesignTokens({
      derived: { $extends: "{missing}" },
    });

    expect(result.errors).toContainEqual({
      path: "derived",
      message: 'Group extension target not found: "{missing}"',
    });
  });

  test("rejects a token as an $extends target", () => {
    const result = parseDesignTokens({
      base: { $type: "number", $value: 1 },
      derived: { $extends: "{base}" },
    });

    expect(result.errors).toContainEqual({
      path: "derived",
      message: 'Group extension target must be a group: "{base}"',
    });
  });

  test("reports group extension cycles", () => {
    const result = parseDesignTokens({
      first: { $extends: "{second}" },
      second: { $extends: "{first}" },
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "first",
          message: expect.stringContaining("Circular group extension"),
        }),
        expect.objectContaining({
          path: "second",
          message: expect.stringContaining("Circular group extension"),
        }),
      ]),
    );
  });
});

describe("serializeDesignTokens", () => {
  test("serializes empty nodes to empty object", () => {
    const result = serializeDesignTokens(new Map());
    expect(result).toEqual({});
  });

  test("serializes basic token at root level", () => {
    const input = {
      myToken: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("serializes basic group structure", () => {
    const input = {
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("serializes nested groups", () => {
    const input = {
      design: {
        colors: {
          $type: "color",
          primary: {
            $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
          },
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("preserves token description and extensions", () => {
    const input = {
      myToken: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0] },
        $description: "A red token",
        $extensions: { "org.example": { custom: "data" } },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("preserves group description and extensions", () => {
    const input = {
      colors: {
        $type: "color",
        $description: "Color tokens",
        $extensions: { "org.example": { category: "semantic" } },
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("serializes $extends using the target group's current path", () => {
    const parsed = parseDesignTokens({
      original: {
        base: {
          value: { $type: "number", $value: 1 },
        },
      },
      destination: {},
      derived: { $extends: "{original.base}" },
    });
    const target = parsed.nodes.find((node) => node.meta.name === "base");
    const destination = parsed.nodes.find(
      (node) => node.meta.name === "destination",
    );
    if (!target || !destination) throw new Error("Expected groups to parse");

    target.meta.name = "renamed";
    target.parentId = destination.nodeId;

    expect(serializeDesignTokens(nodesToMap(parsed.nodes))).toEqual({
      original: {},
      destination: {
        renamed: {
          value: { $type: "number", $value: 1 },
        },
      },
      derived: { $extends: "{destination.renamed}" },
    });
  });

  test("rejects a token $extends target during serialization", () => {
    const parsed = parseDesignTokens({
      base: { value: { $type: "number", $value: 1 } },
      derived: {},
    });
    const target = parsed.nodes.find(
      (node) => node.meta.nodeType === "token" && node.meta.name === "value",
    );
    const derived = parsed.nodes.find(
      (node) =>
        node.meta.nodeType === "token-group" && node.meta.name === "derived",
    );
    if (!target || derived?.meta.nodeType !== "token-group") {
      throw new Error("Expected token and group to parse");
    }
    derived.meta.extends = { ref: target.nodeId };

    expect(() => serializeDesignTokens(nodesToMap(parsed.nodes))).toThrow(
      'Group "derived" cannot extend token "base.value"',
    );
  });

  test("rejects a missing $extends target during serialization", () => {
    const parsed = parseDesignTokens({ derived: {} });
    const derived = parsed.nodes[0];
    if (derived?.meta.nodeType !== "token-group") {
      throw new Error("Expected group to parse");
    }
    derived.meta.extends = { ref: "missing-group" };

    expect(() => serializeDesignTokens(nodesToMap(parsed.nodes))).toThrow(
      'Group "derived" extension target "missing-group" not found',
    );
  });

  test("rejects a self-referencing $extends during serialization", () => {
    const parsed = parseDesignTokens({ derived: {} });
    const derived = parsed.nodes[0];
    if (derived?.meta.nodeType !== "token-group") {
      throw new Error("Expected group to parse");
    }
    derived.meta.extends = { ref: derived.nodeId };

    expect(() => serializeDesignTokens(nodesToMap(parsed.nodes))).toThrow(
      "Circular group extension detected: derived -> derived",
    );
  });

  test("rejects a three-group $extends cycle during serialization", () => {
    const parsed = parseDesignTokens({ first: {}, second: {}, third: {} });
    const groups = new Map(
      parsed.nodes.map((node) => [node.meta.name, node] as const),
    );
    const first = groups.get("first");
    const second = groups.get("second");
    const third = groups.get("third");
    if (
      first?.meta.nodeType !== "token-group" ||
      second?.meta.nodeType !== "token-group" ||
      third?.meta.nodeType !== "token-group"
    ) {
      throw new Error("Expected groups to parse");
    }
    first.meta.extends = { ref: second.nodeId };
    second.meta.extends = { ref: third.nodeId };
    third.meta.extends = { ref: first.nodeId };

    expect(() => serializeDesignTokens(nodesToMap(parsed.nodes))).toThrow(
      "Circular group extension detected: first -> second -> third -> first",
    );
  });

  test("preserves deprecated flags", () => {
    const input = {
      oldToken: {
        $type: "number",
        $value: 123,
        $deprecated: "Use newToken instead",
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("preserves boolean deprecated", () => {
    const input = {
      oldToken: {
        $type: "number",
        $value: 123,
        $deprecated: true,
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("omits type when inherited from parent", () => {
    const input = {
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
        secondary: {
          $value: { colorSpace: "srgb", components: [0.8, 0.2, 0.5] },
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("includes type when different from parent", () => {
    const input = {
      mixed: {
        $type: "color",
        color1: {
          $value: { colorSpace: "srgb", components: [1, 0, 0] },
        },
        number1: {
          $type: "number",
          $value: 42,
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("handles $root token in group", () => {
    const input = {
      colors: {
        $type: "color",
        $root: {
          $value: { colorSpace: "srgb", components: [1, 1, 1] },
        },
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0, 1] },
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("serializes all value types correctly", () => {
    const input = {
      color: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
      dimension: {
        $type: "dimension",
        $value: { value: 16, unit: "px" },
      },
      duration: {
        $type: "duration",
        $value: { value: 300, unit: "ms" },
      },
      cubicBezier: {
        $type: "cubicBezier",
        $value: [0.25, 0.1, 0.25, 1],
      },
      number: {
        $type: "number",
        $value: 1.5,
      },
      fontFamily: {
        $type: "fontFamily",
        $value: "Arial, sans-serif",
      },
      fontWeight: {
        $type: "fontWeight",
        $value: 600,
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("serializes complex token types", () => {
    const input = {
      shadow: {
        $type: "shadow",
        $value: {
          color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.2 },
          offsetX: { value: 0, unit: "px" },
          offsetY: { value: 4, unit: "px" },
          blur: { value: 8, unit: "px" },
          spread: { value: 0, unit: "px" },
          inset: false,
        },
      },
      border: {
        $type: "border",
        $value: {
          color: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
          width: { value: 1, unit: "px" },
          style: "solid",
        },
      },
      typography: {
        $type: "typography",
        $value: {
          fontFamily: "Inter, sans-serif",
          fontSize: { value: 16, unit: "px" },
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: { value: 0, unit: "px" },
        },
      },
      gradient: {
        $type: "gradient",
        $value: [
          {
            color: { colorSpace: "srgb", components: [1, 0, 0] },
            position: 0,
          },
          {
            color: { colorSpace: "srgb", components: [0, 0, 1] },
            position: 1,
          },
        ],
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("round-trip preserves structure", () => {
    const input = {
      colors: {
        $type: "color",
        $description: "Color palette",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
          $description: "Primary color",
        },
        secondary: {
          $value: { colorSpace: "srgb", components: [0.8, 0.2, 0.5] },
        },
      },
      spacing: {
        $type: "dimension",
        sm: {
          $value: { value: 8, unit: "px" },
        },
        md: {
          $value: { value: 16, unit: "px" },
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);

    // Parse again and verify consistency
    const parsed2 = parseDesignTokens(serialized);
    const serialized2 = serializeDesignTokens(nodesToMap(parsed2.nodes));
    expect(serialized2).toEqual(input);
  });

  test("preserves order of tokens and groups", () => {
    const input = {
      first: {
        $type: "number",
        $value: 1,
      },
      second: {
        $type: "number",
        $value: 2,
      },
      third: {
        $type: "number",
        $value: 3,
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(Object.keys(serialized)).toEqual(["first", "second", "third"]);
  });

  test("serializes multiple shadow values", () => {
    const input = {
      shadow: {
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
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("serializes fontFamily as array", () => {
    const input = {
      font: {
        $type: "fontFamily",
        $value: ["Inter", "Arial", "sans-serif"],
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("serializes complex stroke style", () => {
    const input = {
      stroke: {
        $type: "strokeStyle",
        $value: {
          dashArray: [
            { value: 4, unit: "px" },
            { value: 2, unit: "px" },
          ],
          lineCap: "round",
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("serializes transition with all properties", () => {
    const input = {
      motion: {
        $type: "transition",
        $value: {
          duration: { value: 300, unit: "ms" },
          delay: { value: 100, unit: "ms" },
          timingFunction: [0.25, 0.1, 0.25, 1],
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("round-trip complex example with multiple groups", () => {
    const input = {
      colors: {
        $type: "color",
        $description: "Color tokens for the design system",
        $extensions: {
          "com.example/category": {
            group: "semantic",
          },
        },
        primary: {
          $value: {
            colorSpace: "srgb",
            components: [0, 0.4, 0.8],
          },
          $description: "Primary brand color",
        },
        secondary: {
          $value: { colorSpace: "srgb", components: [0.8, 0.2, 0.5] },
        },
      },
      spacing: {
        $type: "dimension",
        $description: "Spacing tokens with pixel units",
        xs: {
          $value: { value: 4, unit: "px" },
        },
        sm: {
          $value: { value: 8, unit: "px" },
        },
      },
      shadows: {
        $type: "shadow",
        sm: {
          $value: {
            color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.1 },
            offsetX: { value: 1, unit: "px" },
            offsetY: { value: 2, unit: "px" },
            blur: { value: 4, unit: "px" },
            spread: { value: 0, unit: "px" },
          },
        },
        multiple: {
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
      },
      deprecated: {
        oldColor: {
          $type: "color",
          $value: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
          $deprecated: "Use colors.primary instead",
        },
      },
    };

    const parsed = parseDesignTokens(input);
    expect(parsed.errors).toHaveLength(0);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("serializes token with $value containing reference", () => {
    const input = {
      semantic: {
        brand: {
          $type: "color",
          $value: "{colors.primary}",
        },
      },
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("round-trip preserves $value with reference", () => {
    const input = {
      semantic: {
        $type: "color",
        success: {
          $value: "{base.primary}",
          $description: "Success state color",
        },
        error: {
          $value: { colorSpace: "srgb", components: [1, 0, 0] },
          $description: "Error state color",
        },
      },
      base: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
          $description: "Base primary color",
        },
      },
    };
    const parsed = parseDesignTokens(input);
    expect(parsed.errors).toHaveLength(0);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("skips $type on token if inherited has the same type", () => {
    const { nodes } = parseDesignTokens({
      colors: {
        $type: "color",
        blue: {
          "500": {
            $type: "color",
            $value: { colorSpace: "srgb", components: [0, 0, 1] },
          },
          size: {
            $type: "dimension",
            $value: { value: 10, unit: "rem" },
          },
        },
      },
    });
    expect(serializeDesignTokens(nodesToMap(nodes))).toEqual({
      colors: {
        $type: "color",
        blue: {
          "500": {
            // here type is removed after serializing back because can be inherited from group
            $value: { colorSpace: "srgb", components: [0, 0, 1] },
          },
          size: {
            $type: "dimension",
            $value: { value: 10, unit: "rem" },
          },
        },
      },
    });
  });

  test("serializes shadow with component aliases", () => {
    const input = {
      colors: {
        $type: "color",
        black: {
          $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.2 },
        },
      },
      spacing: {
        $type: "dimension",
        md: {
          $value: { value: 4, unit: "px" },
        },
      },
      shadows: {
        $type: "shadow",
        primary: {
          $value: {
            color: "{colors.black}",
            offsetX: "{spacing.md}",
            offsetY: "{spacing.md}",
            blur: { value: 8, unit: "px" },
            spread: { value: 0, unit: "px" },
            inset: false,
          },
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("serializes border with component aliases", () => {
    const input = {
      colors: {
        $type: "color",
        gray: {
          $value: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
        },
      },
      spacing: {
        $type: "dimension",
        sm: {
          $value: { value: 1, unit: "px" },
        },
      },
      borders: {
        $type: "border",
        default: {
          $value: {
            color: "{colors.gray}",
            width: "{spacing.sm}",
            style: "solid",
          },
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("serializes typography with component aliases", () => {
    const input = {
      fonts: {
        $type: "fontFamily",
        body: {
          $value: "sans-serif",
        },
      },
      spacing: {
        $type: "dimension",
        md: {
          $value: { value: 16, unit: "px" },
        },
      },
      typography: {
        $type: "typography",
        base: {
          $value: {
            fontFamily: "{fonts.body}",
            fontSize: "{spacing.md}",
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: { value: 0, unit: "px" },
          },
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("serializes transition with component aliases", () => {
    const input = {
      durations: {
        $type: "duration",
        quick: {
          $value: { value: 300, unit: "ms" },
        },
        slowDelay: {
          $value: { value: 100, unit: "ms" },
        },
      },
      easing: {
        $type: "cubicBezier",
        ease: {
          $value: [0.25, 0.1, 0.25, 1],
        },
      },
      transitions: {
        $type: "transition",
        smooth: {
          $value: {
            duration: "{durations.quick}",
            delay: "{durations.slowDelay}",
            timingFunction: "{easing.ease}",
          },
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });

  test("serializes gradient with component aliases", () => {
    const input = {
      colors: {
        $type: "color",
        red: {
          $value: { colorSpace: "srgb", components: [1, 0, 0] },
        },
        blue: {
          $value: { colorSpace: "srgb", components: [0, 0, 1] },
        },
      },
      gradients: {
        $type: "gradient",
        redToBlue: {
          $value: [
            {
              color: "{colors.red}",
              position: 0,
            },
            {
              color: "{colors.blue}",
              position: 1,
            },
          ],
        },
      },
    };
    const parsed = parseDesignTokens(input);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });
});

// ============================================================================
// LEGACY FORMAT MIGRATION TESTS (2022 → 2025)
// ============================================================================

describe("parseDesignTokens - Legacy Format Migration", () => {
  test("parses legacy RGB hex color with explicit type", () => {
    const result = parseDesignTokens({
      brand: { $type: "color", $value: "#ff0000" },
    });
    expect(result.errors).toEqual([]);
    expect(result.nodes).toHaveLength(1);
  });

  test("parses legacy RGBA hex color with alpha", () => {
    const result = parseDesignTokens({
      transparent: { $type: "color", $value: "#ff000088" },
    });
    expect(result.errors).toEqual([]);
    const token = result.nodes[0].meta;
    if ("nodeType" in token && token.nodeType === "token") {
      expect((token.value as any).alpha).toBe(0.53);
    }
  });

  test("expands 3-digit hex #rgb", () => {
    const result = parseDesignTokens({
      red: { $type: "color", $value: "#f00" },
    });
    expect(result.errors).toEqual([]);
    const token = result.nodes[0].meta;
    if ("nodeType" in token && token.nodeType === "token") {
      expect((token.value as any).hex).toBe("#ff0000");
    }
  });

  test("accepts legacy dimension strings in parent group with type", () => {
    const result = parseDesignTokens({
      spacing: {
        $type: "dimension",
        small: { $value: "8px" },
        large: { $value: "16px" },
      },
    });
    expect(result.errors).toEqual([]);
    const tokens = result.nodes.filter((n) => n.meta.nodeType === "token");
    expect(tokens).toHaveLength(2);
  });

  test("accepts legacy duration strings in parent group with type", () => {
    const result = parseDesignTokens({
      transitions: {
        $type: "duration",
        fast: { $value: "100ms" },
        slow: { $value: "500ms" },
      },
    });
    expect(result.errors).toEqual([]);
    const tokens = result.nodes.filter((n) => n.meta.nodeType === "token");
    expect(tokens).toHaveLength(2);
  });

  test("parses legacy shadow with hex color and dimension strings", () => {
    const result = parseDesignTokens({
      drop: {
        $type: "shadow",
        $value: {
          color: "#00000088",
          offsetX: "0.5rem",
          offsetY: "0.5rem",
          blur: "1.5rem",
          spread: "0rem",
        },
      },
    });
    expect(result.errors).toEqual([]);
    expect(result.nodes).toHaveLength(1);
  });

  test("parses legacy border with string values", () => {
    const result = parseDesignTokens({
      focus: {
        $type: "border",
        $value: {
          color: "#000000",
          width: "2px",
          style: "solid",
        },
      },
    });
    expect(result.errors).toEqual([]);
  });

  test("parses legacy gradient with hex colors", () => {
    const result = parseDesignTokens({
      sunset: {
        $type: "gradient",
        $value: [
          { color: "#ff0000", position: 0 },
          { color: "#ffff00", position: 0.5 },
          { color: "#00ff00", position: 1 },
        ],
      },
    });
    expect(result.errors).toEqual([]);
  });

  test("parses legacy typography with string dimensions", () => {
    const result = parseDesignTokens({
      heading: {
        $type: "typography",
        $value: {
          fontFamily: "Arial",
          fontSize: "32px",
          fontWeight: 700,
          letterSpacing: "0.1px",
          lineHeight: "1.2",
        },
      },
    });
    expect(result.errors).toEqual([]);
  });

  test("preserves extensions in legacy tokens", () => {
    const result = parseDesignTokens({
      brand: {
        $type: "color",
        $value: "#0066ff",
        $description: "Primary brand",
        $extensions: { "com.example/custom": { foo: "bar" } },
      },
    });
    expect(result.errors).toHaveLength(0);
    const token = result.nodes[0].meta;
    if ("nodeType" in token && token.nodeType === "token") {
      expect(token.description).toBe("Primary brand");
      expect(token.extensions).toEqual({
        "com.example/custom": { foo: "bar" },
      });
    }
  });

  test("rounds alpha to 2 decimals", () => {
    const result = parseDesignTokens({
      color: { $type: "color", $value: "#ff000080" },
    });
    expect(result.errors).toHaveLength(0);
    const token = result.nodes[0].meta;
    if ("nodeType" in token && token.nodeType === "token") {
      expect((token.value as any).alpha).toBe(0.5);
    }
  });

  test("handles zero dimension", () => {
    const result = parseDesignTokens({
      spacing: {
        $type: "dimension",
        zero: { $value: "0px" },
      },
    });
    expect(result.errors).toHaveLength(0);
  });

  test("handles deprecated tokens", () => {
    const result = parseDesignTokens({
      colors: {
        $type: "color",
        old: {
          $value: "#ff0000",
          $deprecated: "Use newColor instead",
        },
      },
    });
    expect(result.errors).toHaveLength(0);
    const token = result.nodes.find((n) => n.meta.nodeType === "token");
    if (token && token.meta.nodeType === "token") {
      expect(token.meta.deprecated).toBe("Use newColor instead");
    }
  });

  test("parses legacy negative dimension value", () => {
    const result = parseDesignTokens({
      spacing: {
        $type: "dimension",
        negative: { $value: "-8px" },
      },
    });
    expect(result.errors).toEqual([]);
    expect(result.nodes).toHaveLength(2);
    const token = result.nodes.find((n) => n.meta.nodeType === "token");
    if (token?.meta.nodeType === "token") {
      expect((token.meta.value as any).value).toBe(-8);
      expect((token.meta.value as any).unit).toBe("px");
    }
  });

  test("parses legacy negative dimension with decimal", () => {
    const result = parseDesignTokens({
      spacing: {
        $type: "dimension",
        negative: { $value: "-0.5rem" },
      },
    });
    expect(result.errors).toEqual([]);
    const token = result.nodes.find((n) => n.meta.nodeType === "token");
    if (token?.meta.nodeType === "token") {
      expect((token.meta.value as any).value).toBe(-0.5);
      expect((token.meta.value as any).unit).toBe("rem");
    }
  });

  test("parses legacy negative zero dimension", () => {
    const result = parseDesignTokens({
      spacing: {
        $type: "dimension",
        zero: { $value: "-0px" },
      },
    });
    expect(result.errors).toEqual([]);
    const token = result.nodes.find((n) => n.meta.nodeType === "token");
    if (token?.meta.nodeType === "token") {
      expect((token.meta.value as any).value).toBe(-0);
    }
  });

  test("parses legacy negative duration value", () => {
    const result = parseDesignTokens({
      transitions: {
        $type: "duration",
        negative: { $value: "-100ms" },
      },
    });
    expect(result.errors).toEqual([]);
    const token = result.nodes.find((n) => n.meta.nodeType === "token");
    if (token?.meta.nodeType === "token") {
      expect((token.meta.value as any).value).toBe(-100);
      expect((token.meta.value as any).unit).toBe("ms");
    }
  });

  test("parses legacy negative duration with decimal", () => {
    const result = parseDesignTokens({
      transitions: {
        $type: "duration",
        negative: { $value: "-0.5s" },
      },
    });
    expect(result.errors).toEqual([]);
    const token = result.nodes.find((n) => n.meta.nodeType === "token");
    if (token?.meta.nodeType === "token") {
      expect((token.meta.value as any).value).toBe(-0.5);
      expect((token.meta.value as any).unit).toBe("s");
    }
  });

  test("parses legacy negative zero duration", () => {
    const result = parseDesignTokens({
      transitions: {
        $type: "duration",
        zero: { $value: "-0ms" },
      },
    });
    expect(result.errors).toEqual([]);
    const token = result.nodes.find((n) => n.meta.nodeType === "token");
    if (token?.meta.nodeType === "token") {
      expect((token.meta.value as any).value).toBe(-0);
    }
  });

  test("parses legacy negative number via typography lineHeight", () => {
    const result = parseDesignTokens({
      typography: {
        $type: "typography",
        negative: {
          $value: {
            fontFamily: "Arial",
            fontSize: "16px",
            fontWeight: 400,
            letterSpacing: "0px",
            lineHeight: "-1.5",
          },
        },
      },
    });
    expect(result.errors).toEqual([]);
    const token = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "negative",
    );
    if (token?.meta.nodeType === "token") {
      const typographyValue = token.meta.value as any;
      expect(typographyValue.lineHeight).toBe(-1.5);
    }
  });

  test("parses legacy negative decimal number via typography lineHeight", () => {
    const result = parseDesignTokens({
      typography: {
        $type: "typography",
        tight: {
          $value: {
            fontFamily: "Arial",
            fontSize: "16px",
            fontWeight: 400,
            letterSpacing: "0px",
            lineHeight: "-0.5",
          },
        },
      },
    });
    expect(result.errors).toEqual([]);
    const token = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "tight",
    );
    if (token?.meta.nodeType === "token") {
      const typographyValue = token.meta.value as any;
      expect(typographyValue.lineHeight).toBe(-0.5);
    }
  });

  test("parses legacy negative zero number via typography lineHeight", () => {
    const result = parseDesignTokens({
      typography: {
        $type: "typography",
        zero: {
          $value: {
            fontFamily: "Arial",
            fontSize: "16px",
            fontWeight: 400,
            letterSpacing: "0px",
            lineHeight: "-0",
          },
        },
      },
    });
    expect(result.errors).toEqual([]);
    const token = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "zero",
    );
    if (token?.meta.nodeType === "token") {
      const typographyValue = token.meta.value as any;
      expect(typographyValue.lineHeight).toBe(-0);
    }
  });

  test("parses legacy shadow with negative offsets", () => {
    const result = parseDesignTokens({
      shadows: {
        $type: "shadow",
        negative: {
          $value: {
            color: "#000000",
            offsetX: "-2px",
            offsetY: "-4px",
            blur: "8px",
            spread: "-1px",
            inset: false,
          },
        },
      },
    });
    expect(result.errors).toEqual([]);
    const token = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "negative",
    );
    if (token?.meta.nodeType === "token") {
      const shadowValue = token.meta.value as any;
      expect(Array.isArray(shadowValue)).toBe(true);
      expect(shadowValue[0].offsetX.value).toBe(-2);
      expect(shadowValue[0].offsetY.value).toBe(-4);
      expect(shadowValue[0].spread.value).toBe(-1);
      expect(shadowValue[0].blur.value).toBe(8);
    }
  });

  test("parses legacy typography with negative letterSpacing", () => {
    const result = parseDesignTokens({
      typography: {
        $type: "typography",
        tight: {
          $value: {
            fontFamily: "Arial",
            fontSize: "16px",
            fontWeight: 400,
            letterSpacing: "-0.05px",
            lineHeight: "1.5",
          },
        },
      },
    });
    expect(result.errors).toEqual([]);
    const token = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "tight",
    );
    if (token?.meta.nodeType === "token") {
      const typographyValue = token.meta.value as any;
      expect(typographyValue.letterSpacing.value).toBe(-0.05);
    }
  });

  test("parses legacy border with negative width", () => {
    const result = parseDesignTokens({
      borders: {
        $type: "border",
        negative: {
          $value: {
            color: "#000000",
            width: "-2px",
            style: "solid",
          },
        },
      },
    });
    expect(result.errors).toEqual([]);
    const token = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "negative",
    );
    if (token?.meta.nodeType === "token") {
      const borderValue = token.meta.value as any;
      expect(borderValue.width.value).toBe(-2);
    }
  });

  test("parses legacy gradient with negative stop positions", () => {
    const result = parseDesignTokens({
      gradients: {
        $type: "gradient",
        negative: {
          $value: [
            { color: "#ff0000", position: -0.5 },
            { color: "#00ff00", position: 0.5 },
          ],
        },
      },
    });
    expect(result.errors).toEqual([]);
    const token = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "negative",
    );
    if (token?.meta.nodeType === "token") {
      const gradientValue = token.meta.value as any;
      expect(Array.isArray(gradientValue)).toBe(true);
      expect(gradientValue[0].position).toBe(-0.5);
    }
  });

  test("parses multiple legacy negative dimension values", () => {
    const result = parseDesignTokens({
      spacing: {
        $type: "dimension",
        small: { $value: "-4px" },
        medium: { $value: "-8px" },
        large: { $value: "-16px" },
      },
    });
    expect(result.errors).toEqual([]);
    const tokens = result.nodes.filter((n) => n.meta.nodeType === "token");
    expect(tokens).toHaveLength(3);
    const values = tokens
      .map((t) => (t.meta as any).value.value)
      .sort((a: number, b: number) => a - b);
    expect(values).toEqual([-16, -8, -4]);
  });

  test("parses legacy dimensions with mixed positive and negative values", () => {
    const result = parseDesignTokens({
      spacing: {
        $type: "dimension",
        positive: { $value: "8px" },
        negative: { $value: "-8px" },
        zero: { $value: "0px" },
      },
    });
    expect(result.errors).toEqual([]);
    const tokens = result.nodes.filter((n) => n.meta.nodeType === "token");
    expect(tokens).toHaveLength(3);
    const values = tokens.map((t) => (t.meta as any).value.value).sort();
    expect(values).toEqual([-8, 0, 8]);
  });

  test("handles shadow with inset flag", () => {
    const result = parseDesignTokens({
      inset: {
        $type: "shadow",
        $value: {
          color: "#000000",
          offsetX: "2px",
          offsetY: "2px",
          blur: "4px",
          spread: "0px",
          inset: true,
        },
      },
    });
    expect(result.errors).toHaveLength(0);
  });
});
