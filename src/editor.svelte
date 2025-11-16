<script lang="ts">
  import type { SvelteSet } from "svelte/reactivity";
  import { Plus, X } from "@lucide/svelte";
  import { treeState, type TreeNodeMeta } from "./state.svelte";
  import { parseColor, serializeColor } from "./color";
  import type {
    BorderValue,
    CubicBezierValue,
    DimensionValue,
    FontFamilyValue,
    GradientValue,
    ShadowItem,
    StrokeStyleValue,
    TransitionValue,
  } from "./schema";
  import CubicBezierEditor from "./cubic-bezier-editor.svelte";
  import GradientEditor from "./gradient-editor.svelte";

  let {
    selectedItems,
    editingMode = $bindable(),
  }: { selectedItems: SvelteSet<string>; editingMode: boolean } = $props();

  const fontWeightMap: Record<string, number> = {
    thin: 100,
    hairline: 100,
    "extra-light": 200,
    "ultra-light": 200,
    light: 300,
    normal: 400,
    regular: 400,
    book: 400,
    medium: 500,
    "semi-bold": 600,
    "demi-bold": 600,
    bold: 700,
    "extra-bold": 800,
    "ultra-bold": 800,
    black: 900,
    heavy: 900,
    "extra-black": 950,
    "ultra-black": 950,
  };

  const normalizeFontWeight = (value: number | string): number => {
    if (typeof value === "number") {
      return value;
    }
    const normalized = value.toLowerCase().trim();
    return fontWeightMap[normalized] ?? Number.parseInt(value, 10);
  };

  const normalizeFontFamily = (value: string | string[]): string | string[] => {
    if (Array.isArray(value)) {
      return value;
    }
    // If it's a string with commas, split it into an array
    const trimmed = value.trim();
    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
    }
    // Otherwise keep it as a string
    return trimmed;
  };

  const node = $derived.by(() => {
    const nodeId = Array.from(selectedItems).at(0);
    if (nodeId) {
      return treeState.getNode(nodeId);
    }
  });
  const meta = $derived(node?.meta);

  const updateMeta = (newMeta: Partial<TreeNodeMeta>) => {
    if (node?.meta) {
      treeState.transact((tx) => {
        tx.set({
          ...node,
          meta: { ...node.meta, ...(newMeta as typeof node.meta) },
        });
      });
    }
  };

  const handleNameChange = (newName: string) => {
    updateMeta({ name: newName });
  };

  const handleDescriptionChange = (newDescription: string) => {
    updateMeta({ description: newDescription });
  };

  const handleDeprecatedChange = (deprecated: boolean | string) => {
    if (deprecated === "") {
      updateMeta({ deprecated: true });
    } else if (deprecated === false) {
      updateMeta({ deprecated: undefined });
    } else {
      updateMeta({ deprecated });
    }
  };
</script>

{#snippet dimensionEditor(
  dimension: DimensionValue,
  onChange: (value: DimensionValue) => void,
)}
  <div class="dimension-input-group">
    <input
      class="field dimension-value"
      type="number"
      value={dimension.value}
      step="0.1"
      placeholder="Value"
      oninput={(e) => {
        const value = Number.parseFloat(e.currentTarget.value);
        if (!Number.isNaN(value)) {
          onChange({ ...dimension, value });
        }
      }}
    />
    <select
      class="field dimension-unit-select"
      value={dimension.unit}
      onchange={(e) => {
        onChange({
          ...dimension,
          unit: e.currentTarget.value as "px" | "rem",
        });
      }}
    >
      <option value="px">px</option>
      <option value="rem">rem</option>
    </select>
  </div>
{/snippet}

{#snippet fontFamilyEditor(
  fontFamily: FontFamilyValue,
  onChange: (value: FontFamilyValue) => void,
)}
  <textarea
    class="field"
    placeholder="e.g., Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    value={typeof fontFamily === "string" ? fontFamily : fontFamily.join(", ")}
    oninput={(e) => {
      const input = e.currentTarget.value;
      const normalized = normalizeFontFamily(input);
      onChange(normalized);
    }}
  ></textarea>
{/snippet}

