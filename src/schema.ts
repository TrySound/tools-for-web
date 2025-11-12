import { z } from "zod";

// Component can be a number or the 'none' keyword
const ComponentSchema = z.union([z.number(), z.literal("none")]);

// Supported color spaces according to Design Tokens spec
const SupportedColorSpaces = z.enum([
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

const ColorValueSchema = z.object({
  colorSpace: SupportedColorSpaces,
  components: z.array(ComponentSchema),
  alpha: z.number().min(0).max(1).optional(),
  hex: z.string().optional(),
});

export type ColorValue = z.infer<typeof ColorValueSchema>;

const ColorSchema = z.object({
  type: z.literal("color"),
  value: ColorValueSchema,
});

const DimensionValueSchema = z.object({
  value: z.number(),
  unit: z.enum(["px", "rem"]),
});

export type DimensionValue = z.infer<typeof DimensionValueSchema>;

const DimensionSchema = z.object({
  type: z.literal("dimension"),
  value: DimensionValueSchema,
});

const DurationValueSchema = z.object({
  value: z.number(),
  unit: z.enum(["ms", "s"]),
});

export type DurationValue = z.infer<typeof DurationValueSchema>;

const DurationSchema = z.object({
  type: z.literal("duration"),
  value: DurationValueSchema,
});

const NumberSchema = z.object({
  type: z.literal("number"),
  value: z.number(),
});

const CubicBezierValueSchema = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .refine(
    ([x1, , x2]) => x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1,
    "Cubic bezier x-coordinates must be between 0 and 1",
  );

export type CubicBezierValue = z.infer<typeof CubicBezierValueSchema>;

const CubicBezierSchema = z.object({
  type: z.literal("cubicBezier"),
  value: CubicBezierValueSchema,
});

const FontFamilyValueSchema = z.union([z.string(), z.array(z.string())]);

export type FontFamilyValue = z.infer<typeof FontFamilyValueSchema>;

const FontFamilySchema = z.object({
  type: z.literal("fontFamily"),
  value: FontFamilyValueSchema,
});

const FontWeightValueSchema = z.union([z.number(), z.string()]);

const FontWeightSchema = z.object({
  type: z.literal("fontWeight"),
  value: FontWeightValueSchema,
});

const TransitionValueSchema = z.object({
  duration: DurationValueSchema,
  delay: DurationValueSchema,
  timingFunction: CubicBezierValueSchema,
});

export type TransitionValue = z.infer<typeof TransitionValueSchema>;

const TransitionSchema = z.object({
  type: z.literal("transition"),
  value: TransitionValueSchema,
});

const StrokeStyleValueSchema = z.union([
  z.literal("solid"),
  z.literal("dashed"),
  z.literal("dotted"),
  z.literal("double"),
  z.literal("groove"),
  z.literal("ridge"),
  z.literal("outset"),
  z.literal("inset"),
  z.object({
    dashArray: z.array(DimensionValueSchema),
    lineCap: z.union([
      z.literal("round"),
      z.literal("butt"),
      z.literal("square"),
    ]),
  }),
]);

export type StrokeStyleValue = z.infer<typeof StrokeStyleValueSchema>;

const StrokeStyleSchema = z.object({
  type: z.literal("strokeStyle"),
  value: StrokeStyleValueSchema,
});

const ShadowItemSchema = z.object({
  color: ColorValueSchema,
  offsetX: DimensionValueSchema,
  offsetY: DimensionValueSchema,
  blur: DimensionValueSchema,
  spread: DimensionValueSchema.optional(),
  inset: z.boolean().optional(),
});

const ShadowValueSchema = z.union([
  ShadowItemSchema,
  z.array(ShadowItemSchema),
]);

export type ShadowValue = z.infer<typeof ShadowValueSchema>;

const ShadowSchema = z.object({
  type: z.literal("shadow"),
  value: ShadowValueSchema,
});

const BorderValueSchema = z.object({
  color: ColorValueSchema,
  width: DimensionValueSchema,
  style: StrokeStyleValueSchema,
});

export type BorderValue = z.infer<typeof BorderValueSchema>;

const BorderSchema = z.object({
  type: z.literal("border"),
  value: BorderValueSchema,
});

const TypographyValueSchema = z.object({
  fontFamily: FontFamilyValueSchema,
  fontSize: DimensionValueSchema,
  fontWeight: FontWeightValueSchema,
  letterSpacing: DimensionValueSchema,
  lineHeight: z.number(),
});

export type TypographyValue = z.infer<typeof TypographyValueSchema>;

const TypographySchema = z.object({
  type: z.literal("typography"),
  value: TypographyValueSchema,
});

const GradientStopSchema = z.object({
  color: ColorValueSchema,
  position: z.number().min(0).max(1),
});

const GradientValueSchema = z.array(GradientStopSchema);

export type GradientValue = z.infer<typeof GradientValueSchema>;

const GradientSchema = z.object({
  type: z.literal("gradient"),
  value: GradientValueSchema,
});

export const ValueSchema = z.union([
  ColorSchema,
  DimensionSchema,
  DurationSchema,
  CubicBezierSchema,
  NumberSchema,
  FontFamilySchema,
  FontWeightSchema,
  TransitionSchema,
  StrokeStyleSchema,
  ShadowSchema,
  BorderSchema,
  TypographySchema,
  GradientSchema,
]);

export type Value = z.infer<typeof ValueSchema>;
