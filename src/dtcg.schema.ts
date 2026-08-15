// Zod schema based on Design Tokens Community Group specification
// JSON Pointer references are materialized before these canonical schemas run.

import * as z from "zod/mini";

// token and group names MUST NOT:
// - start with '$' (reserved prefix per DTCG spec)
// - contain '{' (used in references syntax)
// - contain '}' (used in references syntax)
// - contain '.' (used in path separators within references)
export const nameSchema = z.string().check(
  z.refine(
    (name) => !name.startsWith("$"),
    "Token and group names must not start with '$'",
  ),
  z.refine(
    (name) => !name.includes("{"),
    "Token and group names must not contain '{'",
  ),
  z.refine(
    (name) => !name.includes("}"),
    "Token and group names must not contain '}'",
  ),
  z.refine(
    (name) => !name.includes("."),
    "Token and group names must not contain '.'",
  ),
);

// references use dot-separated paths with curly braces like {colors.primary}
// each segment must be a valid name per nameSchema
// special case: $root token is allowed within references as it uses the $ prefix
export const referenceSchema = z.string().check(
  z.refine(
    (value) => value.startsWith("{") && value.endsWith("}"),
    "Reference must be enclosed in curly braces",
  ),
  z.refine((value) => {
    const content = value.slice(1, -1);
    const segments = content.split(".");
    return (
      segments.length > 0 &&
      segments.every((segment) => {
        // Allow $root as special case within references
        if (segment === "$root") return true;
        return nameSchema.safeParse(segment).success;
      })
    );
  }, "Each segment in reference must be a valid name"),
);

// Token types
const tokenType = z.enum([
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "duration",
  "cubicBezier",
  "number",
  "strokeStyle",
  "border",
  "transition",
  "shadow",
  "gradient",
  "typography",
]);

// primitive token values

const colorComponent = z.union([z.number(), z.literal("none")]);

const colorSpace = z.enum([
  "srgb",
  "srgb-linear",
  "hsl",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "display-p3",
  "a98-rgb",
  "prophoto-rgb",
  "rec2020",
  "xyz-d65",
  "xyz-d50",
]);

export const colorValue = z.object({
  colorSpace: colorSpace,
  components: z.array(colorComponent),
  alpha: z.optional(z.number()),
  hex: z.optional(z.string()),
});

export const dimensionValue = z.object({
  value: z.number(),
  unit: z.enum(["px", "rem"]),
});

export const fontFamilyValue = z.union([
  z.string(),
  z.array(z.string()).check(z.minLength(1)),
]);

export const fontWeightValue = z.union([
  z.number().check(z.minimum(1), z.maximum(1000)),
  z.enum([
    "thin",
    "hairline",
    "extra-light",
    "ultra-light",
    "light",
    "normal",
    "regular",
    "book",
    "medium",
    "semi-bold",
    "demi-bold",
    "bold",
    "extra-bold",
    "ultra-bold",
    "black",
    "heavy",
    "extra-black",
    "ultra-black",
  ]),
]);

export const durationValue = z.object({
  value: z.number(),
  unit: z.enum(["ms", "s"]),
});

export const cubicBezierValue = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);

export const numberValue = z.number();

export const strokeStyleString = z.enum([
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "outset",
  "inset",
]);

export const strokeStyleValue = z.union([
  strokeStyleString,
  z.object({
    dashArray: z.array(dimensionValue).check(z.minLength(1)),
    lineCap: z.enum(["round", "butt", "square"]),
  }),
]);

// composite token values

export const borderValue = z.object({
  color: z.union([colorValue, referenceSchema]),
  width: z.union([dimensionValue, referenceSchema]),
  style: z.union([strokeStyleValue, referenceSchema]),
});

export const transitionValue = z.object({
  duration: z.union([durationValue, referenceSchema]),
  delay: z.union([durationValue, referenceSchema]),
  timingFunction: z.union([cubicBezierValue, referenceSchema]),
});

const shadowObject = z.object({
  color: z.union([colorValue, referenceSchema]),
  offsetX: z.union([dimensionValue, referenceSchema]),
  offsetY: z.union([dimensionValue, referenceSchema]),
  blur: z.union([dimensionValue, referenceSchema]),
  spread: z.union([dimensionValue, referenceSchema]),
  inset: z.optional(z.boolean()),
});

export const shadowValue = z.union([
  shadowObject,
  z.array(shadowObject).check(z.minLength(1)),
]);

const gradientStop = z.object({
  color: z.union([colorValue, referenceSchema]),
  position: z.number(),
});

export const gradientValue = z.array(gradientStop).check(z.minLength(1));

export const typographyValue = z.object({
  fontFamily: z.union([fontFamilyValue, referenceSchema]),
  fontSize: z.union([dimensionValue, referenceSchema]),
  fontWeight: z.union([fontWeightValue, referenceSchema]),
  letterSpacing: z.union([dimensionValue, referenceSchema]),
  lineHeight: z.union([numberValue, referenceSchema]),
});

