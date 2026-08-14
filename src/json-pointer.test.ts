import { describe, expect, test } from "vitest";

import { materializeJsonReferences, resolveJsonPointer } from "./json-pointer";

describe("resolveJsonPointer", () => {
  test("decodes escaped slashes and tildes in object keys", () => {
    const input = { "a/b": { "m~n": 42 } };

    expect(resolveJsonPointer(input, "/a~1b/m~0n")).toBe(42);
  });

  test("resolves object properties and array elements", () => {
    const input = { groups: [{ name: "first" }, { name: "second" }] };

    expect(resolveJsonPointer(input, "/groups/1/name")).toBe("second");
    expect(resolveJsonPointer(input, "")).toBe(input);
  });
});

describe("materializeJsonReferences", () => {
  test("recursively materializes local references", () => {
    const input = {
      definitions: {
        base: { value: 12 },
        intermediate: { $ref: "#/definitions/base" },
      },
      result: { $ref: "#/definitions/intermediate" },
    };

    expect(materializeJsonReferences(input)).toEqual({
      value: {
        definitions: {
          base: { value: 12 },
          intermediate: { value: 12 },
        },
        result: { value: 12 },
      },
      errors: [],
    });
  });

  test("applies reference siblings as overrides", () => {
    const input = {
      definitions: { base: { label: "base", nested: { retained: true } } },
      result: { $ref: "#/definitions/base", label: "override" },
    };

    expect(materializeJsonReferences(input).value).toEqual({
      definitions: {
        base: { label: "base", nested: { retained: true } },
      },
      result: { label: "override", nested: { retained: true } },
    });
  });

  test("does not mutate referenced values or the input document", () => {
    const input = {
      definitions: { base: { label: "base" } },
      result: { $ref: "#/definitions/base", label: "override" },
    };
    const snapshot = structuredClone(input);
    const result = materializeJsonReferences(input);

    expect(input).toEqual(snapshot);
    expect(result.value).not.toBe(input);
    expect((result.value as typeof input).definitions.base).not.toBe(
      input.definitions.base,
    );
  });

  test("reports missing reference targets with the reference path", () => {
    const input = { result: { $ref: "#/definitions/missing" } };

    expect(materializeJsonReferences(input)).toEqual({
      value: input,
      errors: [
        {
          path: "/result/$ref",
          message: 'JSON Pointer target not found: "#/definitions/missing"',
        },
      ],
    });
  });

  test("reports unsupported external references", () => {
    const input = { result: { $ref: "tokens.json#/definitions/base" } };

    expect(materializeJsonReferences(input)).toEqual({
      value: input,
      errors: [
        {
          path: "/result/$ref",
          message:
            'External JSON reference is not supported: "tokens.json#/definitions/base"',
        },
      ],
    });
  });

  test("reports reference cycles without recursing indefinitely", () => {
    const input = {
      first: { $ref: "#/second" },
      second: { $ref: "#/first" },
    };
    const result = materializeJsonReferences(input);

    expect(result.value).toEqual(input);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          path: expect.stringMatching(/^\/(first|second)\/\$ref$/),
          message: expect.stringContaining("Circular JSON reference"),
        },
      ]),
    );
  });

  test("preserves reference-shaped data under $extensions", () => {
    const input = {
      definitions: { base: { value: 12 } },
      token: {
        $extensions: {
          metadata: { $ref: "#/definitions/base" },
        },
      },
    };

    expect(materializeJsonReferences(input)).toEqual({
      value: input,
      errors: [],
    });
  });
});
