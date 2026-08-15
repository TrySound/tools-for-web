import { test, expect, describe } from "vitest";
import {
  rawResolverDocumentSchema,
  type RawResolverDocument,
} from "./dtcg.schema";
import {
  parseTokenResolver,
  serializeTokenResolver,
  isResolverFormat,
} from "./resolver";
import type { TreeNode } from "./store";
import type { TreeNodeMeta } from "./state.svelte";

describe("isResolverFormat", () => {
  test("detects valid resolver format", () => {
    const resolver = {
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Test",
          sources: [],
        },
      ],
    };
    expect(isResolverFormat(resolver)).toBe(true);
  });

  test("rejects non-object input", () => {
    expect(isResolverFormat("not an object")).toBe(false);
    expect(isResolverFormat(123)).toBe(false);
    expect(isResolverFormat(null)).toBe(false);
  });

  test("rejects object without version", () => {
    expect(isResolverFormat({ resolutionOrder: [] })).toBe(false);
  });

  test("rejects object without resolutionOrder", () => {
    expect(isResolverFormat({ version: "2025.10" })).toBe(false);
  });

  test("rejects object with wrong version", () => {
    expect(
      isResolverFormat({
        version: "2024.01",
        resolutionOrder: [],
      }),
    ).toBe(false);
  });

  test("rejects object with non-array resolutionOrder", () => {
    expect(
      isResolverFormat({
        version: "2025.10",
        resolutionOrder: "not an array",
      }),
    ).toBe(false);
  });
});

describe("rawResolverDocumentSchema", () => {
  test("accepts references and inline sources throughout raw resolver input", () => {
    const document: RawResolverDocument = {
      version: "2025.10",
      sets: {
        base: {
          sources: [
            { $ref: "#/$defs/base", description: "reference override" },
            {},
          ],
        },
      },
      modifiers: {
        theme: {
          contexts: {
            dark: [{ $ref: "#/sets/base" }, {}],
          },
        },
      },
      resolutionOrder: [
        { $ref: "#/sets/base" },
        {
          type: "set",
          name: "InlineSet",
          sources: [{ $ref: "#/$defs/base" }, {}],
        },
        {
          type: "modifier",
          name: "InlineModifier",
          contexts: { dark: [{ $ref: "#/sets/base" }, {}] },
        },
      ],
      $defs: { base: {} },
    };

    const result = rawResolverDocumentSchema.safeParse(document);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected raw resolver to validate");
    expect(result.data.sets?.base.sources[0]).toEqual({
      $ref: "#/$defs/base",
      description: "reference override",
    });
  });
});