export const tokenSchema = z.object({
  $value: z.union([
    colorValue,
    dimensionValue,
    fontFamilyValue,
    fontWeightValue,
    durationValue,
    cubicBezierValue,
    numberValue,
    strokeStyleValue,
    borderValue,
    transitionValue,
    shadowValue,
    gradientValue,
    typographyValue,
    referenceSchema,
  ]),
  $type: z.optional(tokenType),
  $description: z.optional(z.string()),
  $extensions: z.optional(z.record(z.string(), z.unknown())),
  $deprecated: z.optional(z.union([z.boolean(), z.string()])),
});

export const groupSchema = z.object({
  $type: z.optional(tokenType),
  $description: z.optional(z.string()),
  $extensions: z.optional(z.record(z.string(), z.unknown())),
  $extends: z.optional(referenceSchema),
  $deprecated: z.optional(z.union([z.boolean(), z.string()])),
  $root: z.optional(tokenSchema),
});

export type Token = z.infer<typeof tokenSchema>;
export type Group = z.infer<typeof groupSchema>;
export type TokenType = z.infer<typeof tokenType>;
export type ColorValue = z.infer<typeof colorValue>;
export type DimensionValue = z.infer<typeof dimensionValue>;
export type FontFamilyValue = z.infer<typeof fontFamilyValue>;
export type FontWeightValue = z.infer<typeof fontWeightValue>;
export type DurationValue = z.infer<typeof durationValue>;
export type CubicBezierValue = z.infer<typeof cubicBezierValue>;
export type StrokeStyleValue = z.infer<typeof strokeStyleValue>;
export type BorderValue = z.infer<typeof borderValue>;
export type TransitionValue = z.infer<typeof transitionValue>;
export type ShadowObject = z.infer<typeof shadowObject>;
export type ShadowValue = z.infer<typeof shadowValue>;
export type GradientValue = z.infer<typeof gradientValue>;
export type TypographyValue = z.infer<typeof typographyValue>;

// Design Tokens Resolver Module 2025.10
// https://www.designtokens.org/tr/2025.10/resolver/

// Single source is a Record where keys are group/token names
// values are Group or Token objects
export const resolverSourceSchema = z.record(
  z.string(),
  // avoid checking to not cut of nested groups and tokens
  // but enforce as a type
  z.unknown() as z.ZodMiniType<Token | Group>,
);

export type ResolverSource = z.infer<typeof resolverSourceSchema>;

export const resolverReferenceSchema = z.looseObject({
  $ref: z.string(),
});

export type ResolverReference = z.infer<typeof resolverReferenceSchema>;

export const rawResolverSourceSchema = z.union([
  resolverReferenceSchema,
  resolverSourceSchema.check(
    z.refine((source) => !("$ref" in source), "A source $ref must be a string"),
  ),
]);

export type RawResolverSource = z.infer<typeof rawResolverSourceSchema>;

export const resolverSetDefinitionSchema = z.object({
  sources: z.array(resolverSourceSchema),
  description: z.optional(z.string()),
  $extensions: z.optional(z.record(z.string(), z.unknown())),
});

export type ResolverSetDefinition = z.infer<typeof resolverSetDefinitionSchema>;

export const rawResolverSetDefinitionSchema = z.object({
  sources: z.array(rawResolverSourceSchema),
  description: z.optional(z.string()),
  $extensions: z.optional(z.record(z.string(), z.unknown())),
});

export type RawResolverSetDefinition = z.infer<
  typeof rawResolverSetDefinitionSchema
>;

// Set in resolutionOrder array - collection of design tokens
export const resolverSetSchema = z.object({
  type: z.literal("set"),
  name: nameSchema, // required, unique identifier within resolutionOrder
  sources: z.array(resolverSourceSchema), // non-optional, can be empty
  description: z.optional(z.string()),
  $extensions: z.optional(z.record(z.string(), z.unknown())),
});

export type ResolverSet = z.infer<typeof resolverSetSchema>;

export const rawResolverSetSchema = z.object({
  type: z.literal("set"),
  name: nameSchema,
  sources: z.array(rawResolverSourceSchema),
  description: z.optional(z.string()),
  $extensions: z.optional(z.record(z.string(), z.unknown())),
});

export type RawResolverSet = z.infer<typeof rawResolverSetSchema>;

// Modifier contexts - map of context name to sources
export const resolverModifierContextsSchema = z.record(
  z.string(), // context name (e.g., "light", "dark")
  z.array(resolverSourceSchema), // sources array (non-optional)
);

export const rawResolverModifierContextsSchema = z.record(
  z.string(),
  z.array(rawResolverSourceSchema),
);

type ResolverModifierShape = {
  contexts: Record<string, unknown>;
  default?: string;
};

