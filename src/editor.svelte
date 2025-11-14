<script lang="ts">
  import type { SvelteSet } from "svelte/reactivity";
  import { X } from "@lucide/svelte";
  import { treeState, type TreeNodeMeta } from "./state.svelte";
  import { parseColor, serializeColor } from "./color";

  let {
    selectedItems,
    editingMode = $bindable(),
  }: { selectedItems: SvelteSet<string>; editingMode: boolean } = $props();

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

<div class="form-panel">
  <div class="form-header">
    <h2 class="form-title">
      {meta?.nodeType === "token-group" ? "Group" : "Token"}
    </h2>
    <button
      class="close-btn"
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
        class="form-input"
        type="text"
        value={meta?.name}
        oninput={(e) => handleNameChange(e.currentTarget.value)}
      />
    </div>

    <div class="form-group">
      <label for="description-input">Description</label>
      <textarea
        id="description-input"
        class="form-textarea"
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
          class="form-input"
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
            class="form-input"
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
            class="form-select dimension-unit-select"
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
            class="form-input"
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
            class="form-select duration-unit-select"
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
          class="form-input"
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
  </div>
</div>

<style>
  .form-panel {
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
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

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    border-radius: 4px;
    color: var(--text-secondary);
    transition: all 0.2s ease;
    padding: 0;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
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

  .form-input,
  .form-textarea,
  .form-select {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-radius: 4px;
    font-family: inherit;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .form-input:focus,
  .form-textarea:focus,
  .form-select:focus {
    outline: none;
    border-color: var(--accent);
    background: var(--bg-primary);
    box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.1);
  }

  .form-textarea {
    field-sizing: content;
    resize: none;
    max-height: 10lh;
  }

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

  .dimension-input-group .form-input {
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

  .duration-input-group .form-input {
    flex: 1;
  }

  .duration-unit-select {
    field-sizing: content;
    min-width: 50px;
  }
</style>