describe("parseTokenResolver", () => {
  test("rejects input without version field", () => {
    const result = parseTokenResolver({
      resolutionOrder: [],
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("version");
  });

  test("rejects input with wrong version", () => {
    const result = parseTokenResolver({
      version: "2024.01",
      resolutionOrder: [],
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("version");
  });

  test("accepts root-level set definitions referenced by resolutionOrder", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      sets: { someSet: { sources: [] } },
      resolutionOrder: [{ $ref: "#/sets/someSet" }],
    });

    expect(result.errors).toHaveLength(0);
    expect(
      result.nodes.find((node) => node.meta.nodeType === "token-set")?.meta
        .name,
    ).toBe("someSet");
  });

  test("accepts root-level modifier definitions referenced by resolutionOrder", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      modifiers: {
        someModifier: { contexts: { enabled: [], disabled: [] } },
      },
      resolutionOrder: [{ $ref: "#/modifiers/someModifier" }],
    });

    expect(result.errors).toHaveLength(0);
    expect(
      result.nodes.find((node) => node.meta.nodeType === "token-modifier")?.meta
        .name,
    ).toBe("someModifier");
  });

  test("accepts valid minimal resolver with empty resolutionOrder", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [],
    });
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toHaveLength(0); // No sets when no Sets in resolutionOrder
  });

  test("accepts optional name and description", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      name: "My Design System",
      description: "Design tokens for my app",
      resolutionOrder: [],
    });
    expect(result.errors).toHaveLength(0);
  });

  test("parses single set with single source", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              colors: {
                primary: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 1] },
                },
              },
            },
          ],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Should have Foundation set and color token
    expect(result.nodes.length).toBeGreaterThanOrEqual(2);
    // First node should be the Foundation set with correct name
    const setNode = result.nodes.find((n) => n.meta.nodeType === "token-set");
    expect(setNode).toBeDefined();
    expect(setNode?.meta.name).toBe("Foundation");
  });

  test("parses single set with empty sources array", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Empty",
          sources: [],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Empty set should still create a root set node
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].meta.nodeType).toBe("token-set");
    expect(result.nodes[0].meta.name).toBe("Empty");
  });

  test("merges multiple sources within a set respecting order", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Colors",
          sources: [
            {
              primary: {
                $type: "color",
                $value: { colorSpace: "srgb", components: [1, 0, 0] },
              },
            },
            {
              secondary: {
                $type: "color",
                $value: { colorSpace: "srgb", components: [0, 1, 0] },
              },
            },
            {
              primary: {
                $type: "color",
                $value: { colorSpace: "srgb", components: [0, 0, 1] },
              }, // Override with blue
            },
          ],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Should have Colors set with merged sources
    expect(result.nodes.length).toBeGreaterThan(1);
    const setNode = result.nodes.find((n) => n.meta.nodeType === "token-set");
    expect(setNode?.meta.name).toBe("Colors");
  });

  test("processes multiple sets in resolutionOrder sequentially", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              spacing: {
                sm: {
                  $type: "dimension",
                  $value: { value: 8, unit: "px" },
                },
              },
            },
          ],
        },
        {
          type: "set",
          name: "Semantic",
          sources: [
            {
              colors: {
                primary: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 1] },
                },
              },
            },
          ],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Should have multiple root sets
    const setNodes = result.nodes.filter(
      (n) => n.meta.nodeType === "token-set",
    );
    expect(setNodes).toHaveLength(2);
    expect(setNodes.map((n) => n.meta.name)).toEqual([
      "Foundation",
      "Semantic",
    ]);
    // All root sets should have parentId: undefined
    expect(setNodes.every((n) => n.parentId === undefined)).toBe(true);
  });

  test("keeps sets separate without merging between them", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              color: {
                primary: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [1, 0, 0] },
                },
              },
            },
          ],
        },
        {
          type: "set",
          name: "Semantic",
          sources: [
            {
              color: {
                accent: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 1] },
                },
              },
            },
          ],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Should have two separate root sets
    const setNodes = result.nodes.filter(
      (n) => n.meta.nodeType === "token-set",
    );
    expect(setNodes).toHaveLength(2);
    expect(setNodes.map((n) => n.meta.name)).toEqual([
      "Foundation",
      "Semantic",
    ]);
  });

  test("silently skips modifier items in resolutionOrder", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Base",
          sources: [
            {
              colors: {
                primary: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 1] },
                },
              },
            },
          ],
        },
        {
          type: "modifier",
          name: "Theme",
          contexts: {
            light: [],
            dark: [
              {
                colors: {
                  primary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [1, 1, 1] },
                  },
                },
              },
            ],
          },
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Modifier should be silently skipped, only Base set processed
    expect(result.nodes.length).toBeGreaterThan(1);
  });

  test("collects errors from invalid tokens in sources", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Invalid",
          sources: [
            {
              badToken: {
                $type: "color",
                $value: "not-a-valid-color",
              },
            },
          ],
        },
      ],
    });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.path.includes("badToken"))).toBe(true);
  });

  test("merges nested group structures within a set", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Colors",
          sources: [
            {
              semantic: {
                $type: "color",
                button: {
                  primary: {
                    $value: { colorSpace: "srgb", components: [0, 0, 1] },
                  },
                },
              },
            },
            {
              semantic: {
                $type: "color",
                text: {
                  default: {
                    $value: { colorSpace: "srgb", components: [0, 0, 0] },
                  },
                },
              },
            },
          ],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Nested sources within the set should be merged
    expect(result.nodes.length).toBeGreaterThan(1);
    const setNode = result.nodes.find((n) => n.meta.nodeType === "token-set");
    expect(setNode?.meta.name).toBe("Colors");
  });

  test("preserves nested token group hierarchy within sets", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "SemanticColors",
          sources: [
            {
              semantic: {
                button: {
                  primary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 1] },
                  },
                  secondary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [1, 0, 0] },
                  },
                },
                text: {
                  default: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 0] },
                  },
                },
              },
            },
          ],
        },
      ],
    });

    expect(result.errors).toHaveLength(0);

    // Find the Set node
    const setNode = result.nodes.find((n) => n.meta.nodeType === "token-set");
    expect(setNode).toBeDefined();
    expect(setNode?.meta.name).toBe("SemanticColors");

    // Find root group "semantic" - should be child of Set
    const semanticGroup = result.nodes.find(
      (n) => n.meta.nodeType === "token-group" && n.meta.name === "semantic",
    );
    expect(semanticGroup).toBeDefined();
    expect(semanticGroup?.parentId).toBe(setNode?.nodeId);

    // Find nested group "button" - should be child of "semantic"
    const buttonGroup = result.nodes.find(
      (n) => n.meta.nodeType === "token-group" && n.meta.name === "button",
    );
    expect(buttonGroup).toBeDefined();
    expect(buttonGroup?.parentId).toBe(semanticGroup?.nodeId);

    // Find nested group "text" - should also be child of "semantic"
    const textGroup = result.nodes.find(
      (n) => n.meta.nodeType === "token-group" && n.meta.name === "text",
    );
    expect(textGroup).toBeDefined();
    expect(textGroup?.parentId).toBe(semanticGroup?.nodeId);

    // Find token "primary" - should be child of "button"
    const primaryToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "primary",
    );
    expect(primaryToken).toBeDefined();
    expect(primaryToken?.parentId).toBe(buttonGroup?.nodeId);

    // Find token "secondary" - should be child of "button"
    const secondaryToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "secondary",
    );
    expect(secondaryToken).toBeDefined();
    expect(secondaryToken?.parentId).toBe(buttonGroup?.nodeId);

    // Find token "default" - should be child of "text"
    const defaultToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "default",
    );
    expect(defaultToken).toBeDefined();
    expect(defaultToken?.parentId).toBe(textGroup?.nodeId);
  });

  test("preserves set name and metadata on root set node", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "CustomSet",
          description: "Custom set description",
          sources: [],
          $extensions: { "custom.key": { data: "value" } },
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    const setNode = result.nodes.find((n) => n.meta.nodeType === "token-set");
    expect(setNode?.meta.name).toBe("CustomSet");
    expect(setNode?.meta.description).toBe("Custom set description");
    expect(setNode?.meta.extensions).toEqual({
      "custom.key": { data: "value" },
    });
  });

  test("preserves token descriptions and extensions from sources", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Documented",
          sources: [
            {
              brand: {
                $type: "color",
                $value: { colorSpace: "srgb", components: [0, 0, 1] },
                $description: "Brand primary color",
                $extensions: { "custom.key": { data: "value" } },
              },
            },
          ],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    const brandTokens = result.nodes.filter(
      (n) => n.meta.nodeType === "token" && n.meta.name === "brand",
    );
    expect(brandTokens.length).toBeGreaterThan(0);
    if (brandTokens[0]?.meta.nodeType === "token") {
      expect(brandTokens[0].meta.description).toBe("Brand primary color");
      expect(brandTokens[0].meta.extensions).toEqual({
        "custom.key": { data: "value" },
      });
    }
  });

  test("handles complex token types (shadow, border, typography)", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Complex",
          sources: [
            {
              shadows: {
                $type: "shadow",
                drop: {
                  $value: {
                    color: {
                      colorSpace: "srgb",
                      components: [0, 0, 0],
                      alpha: 0.2,
                    },
                    offsetX: { value: 0, unit: "px" },
                    offsetY: { value: 4, unit: "px" },
                    blur: { value: 8, unit: "px" },
                    spread: { value: 0, unit: "px" },
                  },
                },
              },
            },
          ],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Complex token types should parse successfully
    expect(result.nodes.length).toBeGreaterThan(1);
  });

  test("rejects invalid set without name", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          sources: [],
        } as unknown,
      ],
    });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("rejects invalid set without sources", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "NoSources",
        } as unknown,
      ],
    });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("rejects modifier without contexts", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "BadModifier",
        } as unknown,
      ],
    });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test.each([
    {
      name: "inline modifier",
      document: {
        version: "2025.10",
        resolutionOrder: [{ type: "modifier", name: "Theme", contexts: {} }],
      },
      path: "resolutionOrder[0].contexts",
    },
    {
      name: "root-referenced modifier",
      document: {
        version: "2025.10",
        modifiers: { theme: { contexts: {} } },
        resolutionOrder: [{ $ref: "#/modifiers/theme" }],
      },
      path: "modifiers.theme.contexts",
    },
  ])("rejects empty contexts on a $name", ({ document, path }) => {
    const result = parseTokenResolver(document);

    expect(result.nodes).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain(path);
  });

  test.each([
    {
      name: "inline modifier",
      document: {
        version: "2025.10",
        resolutionOrder: [
          {
            type: "modifier",
            name: "Theme",
            contexts: { light: [] },
            default: "dark",
          },
        ],
      },
      path: "resolutionOrder[0].default",
    },
    {
      name: "root-referenced modifier",
      document: {
        version: "2025.10",
        modifiers: {
          theme: { contexts: { light: [] }, default: "dark" },
        },
        resolutionOrder: [{ $ref: "#/modifiers/theme" }],
      },
      path: "modifiers.theme.default",
    },
  ])(
    "rejects a default absent from contexts on a $name",
    ({ document, path }) => {
      const result = parseTokenResolver(document);

      expect(result.nodes).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain(path);
      expect(result.errors[0].message).toContain("contexts");
    },
  );

  test("accepts modifier with optional default", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "Theme",
          contexts: {
            light: [],
            dark: [],
          },
          default: "light",
        },
      ],
    });
    // Modifier is skipped, but should validate correctly
    expect(result.errors.length).toBe(0);
  });

  test("accepts modifier with optional description and extensions", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "Theme",
          description: "Color theme selector",
          contexts: {
            light: [],
            dark: [],
          },
          $extensions: { "custom.meta": { version: "1" } },
        },
      ],
    });
    expect(result.errors.length).toBe(0);
  });

  test("accepts set with optional description and extensions", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [],
          description: "Foundation tokens",
          $extensions: { "custom.meta": { category: "foundation" } },
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
  });

  test("normalizes escaped root references while preserving mixed array order", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      sets: {
        "core/palette~": {
          description: "Referenced set",
          sources: [],
        },
      },
      modifiers: {
        theme: {
          contexts: { light: [], dark: [] },
        },
      },
      resolutionOrder: [
        { $ref: "#/modifiers/theme" },
        { type: "set", name: "Inline", sources: [] },
        { $ref: "#/sets/core~1palette~0" },
      ],
    });

    expect(result.errors).toHaveLength(0);
    expect(
      result.nodes
        .filter((node) => node.parentId === undefined)
        .map((node) => [node.meta.nodeType, node.meta.name]),
    ).toEqual([
      ["token-modifier", "theme"],
      ["token-set", "Inline"],
      ["token-set", "core/palette~"],
    ]);

    const serialized = serializeTokenResolver(
      new Map(result.nodes.map((node) => [node.nodeId, node])),
    );
    expect(
      serialized.resolutionOrder.map(({ type, name }) => [type, name]),
    ).toEqual([
      ["modifier", "theme"],
      ["set", "Inline"],
      ["set", "core/palette~"],
    ]);
    expect(serialized).not.toHaveProperty("sets");
    expect(serialized).not.toHaveProperty("modifiers");
  });

  test.each([
    {
      collision: "set/set",
      resolutionOrder: [
        { type: "set", name: "Duplicate", sources: [] },
        { type: "set", name: "Duplicate", sources: [] },
      ],
    },
    {
      collision: "modifier/modifier",
      resolutionOrder: [
        { type: "modifier", name: "Duplicate", contexts: { one: [] } },
        { type: "modifier", name: "Duplicate", contexts: { two: [] } },
      ],
    },
    {
      collision: "set/modifier",
      resolutionOrder: [
        { type: "set", name: "Duplicate", sources: [] },
        { type: "modifier", name: "Duplicate", contexts: { one: [] } },
      ],
    },
  ])(
    "rejects a $collision name collision before creating editor nodes",
    ({ resolutionOrder }) => {
      const result = parseTokenResolver({
        version: "2025.10",
        resolutionOrder,
      });

      expect(result.errors).toEqual([
        {
          path: "/resolutionOrder/1/name",
          message: 'Duplicate resolutionOrder name: "Duplicate"',
        },
      ]);
      expect(result.nodes).toHaveLength(0);
    },
  );

  test("materializes $defs sources and merges source arrays in order", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      $defs: {
        "base/tokens": {
          color: {
            $type: "color",
            $value: { colorSpace: "srgb", components: [1, 0, 0] },
          },
          spacing: {
            $type: "dimension",
            $value: { value: 4, unit: "px" },
          },
        },
      },
      sets: {
        foundation: {
          sources: [
            { $ref: "#/$defs/base~1tokens" },
            {
              color: {
                $type: "color",
                $value: { colorSpace: "srgb", components: [0, 0, 1] },
              },
            },
          ],
        },
      },
      resolutionOrder: [{ $ref: "#/sets/foundation" }],
    });

    expect(result.errors).toHaveLength(0);
    const serialized = serializeTokenResolver(
      new Map(result.nodes.map((node) => [node.nodeId, node])),
    );
    const set = serialized.resolutionOrder[0];
    expect(set.type).toBe("set");
    if (set.type !== "set") throw new Error("Expected a set");
    expect(set.sources).toHaveLength(1);
    expect(set.sources[0]).toMatchObject({
      color: {
        $value: { colorSpace: "srgb", components: [0, 0, 1] },
      },
      spacing: { $value: { value: 4, unit: "px" } },
    });
    expect(JSON.stringify(serialized)).not.toContain("$ref");
  });

  test("expands a set reference inside a modifier context at its array position", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      sets: {
        base: {
          sources: [
            {
              color: {
                $type: "color",
                $value: { colorSpace: "srgb", components: [1, 0, 0] },
              },
            },
            {
              spacing: {
                $type: "dimension",
                $value: { value: 4, unit: "px" },
              },
            },
          ],
        },
      },
      modifiers: {
        theme: {
          contexts: {
            dark: [
              { $ref: "#/sets/base" },
              {
                color: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 0] },
                },
              },
            ],
          },
        },
      },
      resolutionOrder: [{ $ref: "#/modifiers/theme" }],
    });

    expect(result.errors).toHaveLength(0);
    const serialized = serializeTokenResolver(
      new Map(result.nodes.map((node) => [node.nodeId, node])),
    );
    const modifier = serialized.resolutionOrder[0];
    expect(modifier.type).toBe("modifier");
    if (modifier.type !== "modifier") throw new Error("Expected a modifier");
    expect(modifier.contexts.dark).toHaveLength(1);
    expect(modifier.contexts.dark[0]).toMatchObject({
      color: {
        $value: { colorSpace: "srgb", components: [0, 0, 0] },
      },
      spacing: { $value: { value: 4, unit: "px" } },
    });
  });

  test.each([
    {
      name: "set sources referencing modifiers",
      document: {
        version: "2025.10",
        modifiers: { theme: { contexts: { dark: [] } } },
        resolutionOrder: [
          {
            type: "set",
            name: "Invalid",
            sources: [{ $ref: "#/modifiers/theme" }],
          },
        ],
      },
      path: "/resolutionOrder/0/sources/0/$ref",
    },
    {
      name: "modifier contexts referencing modifiers",
      document: {
        version: "2025.10",
        modifiers: {
          base: { contexts: { dark: [] } },
          derived: {
            contexts: { dark: [{ $ref: "#/modifiers/base" }] },
          },
        },
        resolutionOrder: [{ $ref: "#/modifiers/derived" }],
      },
      path: "/modifiers/derived/contexts/dark/0/$ref",
    },
    {
      name: "any references into resolutionOrder",
      document: {
        version: "2025.10",
        sets: {
          invalid: { sources: [{ $ref: "#/resolutionOrder/0" }] },
        },
        resolutionOrder: [{ type: "set", name: "Inline", sources: [] }],
      },
      path: "/sets/invalid/sources/0/$ref",
    },
  ])("rejects $name", ({ document, path }) => {
    const result = parseTokenResolver(document);

    expect(result.errors).toContainEqual({
      path,
      message: expect.stringContaining("not allowed"),
    });
  });

  test.each([
    {
      name: "a top-level self-reference at a nonzero index",
      document: {
        version: "2025.10",
        resolutionOrder: [
          { type: "set", name: "First", sources: [] },
          { $ref: "#/resolutionOrder/1" },
        ],
      },
      path: "/resolutionOrder/1/$ref",
      reference: "#/resolutionOrder/1",
    },
    {
      name: "a top-level non-self reference",
      document: {
        version: "2025.10",
        resolutionOrder: [
          { type: "set", name: "First", sources: [] },
          { $ref: "#/resolutionOrder/0" },
        ],
      },
      path: "/resolutionOrder/1/$ref",
      reference: "#/resolutionOrder/0",
    },
    {
      name: "a nested set source self-reference",
      document: {
        version: "2025.10",
        resolutionOrder: [
          { type: "set", name: "First", sources: [] },
          {
            type: "set",
            name: "Second",
            sources: [{ $ref: "#/resolutionOrder/1" }],
          },
        ],
      },
      path: "/resolutionOrder/1/sources/0/$ref",
      reference: "#/resolutionOrder/1",
    },
    {
      name: "a nested modifier context self-reference",
      document: {
        version: "2025.10",
        resolutionOrder: [
          { type: "set", name: "First", sources: [] },
          {
            type: "modifier",
            name: "Theme",
            contexts: {
              dark: [{ $ref: "#/resolutionOrder/1" }],
            },
          },
        ],
      },
      path: "/resolutionOrder/1/contexts/dark/0/$ref",
      reference: "#/resolutionOrder/1",
    },
    {
      name: "a nested modifier context non-self reference",
      document: {
        version: "2025.10",
        resolutionOrder: [
          { type: "set", name: "First", sources: [] },
          { type: "set", name: "Second", sources: [] },
          {
            type: "modifier",
            name: "Theme",
            contexts: {
              dark: [{ $ref: "#/resolutionOrder/0" }],
            },
          },
        ],
      },
      path: "/resolutionOrder/2/contexts/dark/0/$ref",
      reference: "#/resolutionOrder/0",
    },
  ])(
    "reports one prohibited-target error for $name",
    ({ document, path, reference }) => {
      const result = parseTokenResolver(document);

      expect(result.errors).toEqual([
        {
          path,
          message: `References into resolutionOrder are not allowed: "${reference}"`,
        },
      ]);
    },
  );

  test.each([
    ["a $defs object", "#/$defs/source", "must target a root set"],
    ["an external document", "tokens.json", "External JSON reference"],
    ["a missing definition", "#/sets/missing", "target not found"],
    ["a malformed pointer", "#invalid", "malformed JSON reference"],
  ])("rejects a resolutionOrder reference to %s", (_name, $ref, message) => {
    const result = parseTokenResolver({
      version: "2025.10",
      $defs: { source: {} },
      resolutionOrder: [{ $ref }],
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      path: "/resolutionOrder/0/$ref",
      message: expect.stringContaining(message),
    });
  });
});

