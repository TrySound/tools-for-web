<script lang="ts">
  import type { Snippet } from "svelte";
  import { titleCase } from "title-case";
  import { noCase } from "change-case";
  import type { HTMLAttributes } from "svelte/elements";
  import type { SvelteSet } from "svelte/reactivity";
  import { Plus, X } from "@lucide/svelte";
  import type { ChangeDetail } from "hdr-color-input";
  import {
    treeState,
    resolveTokenValue,
    findTokenType,
    type TreeNodeMeta,
    resolveRawValue,
  } from "./state.svelte";
  import { parseColor, serializeColor } from "./color";
  import type {
    DimensionValue,
    DurationValue,
    FontFamilyValue,
    RawShadowItem,
    ShadowItem,
    StrokeStyleValue,
    Value,
  } from "./schema";
  import CubicBezierEditor from "./cubic-bezier-editor.svelte";
  import GradientEditor from "./gradient-editor.svelte";
  import AliasToken from "./alias-token.svelte";
  import type { TreeNode } from "./store";

  let {
    id,
    selectedItems,
    ...rest
  }: HTMLAttributes<HTMLDivElement> & {
    id: string;
    selectedItems: SvelteSet<string>;
  } = $props();

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
  const rawValue = $derived.by(() => {
    if (node?.meta.nodeType === "token") {
      return resolveRawValue(node, treeState.nodes());
    }
  });
  const resolvedValue = $derived.by(() => {
    if (node?.meta.nodeType === "token") {
      return resolveTokenValue(node, treeState.nodes());
    }
  });

  const getDescendantTypes = (
    node: TreeNode<TreeNodeMeta>,
    types = new Set<Value["type"]>(),
  ) => {
    for (const child of treeState.getChildren(node.nodeId)) {
      if (
        child.meta.nodeType === "token-group" ||
        child.meta.nodeType === "token"
      ) {
        if (child.meta.type) {
          types.add(child.meta.type);
        }
        getDescendantTypes(child, types);
      }
    }
    return types;
  };

  const getAvailableGroupTypes = (
    node: TreeNode<TreeNodeMeta>,
  ): ("mixed" | Value["type"])[] => {
    const inheritedType = findTokenType(node, treeState.nodes());
    // cannot change inherited type
    if (
      inheritedType &&
      node.meta.nodeType === "token-group" &&
      node.meta.type === undefined
    ) {
      return [inheritedType];
    }
    const descendantTypes = getDescendantTypes(node);
    // group without tokens can have any type
    if (descendantTypes.size === 0) {
      return [
        "mixed",
        "color",
        "dimension",
        "duration",
        "number",
        "fontFamily",
        "fontWeight",
        "cubicBezier",
        "transition",
        "strokeStyle",
        "shadow",
        "border",
        "typography",
        "gradient",
      ];
    }
    if (descendantTypes.size === 1) {
      return ["mixed", Array.from(descendantTypes)[0]];
    }
    return ["mixed"];
  };

  const getModifierContexts = (modifierId: string) => {
    const contexts: Array<{ nodeId: string; name: string }> = [];
    const children = treeState.getChildren(modifierId);
    for (const child of children) {
      if (child.meta.nodeType === "token-context") {
        contexts.push({ nodeId: child.nodeId, name: child.meta.name });
      }
    }
    return contexts;
  };

  const updateMeta = (newMeta: Partial<TreeNodeMeta>) => {
    if (node?.meta) {
      treeState.transact((tx) => {
        const updatedNode = {
          ...node,
          meta: { ...node.meta, ...(newMeta as typeof node.meta) },
        };
        tx.set(updatedNode);
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
      class="a-field dimension-value"
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
      class="a-field dimension-unit-select"
      value={dimension.unit}
      onchange={(e) => {
        onChange({
          ...dimension,
          unit: e.currentTarget.value as "px" | "rem",
        });
      }}
    >
      <option class="a-item" value="px">px</option>
      <option class="a-item" value="rem">rem</option>
    </select>
  </div>
{/snippet}

{#snippet durationEditor(
  duration: DurationValue,
  onChange: (value: DurationValue) => void,
)}
  <div class="duration-input-group">
    <input
      id="duration-value-input"
      class="a-field duration-value"
      type="number"
      step="1"
      placeholder="Value"
      value={duration.value}
      oninput={(e) => {
        const value = Number.parseFloat(e.currentTarget.value);
        if (!Number.isNaN(value)) {
          onChange({ ...duration, value });
        }
      }}
    />
    <select
      id="duration-unit-input"
      class="a-field duration-unit-select"
      value={duration.unit}
      onchange={(e) => {
        onChange({
          ...duration,
          unit: e.currentTarget.value as "ms" | "s",
        });
      }}
    >
      <option class="a-item" value="ms">ms</option>
      <option class="a-item" value="s">s</option>
    </select>
  </div>
{/snippet}

{#snippet fontFamilyEditor(
  fontFamily: FontFamilyValue,
  onChange: (value: FontFamilyValue) => void,
)}
  <textarea
    class="a-field"
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
    class="a-field"
    value={String(normalizeFontWeight(fontWeight))}
    onchange={(e) => {
      const value = Number.parseInt(e.currentTarget.value, 10);
      onChange(value);
    }}
  >
    <option class="a-item" value="100">100 — thin, hairline</option>
    <option class="a-item" value="200">200 — extra-light, ultra-light</option>
    <option class="a-item" value="300">300 — light</option>
    <option class="a-item" value="400">400 — normal, regular, book</option>
    <option class="a-item" value="500">500 — medium</option>
    <option class="a-item" value="600">600 — semi-bold, demi-bold</option>
    <option class="a-item" value="700">700 — bold</option>
    <option class="a-item" value="800">800 — extra-bold, ultra-bold</option>
    <option class="a-item" value="900">900 — black, heavy</option>
    <option class="a-item" value="950">950 — extra-black, ultra-black</option>
  </select>
{/snippet}

{#snippet strokeStyleEditor(
  strokeStyle: StrokeStyleValue,
  onChange: (value: StrokeStyleValue) => void,
  aliasButton?: Snippet,
)}
  <div class="input-with-button">
    <select
      class="a-field"
      value={typeof strokeStyle === "string" ? strokeStyle : "custom"}
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
      <option class="a-item" value="solid">Solid</option>
      <option class="a-item" value="dashed">Dashed</option>
      <option class="a-item" value="dotted">Dotted</option>
      <option class="a-item" value="double">Double</option>
      <option class="a-item" value="groove">Groove</option>
      <option class="a-item" value="ridge">Ridge</option>
      <option class="a-item" value="outset">Outset</option>
      <option class="a-item" value="inset">Inset</option>
      <option class="a-item" value="custom">Custom</option>
    </select>
    {@render aliasButton?.()}
  </div>

  {#if typeof strokeStyle !== "string"}
    <div class="form-group">
      <label class="a-label" for="stroke-style-line-cap">Line Cap</label>
      <select
        id="stroke-style-line-cap"
        class="a-field"
        value={strokeStyle.lineCap}
        onchange={(e) => {
          onChange({
            ...strokeStyle,
            lineCap: e.currentTarget.value as "round" | "butt" | "square",
          });
        }}
      >
        <option class="a-item" value="round">Round</option>
        <option class="a-item" value="butt">Butt</option>
        <option class="a-item" value="square">Square</option>
      </select>
    </div>

    <div class="form-group">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label class="a-label">Dash Array</label>
      <div class="dash-array-list">
        {#each strokeStyle.dashArray as dash, index (index)}
          <div class="dash-array-item-row">
            {@render dimensionEditor(dash, (newDash) => {
              const updated = [...strokeStyle.dashArray];
              updated[index] = newDash;
              onChange({
                ...strokeStyle,
                dashArray: updated,
              });
            })}
            {#if strokeStyle.dashArray.length > 1}
              <button
                class="a-button"
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
                <X size={16} />
              </button>
            {/if}
          </div>
        {/each}

        <button
          class="a-button"
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

<div {id} popover="auto" class="a-popover editor-popover" {...rest}>
  <div class="form-header">
    <h2 class="a-panel-title">
      {#if node?.meta.nodeType === "token-set"}
        Set
      {/if}
      {#if node?.meta.nodeType === "token-modifier"}
        Modifier
      {/if}
      {#if node?.meta.nodeType === "token-context"}
        Modifier Context
      {/if}
      {#if node?.meta.nodeType === "token-group"}
        Group
      {/if}
      {#if node?.meta.nodeType === "token"}
        Token
      {/if}
    </h2>
    <button
      class="a-button"
      aria-label="Close"
      commandfor={id}
      command="hide-popover"
    >
      <X size={16} />
    </button>
  </div>

  <!-- reset editor local state whenever selection is changed -->
  {#key node?.nodeId}
    <div class="form-content">
      <div class="form-group">
        <label class="a-label" for="name-input">Name</label>
        <div class="input-with-button">
          <input
            id="name-input"
            class="a-field"
            type="text"
            autocomplete="off"
            value={node?.meta.name}
            oninput={(e) => handleNameChange(e.currentTarget.value)}
          />
          {#if node?.meta.nodeType === "token" && rawValue}
            <!-- nodeId is necessary here to do circular check -->
            <AliasToken
              nodeId={node.nodeId}
              type={node.meta.type}
              value={node.meta.value}
              onChange={(newNodeRef) => {
                /* set resolved value when reference is removed */
                if (newNodeRef) {
                  updateMeta({ value: newNodeRef });
                } else {
                  // preserve aliases in composite tokens components
                  // when reset token alias
                  updateMeta(rawValue);
                }
              }}
            />
          {/if}
        </div>
      </div>

      <div class="form-group">
        <label class="a-label" for="description-input">Description</label>
        <textarea
          id="description-input"
          class="a-field"
          value={node?.meta.description ?? ""}
          oninput={(e) => handleDescriptionChange(e.currentTarget.value)}
        ></textarea>
      </div>

      {#if node?.meta?.nodeType === "token-group"}
        {@const availableTypes = getAvailableGroupTypes(node)}
        <div class="form-group">
          <label class="a-label" for="type-select">Type</label>
          <select
            id="type-select"
            class="a-field"
            value={node.meta.type ?? availableTypes[0]}
            onchange={(e) => {
              const value = e.currentTarget.value;
              updateMeta({
                type: value === "mixed" ? undefined : (value as Value["type"]),
              });
            }}
          >
            {#each availableTypes as type}
              <option class="a-item" value={type}>
                {titleCase(noCase(type))}
              </option>
            {/each}
          </select>
        </div>
      {/if}

      {#if node?.meta.nodeType === "token"}
        <div class="form-group">
          <div class="a-label">Type</div>
          <div class="a-field">{node.meta.type}</div>
        </div>
      {/if}

      {#if node?.meta.nodeType === "token-group" || node?.meta.nodeType === "token"}
        <div class="form-group">
          <div class="form-checkbox-group">
            <input
              id="deprecated-input"
              class="a-checkbox"
              type="checkbox"
              checked={node?.meta.deprecated !== undefined}
              onchange={(e) => handleDeprecatedChange(e.currentTarget.checked)}
            />
            <label class="a-label" for="deprecated-input"> Deprecated </label>
          </div>
          {#if node?.meta.deprecated !== undefined}
            {@const meta = node.meta}
            <textarea
              class="a-field"
              placeholder="Reason for deprecation"
              bind:value={
                () =>
                  typeof meta.deprecated === "string" ? meta.deprecated : "",
                (reason) => handleDeprecatedChange(reason)
              }
            ></textarea>
          {/if}
        </div>
      {/if}

      {#if rawValue?.type === "color"}
        <!-- Store in separate derived to cache and avoid infinite cycle -->
        {@const colorValue = serializeColor(rawValue.value)}
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Color</label>
          <color-input
            value={colorValue}
            onchange={(event: CustomEvent<ChangeDetail>) => {
              updateMeta({ value: parseColor(event.detail.value) });
            }}
          ></color-input>
        </div>
      {/if}

      {#if rawValue?.type === "dimension"}
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Dimension</label>
          {@render dimensionEditor(rawValue.value, (value) => {
            updateMeta({ value });
          })}
        </div>
      {/if}

      {#if rawValue?.type === "duration"}
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Duration</label>
          {@render durationEditor(rawValue.value, (value) => {
            updateMeta({ value });
          })}
        </div>
      {/if}

      {#if rawValue?.type === "number"}
        <div class="form-group">
          <label class="a-label" for="editor-number-input">Value</label>
          <input
            id="editor-number-input"
            class="a-field"
            type="number"
            value={rawValue.value}
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

      {#if rawValue?.type === "fontFamily"}
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Font Family</label>
          {@render fontFamilyEditor(rawValue.value, (value) => {
            updateMeta({ value });
          })}
        </div>
      {/if}

      {#if rawValue?.type === "fontWeight"}
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Font Weight</label>
          {@render fontWeightEditor(rawValue.value, (value) => {
            updateMeta({ value });
          })}
        </div>
      {/if}

      {#if rawValue?.type === "cubicBezier"}
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Easing Function</label>
          <CubicBezierEditor
            value={rawValue.value}
            onChange={(value) => {
              updateMeta({ value });
            }}
          />
        </div>
      {/if}

      {#if rawValue?.type === "strokeStyle"}
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Style</label>
          {@render strokeStyleEditor(rawValue.value, (value) => {
            updateMeta({ value });
          })}
        </div>
      {/if}

      {#if rawValue?.type === "transition" && resolvedValue?.type === "transition"}
        <div class="transition-durations">
          <div class="form-group">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="a-label">Duration</label>
            <div class="input-with-button">
              {@render durationEditor(
                resolvedValue.value.duration,
                (duration) =>
                  updateMeta({
                    value: { ...rawValue.value, duration },
                  }),
              )}
              <AliasToken
                type="duration"
                value={rawValue.value.duration}
                onChange={(duration) => {
                  updateMeta({
                    value: {
                      ...rawValue.value,
                      duration: duration ?? resolvedValue.value.duration,
                    },
                  });
                }}
              />
            </div>
          </div>

          <div class="form-group">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="a-label">Delay</label>
            <div class="input-with-button">
              {@render durationEditor(resolvedValue.value.delay, (delay) =>
                updateMeta({
                  value: { ...rawValue.value, delay },
                }),
              )}
              <AliasToken
                type="duration"
                value={rawValue.value.delay}
                onChange={(delay) => {
                  updateMeta({
                    value: {
                      ...rawValue.value,
                      delay: delay ?? resolvedValue.value.delay,
                    },
                  });
                }}
              />
            </div>
          </div>
        </div>

        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Timing Function</label>
          <div class="input-with-button">
            <CubicBezierEditor
              value={resolvedValue.value.timingFunction}
              onChange={(value) => {
                updateMeta({
                  value: { ...rawValue.value, timingFunction: value },
                });
              }}
            />
            <AliasToken
              type="cubicBezier"
              value={rawValue.value.timingFunction}
              onChange={(timingFunction) => {
                updateMeta({
                  value: {
                    ...rawValue.value,
                    timingFunction:
                      timingFunction ?? resolvedValue.value.timingFunction,
                  },
                });
              }}
            />
          </div>
        </div>
      {/if}

      {#if rawValue?.type === "typography" && resolvedValue?.type === "typography"}
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Font Family</label>
          <div class="input-with-button">
            {@render fontFamilyEditor(
              resolvedValue.value.fontFamily,
              (fontFamily) => {
                updateMeta({
                  value: { ...rawValue.value, fontFamily },
                });
              },
            )}
            <AliasToken
              type="fontFamily"
              value={rawValue.value.fontFamily}
              onChange={(fontFamily) => {
                updateMeta({
                  value: {
                    ...rawValue.value,
                    fontFamily: fontFamily ?? resolvedValue.value.fontFamily,
                  },
                });
              }}
            />
          </div>
        </div>

        <div class="typography-aux">
          <div class="form-group">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="a-label">Font Size</label>
            <div class="input-with-button">
              {@render dimensionEditor(
                resolvedValue.value.fontSize,
                (fontSize) => {
                  updateMeta({
                    value: { ...rawValue.value, fontSize },
                  });
                },
              )}
              <AliasToken
                type="dimension"
                value={rawValue.value.fontSize}
                onChange={(fontSize) => {
                  updateMeta({
                    value: {
                      ...rawValue.value,
                      fontSize: fontSize ?? resolvedValue.value.fontSize,
                    },
                  });
                }}
              />
            </div>
          </div>

          <div class="form-group">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="a-label">Font Weight</label>
            <div class="input-with-button">
              {@render fontWeightEditor(
                resolvedValue.value.fontWeight,
                (fontWeight) => {
                  updateMeta({
                    value: { ...rawValue.value, fontWeight },
                  });
                },
              )}
              <AliasToken
                type="fontWeight"
                value={rawValue.value.fontWeight}
                onChange={(fontWeight) => {
                  updateMeta({
                    value: {
                      ...rawValue.value,
                      fontWeight: fontWeight ?? resolvedValue.value.fontWeight,
                    },
                  });
                }}
              />
            </div>
          </div>

          <div class="form-group">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="a-label">Line Height</label>
            <div class="input-with-button">
              <input
                class="a-field"
                type="number"
                value={resolvedValue.value.lineHeight}
                oninput={(e) => {
                  const value = Number.parseFloat(e.currentTarget.value);
                  if (!Number.isNaN(value)) {
                    updateMeta({
                      value: { ...rawValue.value, lineHeight: value },
                    });
                  }
                }}
                step="0.1"
                placeholder="e.g., 1.5"
              />
              <AliasToken
                type="number"
                value={rawValue.value.lineHeight}
                onChange={(lineHeight) => {
                  updateMeta({
                    value: {
                      ...rawValue.value,
                      lineHeight: lineHeight ?? resolvedValue.value.lineHeight,
                    },
                  });
                }}
              />
            </div>
          </div>

          <div class="form-group">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="a-label">Letter Spacing</label>
            <div class="input-with-button">
              {@render dimensionEditor(
                resolvedValue.value.letterSpacing,
                (letterSpacing) => {
                  updateMeta({
                    value: { ...rawValue.value, letterSpacing },
                  });
                },
              )}
              <AliasToken
                type="dimension"
                value={rawValue.value.letterSpacing}
                onChange={(letterSpacing) => {
                  updateMeta({
                    value: {
                      ...rawValue.value,
                      letterSpacing:
                        letterSpacing ?? resolvedValue.value.letterSpacing,
                    },
                  });
                }}
              />
            </div>
          </div>
        </div>
      {/if}

      {#if rawValue?.type === "shadow" && resolvedValue?.type === "shadow"}
        {@const shadows = rawValue.value}
        {@const resolvedShadows = resolvedValue.value}
        {@const updateItem = (index: number, item: Partial<RawShadowItem>) => {
          const newShadows = [...shadows];
          newShadows[index] = { ...newShadows[index], ...item };
          updateMeta({ value: newShadows });
        }}
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Shadow</label>
          <div class="shadow-list">
            {#each shadows as item, index (index)}
              {@const resolvedItem = resolvedShadows[index]}
              <div class="shadow-item">
                <div class="form-checkbox-group">
                  <input
                    id="shadow-inset-{index}"
                    class="a-checkbox"
                    type="checkbox"
                    checked={item.inset ?? false}
                    onchange={(event) => {
                      updateItem(index, {
                        inset: event.currentTarget.checked || undefined,
                      });
                    }}
                  />
                  <label for="shadow-inset-{index}" class="a-label">
                    Inset
                  </label>
                </div>

                {#if shadows.length > 1}
                  <button
                    class="a-button remove-shadow-button"
                    aria-label="Remove shadow"
                    onclick={() => {
                      const newShadows = shadows.filter((_, i) => i !== index);
                      updateMeta({ value: newShadows });
                    }}
                  >
                    <X size={16} />
                  </button>
                {/if}

                <div class="input-with-button shadow-color">
                  <color-input
                    value={serializeColor(resolvedItem.color)}
                    onopen={(event: InputEvent) => {
                      const input = event.target as HTMLInputElement;
                      updateItem(index, { color: parseColor(input.value) });
                    }}
                    onclose={(event: InputEvent) => {
                      const input = event.target as HTMLInputElement;
                      updateItem(index, { color: parseColor(input.value) });
                    }}
                  ></color-input>
                  <AliasToken
                    type="color"
                    value={item.color}
                    onChange={(color) => {
                      updateItem(index, { color: color ?? resolvedItem.color });
                    }}
                  />
                </div>

                <div class="input-with-button">
                  {@render dimensionEditor(resolvedItem.offsetX, (offsetX) => {
                    updateItem(index, { offsetX });
                  })}
                  <AliasToken
                    type="dimension"
                    value={item.offsetX}
                    onChange={(offsetX) => {
                      updateItem(index, {
                        offsetX: offsetX ?? resolvedItem.offsetX,
                      });
                    }}
                  />
                </div>

                <div class="input-with-button">
                  {@render dimensionEditor(resolvedItem.offsetY, (offsetY) => {
                    updateItem(index, { offsetY });
                  })}
                  <AliasToken
                    type="dimension"
                    value={item.offsetY}
                    onChange={(offsetY) => {
                      updateItem(index, {
                        offsetY: offsetY ?? resolvedItem.offsetY,
                      });
                    }}
                  />
                </div>

                <div class="input-with-button">
                  {@render dimensionEditor(resolvedItem.blur, (blur) => {
                    updateItem(index, { blur });
                  })}
                  <AliasToken
                    type="dimension"
                    value={item.blur}
                    onChange={(blur) => {
                      updateItem(index, { blur: blur ?? resolvedItem.blur });
                    }}
                  />
                </div>

                <div class="input-with-button">
                  {@render dimensionEditor(resolvedItem.spread, (spread) => {
                    updateItem(index, { spread });
                  })}
                  <AliasToken
                    type="dimension"
                    value={item.spread}
                    onChange={(spread) => {
                      updateItem(index, {
                        spread: spread ?? resolvedItem.spread,
                      });
                    }}
                  />
                </div>
              </div>
            {/each}

            <button
              class="a-button"
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

      {#if rawValue?.type === "border" && resolvedValue?.type === "border"}
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Color</label>
          <div class="input-with-button">
            <color-input
              value={serializeColor(resolvedValue.value.color)}
              onopen={(event: InputEvent) => {
                const input = event.target as HTMLInputElement;
                updateMeta({
                  value: { ...rawValue.value, color: parseColor(input.value) },
                });
              }}
              onclose={(event: InputEvent) => {
                const input = event.target as HTMLInputElement;
                updateMeta({
                  value: { ...rawValue.value, color: parseColor(input.value) },
                });
              }}
            ></color-input>
            <AliasToken
              type="color"
              value={rawValue.value.color}
              onChange={(color) => {
                updateMeta({
                  value: {
                    ...rawValue.value,
                    color: color ?? resolvedValue.value.color,
                  },
                });
              }}
            />
          </div>
        </div>

        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Width</label>
          <div class="input-with-button">
            {@render dimensionEditor(resolvedValue.value.width, (width) => {
              updateMeta({
                value: { ...rawValue.value, width },
              });
            })}
            <AliasToken
              type="dimension"
              value={rawValue.value.width}
              onChange={(width) => {
                updateMeta({
                  value: {
                    ...rawValue.value,
                    width: width ?? resolvedValue.value.width,
                  },
                });
              }}
            />
          </div>
        </div>

        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Style</label>
          {#snippet borderStyleAliasButton()}
            <AliasToken
              type="strokeStyle"
              value={rawValue.value.style}
              onChange={(style) => {
                updateMeta({
                  value: {
                    ...rawValue.value,
                    style: style ?? resolvedValue.value.style,
                  },
                });
              }}
            />
          {/snippet}
          {@render strokeStyleEditor(
            resolvedValue.value.style,
            (style) => {
              updateMeta({
                value: { ...rawValue.value, style },
              });
            },
            borderStyleAliasButton,
          )}
        </div>
      {/if}

      {#if rawValue?.type === "gradient" && resolvedValue?.type === "gradient"}
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Gradient</label>
          <GradientEditor
            value={resolvedValue.value}
            rawValue={rawValue.value}
            onChange={(value) => {
              updateMeta({ value });
            }}
          />
        </div>
      {/if}

      {#if node?.meta.nodeType === "token-modifier"}
        {@const contexts = getModifierContexts(node.nodeId)}
        <div class="form-group">
          <label class="a-label" for="default-context-select"
            >Default Context</label
          >
          <select
            id="default-context-select"
            class="a-field"
            value={node.meta.default?.ref ?? ""}
            onchange={(e) => {
              const value = e.currentTarget.value;
              updateMeta({
                default: value ? { ref: value } : undefined,
              });
            }}
          >
            <option class="a-item" value="">None</option>
            {#each contexts as context}
              <option class="a-item" value={context.nodeId}>
                {context.name}
              </option>
            {/each}
          </select>
        </div>
      {/if}
    </div>
  {/key}
</div>

<style>
  .editor-popover:popover-open {
    inset: 0;
    margin: auto;
    max-height: calc(100cqh - var(--panel-header-height) - 16px - 16px);
    width: 360px;
    display: grid;
    /* collapse heading and content in safari */
    grid-template-rows: max-content max-content;
    overflow: auto;

    @container (width <= 720px) {
      inset: 8px;
      width: auto;
      max-width: 700px;
      max-height: none;
    }

    @supports (position-anchor: --app) {
      position-anchor: --tokens-panel;
      top: calc(anchor(top) + 16px);
      left: anchor(right);
      bottom: auto;
      right: auto;

      @container (width <= 720px) {
        max-width: none;
        position-anchor: --app;
        top: calc(anchor(top) + 8px);
        left: calc(anchor(left) + 8px);
        width: calc(anchor-size(width) - 16px);
        height: calc(anchor-size(height) - 16px);
      }
    }
  }

  .input-with-button {
    display: grid;
    gap: 4px;
    align-items: start;
    &:has(:global(button)) {
      grid-template-columns: 1fr max-content;
    }
  }

  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: var(--panel-header-height);
    padding: 0 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .form-content {
    display: grid;
    gap: 8px;
    padding: 12px;
    overflow-y: auto;
  }

  .form-group {
    display: grid;
    gap: 4px;
  }

  .form-checkbox-group {
    display: grid;
    gap: 4px;
    align-items: center;
    grid-template-columns: max-content 1fr;
  }

  .dimension-input-group {
    /* fit input into minimal available space */
    min-width: 0;
    display: flex;
    gap: 4px;
  }

  .dimension-value {
    flex: 1;
  }

  .dimension-unit-select {
    field-sizing: content;
  }

  .duration-input-group {
    /* fit input into minimal available space */
    min-width: 0;
    display: flex;
    gap: 4px;
  }

  .duration-value {
    flex: 1;
  }

  .duration-unit-select {
    field-sizing: content;
  }

  .transition-durations {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .shadow-list {
    display: grid;
    gap: 12px;
  }

  .shadow-item {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-items: center;
  }

  .shadow-color {
    grid-column: 1 / 3;
  }

  .remove-shadow-button {
    justify-self: end;
  }

  .dash-array-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .dash-array-item-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px;
    align-items: center;
  }

  .typography-aux {
    min-width: 0;
    display: grid;
    gap: 8px;
    grid-template-columns: 1fr 1fr;
  }
</style>
