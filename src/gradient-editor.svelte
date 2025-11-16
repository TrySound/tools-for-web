<script lang="ts">
  import { Plus, X } from "@lucide/svelte";
  import { parseColor, serializeColor } from "./color";
  import type { GradientValue } from "./schema";

  interface Props {
    value: GradientValue;
    onChange: (value: GradientValue) => void;
  }

  const { value, onChange }: Props = $props();

  const handleAddStop = () => {
    // Add a new stop at the end with a slightly different color
    const newStop = {
      color: {
        colorSpace: "srgb" as const,
        components: [1, 1, 1],
        alpha: 1,
      },
      position: Math.min(1, value[value.length - 1]?.position ?? 0) + 0.5,
    };
    const updatedValue = [...value, newStop].sort(
      (a, b) => a.position - b.position,
    );
    onChange(updatedValue);
  };

  const handleRemoveStop = (index: number) => {
    if (value.length <= 2) return; // Prevent removing if only 2 stops
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleStopColorChange = (index: number, colorString: string) => {
    const updated = [...value];
    updated[index].color = parseColor(colorString);
    onChange(updated);
  };

  const handleStopPositionChange = (index: number, position: number) => {
    if (position < 0 || position > 1) return;
    const updated = [...value];
    updated[index].position = position;
    // Re-sort by position
    updated.sort((a, b) => a.position - b.position);
    onChange(updated);
  };

  const generateGradientPreview = (): string => {
    const stops = value
      .map(
        (stop) =>
          `${serializeColor(stop.color)} ${(stop.position * 100).toFixed(1)}%`,
      )
      .join(", ");
    return `linear-gradient(90deg, ${stops})`;
  };
</script>

<div class="gradient-editor">
  <div
    class="gradient-preview"
    style="background: {generateGradientPreview()}"
  ></div>

  <div class="gradient-stops-list">
    {#each value as stop, index (index)}
      <div class="gradient-stop-item">
        <div class="gradient-stop-header">
          <span class="gradient-stop-title">Stop {index + 1}</span>
          {#if value.length > 2}
            <button
              class="button"
              aria-label="Remove stop"
              onclick={() => handleRemoveStop(index)}
            >
              <X size={20} />
            </button>
          {/if}
        </div>

        <div class="gradient-stop-body">
          <div class="gradient-stop-fields">
            <div class="gradient-stop-row">
              <div class="form-group">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label>Color</label>
                <div class="color-picker-wrapper">
                  <color-input
                    value={serializeColor(stop.color)}
                    onopen={(event: InputEvent) => {
                      const input = event.target as HTMLInputElement;
                      handleStopColorChange(index, input.value);
                    }}
                    onclose={(event: InputEvent) => {
                      const input = event.target as HTMLInputElement;
                      handleStopColorChange(index, input.value);
                    }}
                  ></color-input>
                  <span class="color-value">
                    {serializeColor(stop.color)}
                  </span>
                </div>
              </div>

              <div class="form-group">
                <label for="position-{index}">Position</label>
                <div class="position-input-group">
                  <input
                    id="position-{index}"
                    class="position-input"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={stop.position}
                    oninput={(e) => {
                      const val = Number.parseFloat(e.currentTarget.value);
                      if (!Number.isNaN(val)) {
                        handleStopPositionChange(index, val);
                      }
                    }}
                  />
                  <input
                    class="field position-number"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={(stop.position * 100).toFixed(1)}
                    oninput={(e) => {
                      const val = Number.parseFloat(e.currentTarget.value);
                      if (!Number.isNaN(val)) {
                        handleStopPositionChange(index, val / 100);
                      }
                    }}
                  />
                  <span class="position-percent">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/each}

    <button class="button" onclick={handleAddStop}>
      <Plus size={20} /> Add Stop
    </button>
  </div>
</div>

<style>
  .gradient-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .gradient-preview {
    width: 100%;
    height: 60px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .gradient-stops-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .gradient-stop-item {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
  }

  .gradient-stop-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .gradient-stop-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .gradient-stop-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .gradient-stop-fields {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .gradient-stop-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-group label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
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

  .position-input-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .position-input {
    flex: 1;
    appearance: slider-horizontal;
    height: 6px;
    -webkit-appearance: slider-horizontal;
    padding: 0;
  }

  .position-number {
    width: 60px;
  }

  .position-percent {
    font-size: 14px;
    color: var(--text-secondary);
    min-width: 20px;
  }
</style>