describe("serializeTokenResolver", () => {
  test("rejects a modifier context extension into another context", () => {
    const resolver = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "Theme",
          contexts: {
            light: [{ local: {} }],
            dark: [{ foreign: {} }],
          },
        },
      ],
    });
    const lightContext = resolver.nodes.find(
      (node) =>
        node.meta.nodeType === "token-context" && node.meta.name === "light",
    );
    const darkContext = resolver.nodes.find(
      (node) =>
        node.meta.nodeType === "token-context" && node.meta.name === "dark",
    );
    const local = resolver.nodes.find(
      (node) =>
        node.parentId === lightContext?.nodeId &&
        node.meta.nodeType === "token-group",
    );
    const foreign = resolver.nodes.find(
      (node) =>
        node.parentId === darkContext?.nodeId &&
        node.meta.nodeType === "token-group",
    );
    if (local?.meta.nodeType !== "token-group" || !foreign) {
      throw new Error("Expected context groups to parse");
    }
    local.meta.extends = { ref: foreign.nodeId };

    expect(() =>
      serializeTokenResolver(
        new Map(resolver.nodes.map((node) => [node.nodeId, node])),
      ),
    ).toThrow(
      'Failed to serialize modifier "Theme" context "light": Group "local" extension target',
    );
  });

  test("rejects a set extension into a modifier context", () => {
    const resolver = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [{ local: {} }],
        },
        {
          type: "modifier",
          name: "Theme",
          contexts: { light: [{ foreign: {} }] },
        },
      ],
    });
    const setNode = resolver.nodes.find(
      (node) =>
        node.meta.nodeType === "token-set" && node.meta.name === "Foundation",
    );
    const contextNode = resolver.nodes.find(
      (node) => node.meta.nodeType === "token-context",
    );
    const local = resolver.nodes.find(
      (node) =>
        node.parentId === setNode?.nodeId &&
        node.meta.nodeType === "token-group",
    );
    const foreign = resolver.nodes.find(
      (node) =>
        node.parentId === contextNode?.nodeId &&
        node.meta.nodeType === "token-group",
    );
    if (local?.meta.nodeType !== "token-group" || !foreign) {
      throw new Error("Expected set and context groups to parse");
    }
    local.meta.extends = { ref: foreign.nodeId };

    expect(() =>
      serializeTokenResolver(
        new Map(resolver.nodes.map((node) => [node.nodeId, node])),
      ),
    ).toThrow(
      'Failed to serialize set "Foundation": Group "local" extension target',
    );
  });

  test("serializes a renamed and moved cross-set group extension path", () => {
    const resolver = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              base: { value: { $type: "number", $value: 1 } },
              destination: {},
            },
          ],
        },
        {
          type: "set",
          name: "Components",
          sources: [{ derived: { $extends: "{base}" } }],
        },
      ],
    });
    const foundation = resolver.nodes.find(
      (node) =>
        node.meta.nodeType === "token-set" && node.meta.name === "Foundation",
    );
    const base = resolver.nodes.find(
      (node) =>
        node.parentId === foundation?.nodeId && node.meta.name === "base",
    );
    const destination = resolver.nodes.find(
      (node) =>
        node.parentId === foundation?.nodeId &&
        node.meta.name === "destination",
    );
    if (!base || !destination) throw new Error("Expected set groups to parse");
    base.meta.name = "renamed";
    base.parentId = destination.nodeId;

    const serialized = serializeTokenResolver(
      new Map(resolver.nodes.map((node) => [node.nodeId, node])),
    );
    expect(serialized.resolutionOrder[1]).toEqual(
      expect.objectContaining({
        name: "Components",
        sources: [{ derived: { $extends: "{destination.renamed}" } }],
      }),
    );
  });

  test("serializes single set with simple tokens", () => {
    const resolver = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              colors: {
                primary: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 1] },
                },
              },
            },
          ],
        },
      ],
    });

    const nodes = new Map(resolver.nodes.map((n) => [n.nodeId, n]));
    const document = serializeTokenResolver(nodes, {
      name: "Test System",
      description: "Test",
    });

    expect(document.version).toBe("2025.10");
    expect(document.name).toBe("Test System");
    expect(document.description).toBe("Test");
    expect(document.resolutionOrder).toHaveLength(1);
    expect(document.resolutionOrder[0].type).toBe("set");
    expect(document.resolutionOrder[0].name).toBe("Foundation");
    const setItem = document.resolutionOrder[0] as any;
    expect(setItem.sources).toHaveLength(1);
  });

  test("serializes multiple sets in correct order", () => {
    const resolver = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              spacing: {
                $type: "dimension",
                $value: { value: 8, unit: "px" },
              },
            },
          ],
        },
        {
          type: "set",
          name: "Semantic",
          sources: [
            {
              colors: {
                $type: "color",
                $value: { colorSpace: "srgb", components: [0, 0, 1] },
              },
            },
          ],
        },
      ],
    });

    const nodes = new Map(resolver.nodes.map((n) => [n.nodeId, n]));
    const document = serializeTokenResolver(nodes);

    expect(document.resolutionOrder).toHaveLength(2);
    expect(document.resolutionOrder[0].name).toBe("Foundation");
    expect(document.resolutionOrder[1].name).toBe("Semantic");
  });

  test("preserves set metadata (name, description, extensions)", () => {
    const resolver = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "CustomSet",
          description: "Custom set description",
          sources: [],
          $extensions: { "custom.key": { data: "value" } },
        },
      ],
    });

    const nodes = new Map(resolver.nodes.map((n) => [n.nodeId, n]));
    const document = serializeTokenResolver(nodes);

    const set = document.resolutionOrder[0];
    expect(set.name).toBe("CustomSet");
    expect(set.description).toBe("Custom set description");
    expect(set.$extensions).toEqual({ "custom.key": { data: "value" } });
  });

  test("handles empty sets", () => {
    const resolver = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Empty",
          sources: [],
        },
      ],
    });

    const nodes = new Map(resolver.nodes.map((n) => [n.nodeId, n]));
    const document = serializeTokenResolver(nodes);

    expect(document.resolutionOrder).toHaveLength(1);
    const setItem = document.resolutionOrder[0] as any;
    expect(setItem.sources).toHaveLength(1);
  });

  test("serializes nested token groups within sets", () => {
    const resolver = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Colors",
          sources: [
            {
              semantic: {
                button: {
                  primary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 1] },
                  },
                  secondary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [1, 0, 0] },
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const nodes = new Map(resolver.nodes.map((n) => [n.nodeId, n]));
    const document = serializeTokenResolver(nodes);

    // Verify the structure is preserved in the serialized output
    const set = document.resolutionOrder[0];
    if (set.type === "set") {
      const source = set.sources[0] as any;
      expect(source.semantic).toBeDefined();
      expect(source.semantic.button).toBeDefined();
      expect(source.semantic.button.primary).toBeDefined();
    }
  });

  test("serializes tokens with complex types (shadow, border, typography)", () => {
    const resolver = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Complex",
          sources: [
            {
              shadows: {
                $type: "shadow",
                drop: {
                  $value: {
                    color: {
                      colorSpace: "srgb",
                      components: [0, 0, 0],
                      alpha: 0.2,
                    },
                    offsetX: { value: 0, unit: "px" },
                    offsetY: { value: 4, unit: "px" },
                    blur: { value: 8, unit: "px" },
                    spread: { value: 0, unit: "px" },
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const nodes = new Map(resolver.nodes.map((n) => [n.nodeId, n]));
    const document = serializeTokenResolver(nodes);

    const setItem1 = document.resolutionOrder[0] as any;
    expect(setItem1.sources).toHaveLength(1);
  });

  test("serializes tokens with complex types (shadow, border, typography)", () => {
    const resolver = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Complex",
          sources: [
            {
              shadows: {
                $type: "shadow",
                drop: {
                  $value: {
                    color: {
                      colorSpace: "srgb",
                      components: [0, 0, 0],
                      alpha: 0.2,
                    },
                    offsetX: { value: 0, unit: "px" },
                    offsetY: { value: 4, unit: "px" },
                    blur: { value: 8, unit: "px" },
                    spread: { value: 0, unit: "px" },
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const nodes = new Map(resolver.nodes.map((n) => [n.nodeId, n]));
    const document = serializeTokenResolver(nodes);

    const setItem = document.resolutionOrder[0] as any;
    expect(setItem.sources).toHaveLength(1);
  });

  test("roundtrip: parse -> serialize -> parse produces same structure", () => {
    const original = {
      version: "2025.10" as const,
      name: "Design System",
      description: "Test tokens",
      resolutionOrder: [
        {
          type: "set" as const,
          name: "Foundation",
          description: "Foundation tokens",
          sources: [
            {
              colors: {
                primary: {
                  $type: "color" as const,
                  $value: {
                    colorSpace: "srgb" as const,
                    components: [0, 0, 1],
                  },
                },
              },
            },
          ],
        },
      ],
    };

    // Parse original
    const parseResult1 = parseTokenResolver(original);
    expect(parseResult1.errors).toHaveLength(0);

    // Serialize back to document
    const nodes = new Map(parseResult1.nodes.map((n) => [n.nodeId, n]));
    const serialized = serializeTokenResolver(nodes, {
      name: original.name,
      description: original.description,
    });

    // Parse serialized document
    const parseResult2 = parseTokenResolver(serialized);
    expect(parseResult2.errors).toHaveLength(0);

    // Verify structure is preserved
    expect(parseResult2.nodes).toHaveLength(parseResult1.nodes.length);
    expect(
      parseResult2.nodes.filter((n) => n.meta.nodeType === "token-set"),
    ).toHaveLength(1);
  });

  test("roundtrip preserves token values and types", () => {
    const original = {
      version: "2025.10" as const,
      resolutionOrder: [
        {
          type: "set" as const,
          name: "Test",
          sources: [
            {
              colors: {
                primary: {
                  $type: "color" as const,
                  $value: {
                    colorSpace: "srgb" as const,
                    components: [1, 0, 0],
                  },
                },
                secondary: {
                  $type: "color" as const,
                  $value: {
                    colorSpace: "srgb" as const,
                    components: [0, 1, 0],
                  },
                },
              },
              spacing: {
                sm: {
                  $type: "dimension" as const,
                  $value: { value: 4, unit: "px" as const },
                },
              },
            },
          ],
        },
      ],
    };

    const parseResult1 = parseTokenResolver(original);
    const nodes = new Map(parseResult1.nodes.map((n) => [n.nodeId, n]));
    const serialized = serializeTokenResolver(nodes);
    const parseResult2 = parseTokenResolver(serialized);

    // Both parses should have same number of token and group nodes
    const getTokenCount = (nodes: TreeNode<TreeNodeMeta>[]) =>
      nodes.filter((n) => n.meta.nodeType === "token").length;
    expect(getTokenCount(parseResult2.nodes)).toBe(
      getTokenCount(parseResult1.nodes),
    );
  });

  test("serializes without document metadata when not provided", () => {
    const resolver = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Test",
          sources: [],
        },
      ],
    });

    const nodes = new Map(resolver.nodes.map((n) => [n.nodeId, n]));
    const document = serializeTokenResolver(nodes);

    expect(document.name).toBeUndefined();
    expect(document.description).toBeUndefined();
    expect(document.version).toBe("2025.10");
  });

  test("preserves token descriptions and extensions through roundtrip", () => {
    const original = {
      version: "2025.10" as const,
      resolutionOrder: [
        {
          type: "set" as const,
          name: "Documented",
          sources: [
            {
              brand: {
                $type: "color" as const,
                $value: { colorSpace: "srgb" as const, components: [0, 0, 1] },
                $description: "Brand primary color",
                $extensions: { "custom.key": { data: "value" } },
              },
            },
          ],
        },
      ],
    };

    const parseResult1 = parseTokenResolver(original);
    const nodes = new Map(parseResult1.nodes.map((n) => [n.nodeId, n]));
    const serialized = serializeTokenResolver(nodes);
    const parseResult2 = parseTokenResolver(serialized);

    // Find the brand token in both results
    const brandToken1 = parseResult1.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "brand",
    );
    const brandToken2 = parseResult2.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "brand",
    );

    expect(brandToken1?.meta.description).toBe("Brand primary color");
    expect(brandToken2?.meta.description).toBe("Brand primary color");
  });

  test("handles multiple sets with mixed content", () => {
    const resolver = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              colors: {
                $type: "color",
                primary: {
                  $value: { colorSpace: "srgb", components: [0, 0, 1] },
                },
              },
            },
          ],
        },
        {
          type: "set",
          name: "Components",
          sources: [
            {
              buttons: {
                primary: {
                  background: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 1] },
                  },
                  padding: {
                    $type: "dimension",
                    $value: { value: 8, unit: "px" },
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const nodes = new Map(resolver.nodes.map((n) => [n.nodeId, n]));
    const document = serializeTokenResolver(nodes);

    expect(document.resolutionOrder).toHaveLength(2);
    expect(document.resolutionOrder[0].name).toBe("Foundation");
    expect(document.resolutionOrder[1].name).toBe("Components");

    // Serialize and parse again
    const parseResult2 = parseTokenResolver(document);
    expect(parseResult2.errors).toHaveLength(0);
  });

  test("serializes both sets and modifiers in resolutionOrder", () => {
    const resolver = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Base",
          sources: [
            {
              colors: {
                primary: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 1] },
                },
              },
            },
          ],
        },
        {
          type: "modifier",
          name: "Theme",
          contexts: {
            light: [],
            dark: [],
          },
        },
      ],
    });

    const nodes = new Map(resolver.nodes.map((n) => [n.nodeId, n]));
    const document = serializeTokenResolver(nodes);

    // Should have both Base set and Theme modifier
    expect(document.resolutionOrder).toHaveLength(2);
    expect(document.resolutionOrder[0].name).toBe("Base");
    expect(document.resolutionOrder[0].type).toBe("set");
    expect(document.resolutionOrder[1].name).toBe("Theme");
    expect(document.resolutionOrder[1].type).toBe("modifier");
  });
});

