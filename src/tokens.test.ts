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

  test("excludes invalid token with bad name from tree", () => {
    const result = parseDesignTokens({
      $invalid: {
        $type: "number",
        $value: 123,
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Invalid token name");
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

  test("inherits type from parent group", () => {
    const result = parseDesignTokens({
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0, 1] },
        },
      },
    });
    expect(result.nodes).toHaveLength(2);
    const tokenNode = result.nodes.find((n) => n.meta.nodeType === "token");
    expect(tokenNode?.meta?.type).toBe("color");
  });

  test("excludes token without determinable type", () => {
    const result = parseDesignTokens({
      noType: {
        $value: "something",
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

  test("rejects invalid cubicBezier with values outside [0,1]", () => {
    const result = parseDesignTokens({
      easing: {
        $type: "cubicBezier",
        $value: [1.5, 0.1, 0.25, 1],
      },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
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
        $value: "not a number",
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
          color: { colorSpace: "srgb", components: [0, 0, 0, 0.2] },
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
        value: {
          color: { colorSpace: "srgb", components: [0, 0, 0, 0.2] },
          offsetX: { value: 0, unit: "px" },
          offsetY: { value: 4, unit: "px" },
          blur: { value: 8, unit: "px" },
          spread: { value: 0, unit: "px" },
          inset: false,
        },
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
          color: { colorSpace: "srgb", components: [0, 0, 0, 0.2] },
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
            color: { colorSpace: "srgb", components: [0, 0, 0, 0.1] },
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 1, unit: "px" },
            blur: { value: 2, unit: "px" },
          },
          {
            color: { colorSpace: "srgb", components: [0, 0, 0, 0.05] },
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 4, unit: "px" },
            blur: { value: 8, unit: "px" },
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
          $value: {
            colorSpace: "srgb",
            components: [0.8, 0.2, 0.5],
          },
        },
      },
      spacing: {
        $type: "dimension",
        $description: "Spacing tokens with pixel units",
        xs: {
          $value: {
            value: 4,
            unit: "px",
          },
        },
        sm: {
          $value: {
            value: 8,
            unit: "px",
          },
        },
      },
      shadows: {
        $type: "shadow",
        sm: {
          $value: {
            color: {
              colorSpace: "srgb",
              components: [0, 0, 0, 0.1],
            },
            offsetX: {
              value: 1,
              unit: "px",
            },
            offsetY: {
              value: 2,
              unit: "px",
            },
            blur: {
              value: 4,
              unit: "px",
            },
            spread: {
              value: 0,
              unit: "px",
            },
          },
        },
        multiple: {
          $value: [
            {
              color: {
                colorSpace: "srgb",
                components: [0, 0, 0, 0.1],
              },
              offsetX: {
                value: 0,
                unit: "px",
              },
              offsetY: {
                value: 1,
                unit: "px",
              },
              blur: {
                value: 2,
                unit: "px",
              },
            },
            {
              color: {
                colorSpace: "srgb",
                components: [0, 0, 0, 0.05],
              },
              offsetX: {
                value: 0,
                unit: "px",
              },
              offsetY: {
                value: 4,
                unit: "px",
              },
              blur: {
                value: 8,
                unit: "px",
              },
            },
          ],
        },
      },
      deprecated: {
        oldColor: {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [0.5, 0.5, 0.5],
          },
          $deprecated: "Use colors.primary instead",
        },
      },
    };

    const parsed = parseDesignTokens(input);
    expect(parsed.errors).toHaveLength(0);
    const serialized = serializeDesignTokens(nodesToMap(parsed.nodes));
    expect(serialized).toEqual(input);
  });
});