{#snippet fontWeightEditor(
  fontWeight: number | string,
  onChange: (value: number) => void,
)}
  <select
    class="field"
    value={String(normalizeFontWeight(fontWeight))}
    onchange={(e) => {
      const value = Number.parseInt(e.currentTarget.value, 10);
      onChange(value);
    }}
  >
    <option value="100">100 — thin, hairline</option>
    <option value="200">200 — extra-light, ultra-light</option>
    <option value="300">300 — light</option>
    <option value="400">400 — normal, regular, book</option>
    <option value="500">500 — medium</option>
    <option value="600">600 — semi-bold, demi-bold</option>
    <option value="700">700 — bold</option>
    <option value="800">800 — extra-bold, ultra-bold</option>
    <option value="900">900 — black, heavy</option>
    <option value="950">950 — extra-black, ultra-black</option>
  </select>
{/snippet}

{#snippet strokeStyleEditor(
  strokeStyle: StrokeStyleValue,
  onChange: (value: StrokeStyleValue) => void,
)}
  {#if typeof strokeStyle === "string"}
    <select
      class="field"
      value={strokeStyle}
      onchange={(e) => {
        const value = e.currentTarget.value;
        if (value !== "custom") {
          onChange(value as StrokeStyleValue);
        } else {
          onChange({
            dashArray: [{ value: 2, unit: "px" }],
            lineCap: "round",
          });
        }
      }}
    >
      <option value="solid">Solid</option>
      <option value="dashed">Dashed</option>
      <option value="dotted">Dotted</option>
      <option value="double">Double</option>
      <option value="groove">Groove</option>
      <option value="ridge">Ridge</option>
      <option value="outset">Outset</option>
      <option value="inset">Inset</option>
      <option value="custom">Custom</option>
    </select>
  {:else if typeof strokeStyle === "object" && "dashArray" in strokeStyle}
    <select
      class="field"
      value="custom"
      onchange={(e) => {
        const value = e.currentTarget.value;
        if (value !== "custom") {
          onChange(value as StrokeStyleValue);
        }
      }}
    >
      <option value="solid">Solid</option>
      <option value="dashed">Dashed</option>
      <option value="dotted">Dotted</option>
      <option value="double">Double</option>
      <option value="groove">Groove</option>
      <option value="ridge">Ridge</option>
      <option value="outset">Outset</option>
      <option value="inset">Inset</option>
      <option value="custom">Custom</option>
    </select>

    <div class="form-group">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>Line Cap</label>
      <select
        class="field"
        value={strokeStyle.lineCap}
        onchange={(e) => {
          onChange({
            ...strokeStyle,
            lineCap: e.currentTarget.value as "round" | "butt" | "square",
          });
        }}
      >
        <option value="round">Round</option>
        <option value="butt">Butt</option>
        <option value="square">Square</option>
      </select>
    </div>

    <div class="form-group">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>Dash Array</label>
      <div class="dash-array-list">
        {#each strokeStyle.dashArray as dash, index (index)}
          <div class="dash-array-item">
            <div class="dash-array-item-header">
              <span class="dash-array-item-title">Dash {index + 1}</span>
              {#if strokeStyle.dashArray.length > 1}
                <button
                  class="button"
                  aria-label="Remove dash"
                  onclick={() => {
                    const updated = strokeStyle.dashArray.filter(
                      (_, i: number) => i !== index,
                    );
                    onChange({
                      ...strokeStyle,
                      dashArray: updated,
                    });
                  }}
                >
                  <X size={20} />
                </button>
              {/if}
            </div>
            <div class="dash-array-item-body">
              {@render dimensionEditor(dash, (newDash) => {
                const updated = [...strokeStyle.dashArray];
                updated[index] = newDash;
                onChange({
                  ...strokeStyle,
                  dashArray: updated,
                });
              })}
            </div>
          </div>
        {/each}

        <button
          class="button"
          onclick={() => {
            onChange({
              ...strokeStyle,
              dashArray: [...strokeStyle.dashArray, { value: 2, unit: "px" }],
            });
          }}
        >
          <Plus /> Add Dash
        </button>
      </div>
    </div>
  {/if}
{/snippet}

<div class="form-panel">
  <div class="form-header">
    <h2 class="form-title">
      {meta?.nodeType === "token-group" ? "Group" : "Token"}
    </h2>
    <button
      class="button"
      aria-label="Close"
      aria-keyshortcuts="Escape"
      onclick={() => (editingMode = false)}
    >
      <X size={20} />
    </button>
  </div>

  <div class="form-content">
    <div class="form-group">
      <label for="name-input">Name</label>
      <input
        id="name-input"
        class="field"
        type="text"
        value={meta?.name}
        oninput={(e) => handleNameChange(e.currentTarget.value)}
      />
    </div>

    <div class="form-group">
      <label for="description-input">Description</label>
      <textarea
        id="description-input"
        class="field"
        value={meta?.description ?? ""}
        oninput={(e) => handleDescriptionChange(e.currentTarget.value)}
      ></textarea>
    </div>

    <div class="form-group">
      <label for="deprecated-input">
        <input
          id="deprecated-input"
          type="checkbox"
          checked={meta?.deprecated !== undefined}
          onchange={(e) => handleDeprecatedChange(e.currentTarget.checked)}
        />
        Deprecated
      </label>
      {#if meta?.deprecated !== undefined}
        <input
          class="field"
          type="text"
          placeholder="Reason for deprecation"
          bind:value={
            () => (typeof meta.deprecated === "string" ? meta.deprecated : ""),
            (reason) => handleDeprecatedChange(reason)
          }
        />
      {/if}
    </div>

    {#if meta?.nodeType === "token" && meta.type}
      <div class="form-group">
        <div class="form-label">Type</div>
        <div class="form-value">{meta.type}</div>
      </div>
    {/if}

    {#if meta?.nodeType === "token" && meta.type === "color"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Color</label>
        <div class="color-picker-wrapper">
          <color-input
            value={serializeColor(meta.value)}
            onopen={(event: InputEvent) => {
              // track both open and close because of bug in css-color-component
              const input = event.target as HTMLInputElement;
              updateMeta({ value: parseColor(input.value) });
            }}
            onclose={(event: InputEvent) => {
              const input = event.target as HTMLInputElement;
              updateMeta({ value: parseColor(input.value) });
            }}
          ></color-input>
          <span class="color-value">
            {serializeColor(meta.value)}
          </span>
        </div>
      </div>
    {/if}

    {#if meta?.nodeType === "token" && meta.type === "dimension"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Dimension</label>
        <div class="dimension-input-group">
          <input
            id="dimension-value-input"
            class="field dimension-value"
            type="number"
            value={meta.value.value}
            oninput={(e) => {
              const value = Number.parseFloat(e.currentTarget.value);
              if (!Number.isNaN(value)) {
                updateMeta({ value: { ...meta.value, value } });
              }
            }}
            step="0.1"
            placeholder="Value"
          />
          <select
            id="dimension-unit-input"
            class="field dimension-unit-select"
            value={meta.value.unit}
            onchange={(e) => {
              updateMeta({
                value: {
                  ...meta.value,
                  unit: e.currentTarget.value as "px" | "rem",
                },
              });
            }}
          >
            <option value="px">px</option>
            <option value="rem">rem</option>
          </select>
        </div>
      </div>
    {/if}

    {#if meta?.nodeType === "token" && meta.type === "duration"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Duration</label>
        <div class="duration-input-group">
          <input
            id="duration-value-input"
            class="field duration-value"
            type="number"
            value={meta.value.value}
            oninput={(e) => {
              const value = Number.parseFloat(e.currentTarget.value);
              if (!Number.isNaN(value)) {
                updateMeta({ value: { ...meta.value, value } });
              }
            }}
            step="1"
            placeholder="Value"
          />
          <select
            id="duration-unit-input"
            class="field duration-unit-select"
            value={meta.value.unit}
            onchange={(e) => {
              updateMeta({
                value: {
                  ...meta.value,
                  unit: e.currentTarget.value as "ms" | "s",
                },
              });
            }}
          >
            <option value="ms">ms</option>
            <option value="s">s</option>
          </select>
        </div>
      </div>
    {/if}

    {#if meta?.nodeType === "token" && meta.type === "number"}
      <div class="form-group">
        <label for="number-input">Value</label>
        <input
          id="number-input"
          class="field"
          type="number"
          value={meta.value}
          oninput={(e) => {
            const value = Number.parseFloat(e.currentTarget.value);
            if (!Number.isNaN(value)) {
              updateMeta({ value });
            }
          }}
          step="0.1"
        />
      </div>
    {/if}

    {#if meta?.nodeType === "token" && meta.type === "fontFamily"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Font Family</label>
        {@render fontFamilyEditor(meta.value, (value) => {
          updateMeta({ value });
        })}
      </div>
    {/if}

    {#if meta?.nodeType === "token" && meta.type === "fontWeight"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Font Weight</label>
        {@render fontWeightEditor(meta.value, (value) => {
          updateMeta({ value });
        })}
      </div>
    {/if}

    {#if meta?.nodeType === "token" && meta.type === "cubicBezier"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Easing Function</label>
        <CubicBezierEditor
          value={meta.value as CubicBezierValue}
          onChange={(value: CubicBezierValue) => {
            updateMeta({ value });
          }}
        />
      </div>
    {/if}

    {#if meta?.nodeType === "token" && meta.type === "transition"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Duration</label>
        <div class="dimension-input-group">
          <input
            class="field"
            type="number"
            value={(meta.value as TransitionValue).duration.value}
            step="1"
            placeholder="Value"
            oninput={(e) => {
              const val = Number.parseFloat(e.currentTarget.value);
              if (!Number.isNaN(val)) {
                updateMeta({
                  value: {
                    ...(meta.value as TransitionValue),
                    duration: {
                      ...(meta.value as TransitionValue).duration,
                      value: val,
                    },
                  },
                });
              }
            }}
          />
          <select
            class="field duration-unit-select"
            value={(meta.value as TransitionValue).duration.unit}
            onchange={(e) => {
              updateMeta({
                value: {
                  ...(meta.value as TransitionValue),
                  duration: {
                    ...(meta.value as TransitionValue).duration,
                    unit: e.currentTarget.value as "ms" | "s",
                  },
                },
              });
            }}
          >
            <option value="ms">ms</option>
            <option value="s">s</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Delay</label>
        <div class="dimension-input-group">
          <input
            class="field"
            type="number"
            value={(meta.value as TransitionValue).delay.value}
            step="1"
            placeholder="Value"
            oninput={(e) => {
              const val = Number.parseFloat(e.currentTarget.value);
              if (!Number.isNaN(val)) {
                updateMeta({
                  value: {
                    ...(meta.value as TransitionValue),
                    delay: {
                      ...(meta.value as TransitionValue).delay,
                      value: val,
                    },
                  },
                });
              }
            }}
          />
          <select
            class="field duration-unit-select"
            value={(meta.value as TransitionValue).delay.unit}
            onchange={(e) => {
              updateMeta({
                value: {
                  ...(meta.value as TransitionValue),
                  delay: {
                    ...(meta.value as TransitionValue).delay,
                    unit: e.currentTarget.value as "ms" | "s",
                  },
                },
              });
            }}
          >
            <option value="ms">ms</option>
            <option value="s">s</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Timing Function</label>
        <CubicBezierEditor
          value={(meta.value as TransitionValue).timingFunction}
          onChange={(value: CubicBezierValue) => {
            updateMeta({
              value: {
                ...(meta.value as TransitionValue),
                timingFunction: value,
              },
            });
          }}
        />
      </div>
    {/if}

    {#if meta?.nodeType === "token" && meta.type === "typography"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Font Family</label>
        {@render fontFamilyEditor(meta.value.fontFamily, (fontFamily) => {
          updateMeta({
            value: {
              ...meta.value,
              fontFamily,
            },
          });
        })}
      </div>

      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Font Size</label>
        {@render dimensionEditor(meta.value.fontSize, (fontSize) => {
          updateMeta({
            value: {
              ...meta.value,
              fontSize,
            },
          });
        })}
      </div>

      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Font Weight</label>
        {@render fontWeightEditor(meta.value.fontWeight, (fontWeight) => {
          updateMeta({
            value: {
              ...meta.value,
              fontWeight,
            },
          });
        })}
      </div>

      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Line Height</label>
        <input
          class="field"
          type="number"
          value={meta.value.lineHeight}
          oninput={(e) => {
            const value = Number.parseFloat(e.currentTarget.value);
            if (!Number.isNaN(value)) {
              updateMeta({
                value: {
                  ...meta.value,
                  lineHeight: value,
                },
              });
            }
          }}
          step="0.1"
          placeholder="e.g., 1.5"
        />
      </div>

      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Letter Spacing</label>
        {@render dimensionEditor(meta.value.letterSpacing, (letterSpacing) => {
          updateMeta({
            value: {
              ...meta.value,
              letterSpacing,
            },
          });
        })}
      </div>
    {/if}

    {#if meta?.nodeType === "token" && meta.type === "strokeStyle"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Style</label>
        {@render strokeStyleEditor(meta.value, (value) => {
          updateMeta({ value });
        })}
      </div>
    {/if}

    {#if meta?.nodeType === "token" && meta.type === "shadow"}
      {@const shadows = Array.isArray(meta.value) ? meta.value : [meta.value]}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Shadow</label>
        <div class="shadow-list">
          {#each shadows as item, index (index)}
            <div class="shadow-item">
              <div class="shadow-item-header">
                <span class="shadow-item-title">Shadow {index + 1}</span>
                {#if shadows.length > 1}
                  <button
                    class="button"
                    aria-label="Remove shadow"
                    onclick={() => {
                      const updated = shadows.filter((_, i) => i !== index);
                      updateMeta({
                        value: updated.length === 1 ? updated[0] : updated,
                      });
                    }}
                  >
                    <X size={16} />
                  </button>
                {/if}
              </div>

              <div class="shadow-item-body">
                <div class="shadow-fields-grid">
                  <div class="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={item.inset ?? false}
                        onchange={(e) => {
                          const updated = [...shadows];
                          updated[index].inset =
                            e.currentTarget.checked || undefined;
                          updateMeta({
                            value: updated.length === 1 ? updated[0] : updated,
                          });
                        }}
                      />
                      Inset
                    </label>
                  </div>

                  <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>Color</label>
                    <div class="color-picker-wrapper">
                      <color-input
                        value={serializeColor(item.color)}
                        onopen={(event: InputEvent) => {
                          const input = event.target as HTMLInputElement;
                          const updated = [...shadows];
                          updated[index].color = parseColor(input.value);
                          updateMeta({
                            value: updated.length === 1 ? updated[0] : updated,
                          });
                        }}
                        onclose={(event: InputEvent) => {
                          const input = event.target as HTMLInputElement;
                          const updated = [...shadows];
                          updated[index].color = parseColor(input.value);
                          updateMeta({
                            value: updated.length === 1 ? updated[0] : updated,
                          });
                        }}
                      ></color-input>
                      <span class="color-value">
                        {serializeColor(item.color)}
                      </span>
                    </div>
                  </div>

                  <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>Offset X</label>
                    {@render dimensionEditor(item.offsetX, (offsetX) => {
                      const updated = [...shadows];
                      updated[index].offsetX = offsetX;
                      updateMeta({
                        value: updated.length === 1 ? updated[0] : updated,
                      });
                    })}
                  </div>

                  <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>Offset Y</label>
                    {@render dimensionEditor(item.offsetY, (offsetY) => {
                      const updated = [...shadows];
                      updated[index].offsetY = offsetY;
                      updateMeta({
                        value: updated.length === 1 ? updated[0] : updated,
                      });
                    })}
                  </div>

                  <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>Blur</label>
                    {@render dimensionEditor(item.blur, (blur) => {
                      const updated = [...shadows];
                      updated[index].blur = blur;
                      updateMeta({
                        value: updated.length === 1 ? updated[0] : updated,
                      });
                    })}
                  </div>

                  <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>Spread</label>
                    {@render dimensionEditor(
                      item.spread ?? { value: 0, unit: "px" },
                      (spread) => {
                        const updated = [...shadows];
                        updated[index].spread = spread;
                        updateMeta({
                          value: updated.length === 1 ? updated[0] : updated,
                        });
                      },
                    )}
                  </div>
                </div>
              </div>
            </div>
          {/each}

          <button
            class="button"
            onclick={() => {
              const newShadow: ShadowItem = {
                color: {
                  colorSpace: "srgb",
                  components: [0, 0, 0],
                  alpha: 1,
                },
                offsetX: { value: 0, unit: "px" },
                offsetY: { value: 4, unit: "px" },
                blur: { value: 6, unit: "px" },
                spread: { value: 0, unit: "px" },
              };
              updateMeta({ value: [...shadows, newShadow] });
            }}
          >
            <Plus /> Add Shadow
          </button>
        </div>
      </div>
    {/if}

    {#if meta?.nodeType === "token" && meta.type === "border"}
      {@const border = meta.value as BorderValue}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Color</label>
        <div class="color-picker-wrapper">
          <color-input
            value={serializeColor(border.color)}
            onopen={(event: InputEvent) => {
              const input = event.target as HTMLInputElement;
              updateMeta({
                value: {
                  ...border,
                  color: parseColor(input.value),
                },
              });
            }}
            onclose={(event: InputEvent) => {
              const input = event.target as HTMLInputElement;
              updateMeta({
                value: {
                  ...border,
                  color: parseColor(input.value),
                },
              });
            }}
          ></color-input>
          <span class="color-value">
            {serializeColor(border.color)}
          </span>
        </div>
      </div>

      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Width</label>
        {@render dimensionEditor(border.width, (width) => {
          updateMeta({
            value: {
              ...border,
              width,
            },
          });
        })}
      </div>

      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Style</label>
        {@render strokeStyleEditor(border.style, (style) => {
          updateMeta({
            value: {
              ...border,
              style,
            },
          });
        })}
      </div>
    {/if}

    {#if meta?.nodeType === "token" && meta.type === "gradient"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Gradient</label>
        <GradientEditor
          value={meta.value as GradientValue}
          onChange={(value: GradientValue) => {
            updateMeta({ value });
          }}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .form-panel {
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    overflow: auto;
  }

  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 60px;
    padding: 0 16px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .form-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .form-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-group label,
  .form-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Form input, select, textarea atoms are defined in app.css */

  .form-value {
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-radius: 4px;
    font-size: 14px;
    color: var(--text-secondary);
  }

  .color-picker-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-value {
    font-family: var(--typography-monospace-code);
    font-size: 12px;
    color: var(--text-secondary);
    min-width: 50px;
    text-align: center;
  }

  .dimension-input-group {
    display: flex;
    gap: 8px;
  }

  .dimension-value {
    flex: 1;
  }

  .dimension-unit-select {
    field-sizing: content;
    min-width: 60px;
  }

  .duration-input-group {
    display: flex;
    gap: 8px;
  }

  .duration-value {
    flex: 1;
  }

  .duration-unit-select {
    field-sizing: content;
    min-width: 50px;
  }

  .shadow-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .shadow-item {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
  }

  .shadow-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .shadow-item-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .shadow-item-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .shadow-fields-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .dash-array-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .dash-array-item {
    border: 1px solid var(--border-color);
    border-radius: 4px;
  }

  .dash-array-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .dash-array-item-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .dash-array-item-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
</style>