describe("cross-set aliases", () => {
  test("preserves cross-set group extensions as group NodeRefs", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              base: {
                value: { $type: "number", $value: 1 },
              },
            },
          ],
        },
        {
          type: "set",
          name: "Components",
          sources: [{ derived: { $extends: "{base}" } }],
        },
      ],
    });

    expect(result.errors).toEqual([]);
    const base = result.nodes.find((node) => node.meta.name === "base");
    const derived = result.nodes.find((node) => node.meta.name === "derived");
    expect(derived?.meta).toEqual(
      expect.objectContaining({
        nodeType: "token-group",
        extends: { ref: base?.nodeId },
      }),
    );

    const serialized = serializeTokenResolver(
      new Map(result.nodes.map((node) => [node.nodeId, node])),
    );
    expect(serialized.resolutionOrder[1]).toEqual(
      expect.objectContaining({
        type: "set",
        name: "Components",
        sources: [{ derived: { $extends: "{base}" } }],
      }),
    );
  });

  test("rejects a cross-set token as a group extension target", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [{ base: { $type: "number", $value: 1 } }],
        },
        {
          type: "set",
          name: "Components",
          sources: [{ derived: { $extends: "{base}" } }],
        },
      ],
    });

    expect(result.errors).toContainEqual({
      path: "derived",
      message: 'Group extension target must be a group: "{base}"',
    });
  });

  test("reports group extension cycles across sets", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "First",
          sources: [{ first: { $extends: "{second}" } }],
        },
        {
          type: "set",
          name: "Second",
          sources: [{ second: { $extends: "{first}" } }],
        },
      ],
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

  test("allows tokens to reference tokens from other sets", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              colors: {
                primary: {
                  $type: "color",
                  $value: {
                    colorSpace: "srgb",
                    components: [0, 0, 1],
                  },
                },
              },
            },
          ],
        },
        {
          type: "set",
          name: "Components",
          sources: [
            {
              button: {
                background: {
                  $type: "color",
                  $value: "{colors.primary}",
                },
              },
            },
          ],
        },
      ],
    });

    expect(result.errors).toHaveLength(0);
    const buttonBg = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "background",
    );
    expect(buttonBg).toBeDefined();
  });

  test("allows references regardless of set resolution order", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              primary: {
                $type: "color",
                $value: {
                  colorSpace: "srgb",
                  components: [1, 0, 0],
                },
              },
            },
          ],
        },
        {
          type: "set",
          name: "Semantic",
          sources: [
            {
              color: {
                derived: {
                  $type: "color",
                  $value: "{primary}",
                },
              },
            },
          ],
        },
      ],
    });

    expect(result.errors).toHaveLength(0);
  });

  test("supports multi-hop references across multiple sets", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Base",
          sources: [
            {
              color: {
                primary: {
                  $type: "color",
                  $value: {
                    colorSpace: "srgb",
                    components: [0, 0, 1],
                  },
                },
              },
            },
          ],
        },
        {
          type: "set",
          name: "Semantic",
          sources: [
            {
              brand: {
                $type: "color",
                $value: "{color.primary}",
              },
            },
          ],
        },
        {
          type: "set",
          name: "Component",
          sources: [
            {
              button: {
                bg: {
                  $type: "color",
                  $value: "{brand}",
                },
              },
            },
          ],
        },
      ],
    });

    expect(result.errors).toHaveLength(0);
  });

  test("reports error when cross-set reference cannot be resolved", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Components",
          sources: [
            {
              button: {
                background: {
                  $type: "color",
                  $value: "{missing.color}",
                },
              },
            },
          ],
        },
      ],
    });

    expect(result.errors.length).toBeGreaterThan(0);
    // Error occurs because the reference cannot be resolved, resulting in type mismatch
    expect(result.errors[0].path).toContain("background");
  });

  test("detects circular references across sets", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              primary: {
                $type: "color",
                $value: "{semantic.derived}",
              },
            },
          ],
        },
        {
          type: "set",
          name: "Semantic",
          sources: [
            {
              derived: {
                $type: "color",
                $value: "{primary}",
              },
            },
          ],
        },
      ],
    });

    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("supports cross-set references in composite tokens", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Primitives",
          sources: [
            {
              color: {
                black: {
                  $type: "color",
                  $value: {
                    colorSpace: "srgb",
                    components: [0, 0, 0],
                  },
                },
              },
              spacing: {
                xs: {
                  $type: "dimension",
                  $value: {
                    value: 2,
                    unit: "px",
                  },
                },
              },
            },
          ],
        },
        {
          type: "set",
          name: "Components",
          sources: [
            {
              border: {
                default: {
                  $type: "border",
                  $value: {
                    color: "{color.black}",
                    width: "{spacing.xs}",
                    style: "solid",
                  },
                },
              },
            },
          ],
        },
      ],
    });

    expect(result.errors).toHaveLength(0);
    const borderToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "default",
    );
    expect(borderToken).toBeDefined();
  });

  test("allows cross-set references to be used regardless of strict type checking", () => {
    // Type validation for cross-set references is limited
    // The resolver validates that references can be resolved, but not strict type compatibility
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Primitives",
          sources: [
            {
              spacing: {
                base: {
                  $type: "dimension",
                  $value: {
                    value: 4,
                    unit: "px",
                  },
                },
              },
            },
          ],
        },
        {
          type: "set",
          name: "Semantic",
          sources: [
            {
              color: {
                primary: {
                  $type: "color",
                  $value: "{spacing.base}",
                },
              },
            },
          ],
        },
      ],
    });

    // References are allowed, even if types don't strictly match
    // Type validation at consumption time is the responsibility of the consumer
    expect(result.errors).toHaveLength(0);
  });

  test("roundtrip preserves cross-set references in tree structure", () => {
    // Cross-set references are preserved in the internal tree structure
    const original = {
      version: "2025.10" as const,
      resolutionOrder: [
        {
          type: "set" as const,
          name: "Foundation",
          sources: [
            {
              colors: {
                primary: {
                  $type: "color" as const,
                  $value: {
                    colorSpace: "srgb" as const,
                    components: [0, 0, 1],
                  },
                },
              },
            },
          ],
        },
        {
          type: "set" as const,
          name: "Components",
          sources: [
            {
              button: {
                background: {
                  $type: "color" as const,
                  $value: "{colors.primary}",
                },
              },
            },
          ],
        },
      ],
    };

    const parseResult1 = parseTokenResolver(original);
    expect(parseResult1.errors).toHaveLength(0);

    // Verify the cross-set reference was resolved
    const backgroundToken = parseResult1.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "background",
    );
    expect(backgroundToken).toBeDefined();
    if (backgroundToken && backgroundToken.meta.nodeType === "token") {
      // Token should have a reference value (NodeRef) pointing to colors.primary
      expect(backgroundToken.meta.value).toHaveProperty("ref");
    }
  });

  test("handles multiple sets with interconnected cross-set references", () => {
    const original = {
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "CoreColors",
          sources: [
            {
              red: {
                $type: "color",
                $value: {
                  colorSpace: "srgb",
                  components: [1, 0, 0],
                },
              },
              blue: {
                $type: "color",
                $value: {
                  colorSpace: "srgb",
                  components: [0, 0, 1],
                },
              },
            },
          ],
        },
        {
          type: "set",
          name: "SemanticColors",
          sources: [
            {
              error: {
                $type: "color",
                $value: "{red}",
              },
              info: {
                $type: "color",
                $value: "{blue}",
              },
            },
          ],
        },
        {
          type: "set",
          name: "ComponentStyles",
          sources: [
            {
              alert: {
                background: {
                  $type: "color",
                  $value: "{error}",
                },
              },
              badge: {
                background: {
                  $type: "color",
                  $value: "{info}",
                },
              },
            },
          ],
        },
      ],
    };
    const result = parseTokenResolver(original);
    expect(result.errors).toHaveLength(0);
    expect(
      result.nodes.filter((n) => n.meta.nodeType === "token-set"),
    ).toHaveLength(3);
    expect(
      serializeTokenResolver(
        new Map(result.nodes.map((node) => [node.nodeId, node])),
      ),
    ).toEqual(original);
  });

  test("supports cross-set references from nested group tokens", () => {
    const original = {
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Base",
          sources: [
            {
              dimensions: {
                spacing: {
                  small: {
                    $type: "dimension",
                    $value: {
                      value: 8,
                      unit: "px",
                    },
                  },
                },
              },
            },
          ],
        },
        {
          type: "set",
          name: "Components",
          sources: [
            {
              button: {
                styles: {
                  padding: {
                    $type: "dimension",
                    $value: "{dimensions.spacing.small}",
                  },
                },
              },
            },
          ],
        },
      ],
    };
    const result = parseTokenResolver(original);
    expect(result.errors).toHaveLength(0);
    expect(
      serializeTokenResolver(
        new Map(result.nodes.map((node) => [node.nodeId, node])),
      ),
    ).toEqual(original);
  });

  test("parses simple modifier with contexts", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "theme",
          contexts: {
            light: [
              {
                color: {
                  text: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 0] },
                  },
                },
              },
            ],
            dark: [
              {
                color: {
                  text: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [1, 1, 1] },
                  },
                },
              },
            ],
          },
          default: "light",
        },
      ],
    });

    expect(result.errors).toHaveLength(0);

    // Should have modifier node and context nodes
    const modifierNode = result.nodes.find(
      (n) => n.meta.nodeType === "token-modifier",
    );
    expect(modifierNode).toBeDefined();
    expect(modifierNode?.meta.name).toBe("theme");

    // Should have 2 context nodes (light and dark)
    const contextNodes = result.nodes.filter(
      (n) => n.meta.nodeType === "token-context",
    );
    expect(contextNodes).toHaveLength(2);
    expect(contextNodes.map((n) => n.meta.name).sort()).toEqual([
      "dark",
      "light",
    ]);

    // Contexts should have modifier as parent
    contextNodes.forEach((context) => {
      expect(context.parentId).toBe(modifierNode?.nodeId);
    });

    // Default should be NodeRef pointing to light context
    if (modifierNode?.meta.nodeType === "token-modifier") {
      const modifierMeta = modifierNode.meta;
      expect(modifierMeta.default).toBeDefined();
      const defaultNode = result.nodes.find(
        (n) =>
          n.nodeId === modifierMeta.default?.ref &&
          n.meta.nodeType === "token-context",
      );
      expect(defaultNode?.meta.name).toBe("light");
    }
  });

  test("parses modifier contexts with multiple sources", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "contrast",
          contexts: {
            normal: [
              {
                color: {
                  text: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0.2, 0.2, 0.2] },
                  },
                },
              },
            ],
            high: [
              {
                color: {
                  text: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 0] },
                  },
                },
              },
              {
                color: {
                  text: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 0] },
                  }, // Override - last wins
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.errors).toHaveLength(0);

    // Modifier and contexts should exist
    const modifierNode = result.nodes.find(
      (n) => n.meta.nodeType === "token-modifier",
    );
    expect(modifierNode).toBeDefined();

    const contextNodes = result.nodes.filter(
      (n) => n.meta.nodeType === "token-context",
    );
    expect(contextNodes).toHaveLength(2);
  });

  test("serializes modifier back to original format", () => {
    const original = {
      version: "2025.10" as const,
      resolutionOrder: [
        {
          type: "modifier" as const,
          name: "theme",
          contexts: {
            light: [
              {
                color: {
                  primary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [1, 0, 0] },
                  },
                },
              },
            ],
            dark: [
              {
                color: {
                  primary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 0] },
                  },
                },
              },
            ],
          },
          default: "light",
        },
      ],
    };

    const result = parseTokenResolver(original);
    expect(result.errors).toHaveLength(0);

    const serialized = serializeTokenResolver(
      new Map(result.nodes.map((node) => [node.nodeId, node])),
    );

    expect(serialized).toEqual(original);
  });

  test("preserves modifier description and extensions", () => {
    const original = {
      version: "2025.10" as const,
      resolutionOrder: [
        {
          type: "modifier" as const,
          name: "theme",
          description: "Color theme switcher",
          contexts: {
            light: [
              {
                color: {
                  bg: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [1, 1, 1] },
                  },
                },
              },
            ],
            dark: [
              {
                color: {
                  bg: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 0] },
                  },
                },
              },
            ],
          },
          $extensions: {
            "figma.com": {
              updatedAt: "2025-01-27",
            },
          },
        },
      ],
    };

    const result = parseTokenResolver(original);
    expect(result.errors).toHaveLength(0);

    const modifierNode = result.nodes.find(
      (n) => n.meta.nodeType === "token-modifier",
    );
    expect(modifierNode?.meta.description).toBe("Color theme switcher");
    expect(modifierNode?.meta.extensions).toEqual({
      "figma.com": {
        updatedAt: "2025-01-27",
      },
    });

    const serialized = serializeTokenResolver(
      new Map(result.nodes.map((node) => [node.nodeId, node])),
    );
    expect(serialized).toEqual(original);
  });

  test("tokens under context are re-parented to context node", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "theme",
          contexts: {
            light: [
              {
                colors: {
                  primary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [1, 0, 0] },
                  },
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.errors).toHaveLength(0);

    const contextNode = result.nodes.find(
      (n) => n.meta.nodeType === "token-context",
    );
    expect(contextNode).toBeDefined();

    // Find token under context
    const tokenNode = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "primary",
    );
    expect(tokenNode).toBeDefined();

    // Token should have context as ancestor
    let currentNode = tokenNode;
    while (currentNode?.parentId) {
      currentNode = result.nodes.find(
        (n) => n.nodeId === currentNode?.parentId,
      );
      if (currentNode?.meta.nodeType === "token-context") {
        expect(currentNode.nodeId).toBe(contextNode?.nodeId);
        return;
      }
    }
    throw new Error("Token should have context as ancestor");
  });
});

