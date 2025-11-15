<script lang="ts">
  import type { CubicBezierValue } from "./schema";

  interface Props {
    value: CubicBezierValue;
    onChange: (value: CubicBezierValue) => void;
  }

  const { value, onChange }: Props = $props();

  const easingPresets: Record<string, [number, number, number, number]> = {
    ease: [0.25, 0.1, 0.25, 1],
    "ease-in": [0.42, 0, 1, 1],
    "ease-out": [0, 0, 0.58, 1],
    "ease-in-out": [0.42, 0, 0.58, 1],
    linear: [0, 0, 1, 1],
  };

  const getPresetName = (bezierValue: CubicBezierValue): string => {
    for (const [name, preset] of Object.entries(easingPresets)) {
      if (
        preset[0] === bezierValue[0] &&
        preset[1] === bezierValue[1] &&
        preset[2] === bezierValue[2] &&
        preset[3] === bezierValue[3]
      ) {
        return name;
      }
    }
    return "custom";
  };

  let selectedPreset = $state(getPresetName(value));
  let customInput = $state(value.join(", "));

  $effect(() => {
    // Update customInput when value changes externally and is custom
    if (selectedPreset === "custom") {
      customInput = value.join(", ");
    }
  });
</script>

<div class="cubic-bezier-editor">
  <select
    class="form-select"
    value={selectedPreset}
    onchange={(event) => {
      const preset = event.currentTarget.value;
      if (preset === "custom") {
        customInput = value.join(", ");
      } else {
        const bezierValue = easingPresets[preset];
        onChange(bezierValue);
      }
      selectedPreset = preset;
    }}
  >
    <option value="ease">ease</option>
    <option value="ease-in">ease-in</option>
    <option value="ease-out">ease-out</option>
    <option value="ease-in-out">ease-in-out</option>
    <option value="linear">linear</option>
    <option value="custom">custom</option>
  </select>

  {#if selectedPreset === "custom"}
    <input
      class="form-input"
      type="text"
      placeholder="e.g., 0.25, 0.1, 0.25, 1"
      value={customInput}
      oninput={(e) => {
        customInput = e.currentTarget.value;
        const input = customInput.trim();
        const parts = input.split(",").map((p) => Number.parseFloat(p.trim()));
        if (parts.length !== 4) {
          return;
        }
        for (const part of parts) {
          if (Number.isNaN(part) || part < 0) {
            return;
          }
        }
        onChange(parts as CubicBezierValue);
      }}
    />
  {/if}
</div>

<style>
  .cubic-bezier-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  select {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-radius: 4px;
    font-family: inherit;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  select:focus {
    outline: none;
    border-color: var(--accent);
    background: var(--bg-primary);
    box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.1);
  }

  input {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-radius: 4px;
    font-family: inherit;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  input:focus {
    outline: none;
    border-color: var(--accent);
    background: var(--bg-primary);
    box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.1);
  }
</style>