export const resolverModifierDefinitionSchema = z.object({
  contexts: resolverModifierContextsSchema,
  description: z.optional(z.string()),
  default: z.optional(z.string()),
  $extensions: z.optional(z.record(z.string(), z.unknown())),
});

export type ResolverModifierDefinition = z.infer<
  typeof resolverModifierDefinitionSchema
>;

export const rawResolverModifierDefinitionSchema = z.object({
  contexts: rawResolverModifierContextsSchema,
  description: z.optional(z.string()),
  default: z.optional(z.string()),
  $extensions: z.optional(z.record(z.string(), z.unknown())),
});

export type RawResolverModifierDefinition = z.infer<
  typeof rawResolverModifierDefinitionSchema
>;

// Modifier in resolutionOrder - for documentation, parsed but skipped
export const resolverModifierSchema = z.object({
  type: z.literal("modifier"),
  name: nameSchema, // required, unique identifier within resolutionOrder
  contexts: resolverModifierContextsSchema, // non-optional
  description: z.optional(z.string()),
  default: z.optional(z.string()),
  $extensions: z.optional(z.record(z.string(), z.unknown())),
});

export type ResolverModifier = z.infer<typeof resolverModifierSchema>;

export const rawResolverModifierSchema = z.object({
  type: z.literal("modifier"),
  name: nameSchema,
  contexts: rawResolverModifierContextsSchema,
  description: z.optional(z.string()),
  default: z.optional(z.string()),
  $extensions: z.optional(z.record(z.string(), z.unknown())),
});

export type RawResolverModifier = z.infer<typeof rawResolverModifierSchema>;

// Item in resolutionOrder array
export const resolutionOrderItemSchema = z.union([
  resolverSetSchema,
  resolverModifierSchema,
]);

export type ResolutionOrderItem = z.infer<typeof resolutionOrderItemSchema>;

export const rawResolutionOrderItemSchema = z.union([
  resolverReferenceSchema,
  rawResolverSetSchema,
  rawResolverModifierSchema,
]);

export type RawResolutionOrderItem = z.infer<
  typeof rawResolutionOrderItemSchema
>;

type ResolverDocumentModifierShape = {
  modifiers?: Record<string, ResolverModifierShape>;
  resolutionOrder: Array<unknown>;
};

const resolverModifierSemantics = z.check<ResolverDocumentModifierShape>(
  (context) => {
    const validate = (
      modifier: ResolverModifierShape,
      path: Array<string | number>,
    ): void => {
      if (Object.keys(modifier.contexts).length === 0) {
        context.issues.push({
          code: "custom",
          input: modifier.contexts,
          message: "Modifier contexts must not be empty",
          path: [...path, "contexts"],
        });
      }
      if (
        modifier.default !== undefined &&
        !(modifier.default in modifier.contexts)
      ) {
        context.issues.push({
          code: "custom",
          input: modifier.default,
          message: `Modifier default must name an entry in contexts: "${modifier.default}"`,
          path: [...path, "default"],
        });
      }
    };

    for (const [name, modifier] of Object.entries(
      context.value.modifiers ?? {},
    )) {
      validate(modifier, ["modifiers", name]);
    }
    context.value.resolutionOrder.forEach((item, index) => {
      if (
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        item.type === "modifier" &&
        "contexts" in item
      ) {
        validate(item as ResolverModifierShape, ["resolutionOrder", index]);
      }
    });
  },
);

// Resolver document following Design Tokens Resolver Module 2025.10
export const resolverDocumentSchema = z
  .object({
    version: z.literal("2025.10"),
    name: z.optional(z.string()),
    description: z.optional(z.string()),
    $schema: z.optional(z.string()),
    $defs: z.optional(z.record(z.string(), z.unknown())),
    sets: z.optional(z.record(z.string(), resolverSetDefinitionSchema)),
    modifiers: z.optional(
      z.record(z.string(), resolverModifierDefinitionSchema),
    ),
    resolutionOrder: z.array(resolutionOrderItemSchema),
  })
  .check(resolverModifierSemantics);

export type ResolverDocument = z.infer<typeof resolverDocumentSchema>;

export const rawResolverDocumentSchema = z
  .object({
    version: z.literal("2025.10"),
    name: z.optional(z.string()),
    description: z.optional(z.string()),
    $schema: z.optional(z.string()),
    $defs: z.optional(z.record(z.string(), z.unknown())),
    sets: z.optional(z.record(z.string(), rawResolverSetDefinitionSchema)),
    modifiers: z.optional(
      z.record(z.string(), rawResolverModifierDefinitionSchema),
    ),
    resolutionOrder: z.array(rawResolutionOrderItemSchema),
  })
  .check(resolverModifierSemantics);

export type RawResolverDocument = z.infer<typeof rawResolverDocumentSchema>;