describe("modifier isolation - modifiers should not pollute global namespace", () => {
  test("modifier can reference global set tokens", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              colors: {
                primary: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 1] },
                },
              },
            },
          ],
        },
        {
          type: "modifier",
          name: "theme",
          contexts: {
            dark: [
              {
                colors: {
                  background: {
                    $type: "color",
                    $value: "{colors.primary}",
                  },
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.errors).toHaveLength(0);

    // Find the background token in the dark context
    const backgroundToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "background",
    );
    expect(backgroundToken).toBeDefined();
    if (backgroundToken && backgroundToken.meta.nodeType === "token") {
      // Should reference the primary token from Foundation set
      expect(backgroundToken.meta.value).toHaveProperty("ref");
    }
  });

  test("modifier can reference own context tokens", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "theme",
          contexts: {
            dark: [
              {
                colors: {
                  primary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 1] },
                  },
                  background: {
                    $type: "color",
                    $value: "{colors.primary}",
                  },
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.errors).toHaveLength(0);

    // Find the background token
    const backgroundToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "background",
    );
    expect(backgroundToken).toBeDefined();
    if (backgroundToken && backgroundToken.meta.nodeType === "token") {
      // Should reference the primary token from the same context
      expect(backgroundToken.meta.value).toHaveProperty("ref");
    }
  });

  test("modifier cannot reference tokens from other modifiers", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "theme",
          contexts: {
            dark: [
              {
                colors: {
                  primary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 1] },
                  },
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
                colors: {
                  // This tries to reference a token from the 'theme' modifier
                  // which should fail because modifiers don't pollute global space
                  background: {
                    $type: "color",
                    $value: "{colors.primary}",
                  },
                },
              },
            ],
          },
        },
      ],
    });

    // Should have an error because the reference cannot be resolved
    expect(result.errors.length).toBeGreaterThan(0);
    expect(
      result.errors.some(
        (e) => e.path.includes("background") || e.message.includes("not found"),
      ),
    ).toBe(true);
  });

  test("set cannot reference modifier tokens", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "theme",
          contexts: {
            dark: [
              {
                colors: {
                  primary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 1] },
                  },
                },
              },
            ],
          },
        },
        {
          type: "set",
          name: "Components",
          sources: [
            {
              button: {
                // This tries to reference a token from the 'theme' modifier
                // which should fail because modifiers don't pollute global space
                background: {
                  $type: "color",
                  $value: "{colors.primary}",
                },
              },
            },
          ],
        },
      ],
    });

    // Should have an error because the reference cannot be resolved
    expect(result.errors.length).toBeGreaterThan(0);
    expect(
      result.errors.some(
        (e) => e.path.includes("background") || e.message.includes("not found"),
      ),
    ).toBe(true);
  });

  test("modifier contexts are isolated from each other", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "theme",
          contexts: {
            light: [
              {
                colors: {
                  primary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [1, 1, 1] },
                  },
                },
              },
            ],
            dark: [
              {
                colors: {
                  // This tries to reference 'primary' from the light context
                  // which should fail because contexts within a modifier are also isolated
                  background: {
                    $type: "color",
                    $value: "{colors.primary}",
                  },
                },
              },
            ],
          },
        },
      ],
    });

    // Should have an error because dark context cannot reference light context tokens
    expect(result.errors.length).toBeGreaterThan(0);
    expect(
      result.errors.some(
        (e) => e.path.includes("background") || e.message.includes("not found"),
      ),
    ).toBe(true);
  });
});
