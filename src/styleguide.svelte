<script lang="ts">
  import type { TokenMeta } from "./state.svelte";
  import { treeState, resolveTokenValue } from "./state.svelte";
  import { serializeColor } from "./color";
  import type { StrokeStyleValue } from "./schema";
  import {
    toCubicBezierValue,
    toDimensionValue,
    toDurationValue,
    toFontFamily,
    toGradient,
    toShadow,
  } from "./css-variables";
  import { noCase } from "change-case";
  import { titleCase } from "title-case";

  const { selectedItems }: { selectedItems: Set<string> } = $props();

  const visibleNodes = $derived.by(() => {
    const visibleNodes = new Set<string>();
    const addDescendants = (nodeId: string) => {
      const children = treeState.getChildren(nodeId);
      for (const child of children) {
        visibleNodes.add(child.nodeId);
        addDescendants(child.nodeId);
      }
    };
    for (const nodeId of selectedItems) {
      let currentNodeId: undefined | string = nodeId;
      while (currentNodeId) {
        visibleNodes.add(currentNodeId);
        const node = treeState.getNode(currentNodeId);
        currentNodeId = node?.parentId;
      }
      addDescendants(nodeId);
    }
    return visibleNodes;
  });
</script>

{#snippet cubicBezierPreview(bezier: [number, number, number, number])}
  {@const size = 120}
  {@const padding = 15}
  {@const scale = size - padding * 2}
  {@const x1 = padding + bezier[0] * scale}
  {@const y1 = padding + (1 - bezier[1]) * scale}
  {@const x2 = padding + bezier[2] * scale}
  {@const y2 = padding + (1 - bezier[3]) * scale}
  {@const path = `M ${padding} ${padding + scale} C ${x1} ${y1} ${x2} ${y2} ${padding + scale} ${padding}`}
  <svg
    viewBox="0 0 {size} {size}"
    class="cubic-bezier-svg"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- Grid lines -->
    <line
      x1={padding}
      y1={padding}
      x2={padding}
      y2={padding + scale}
      stroke="#e0e0e0"
      stroke-width="0.5"
    />
    <line
      x1={padding}
      y1={padding + scale}
      x2={padding + scale}
      y2={padding + scale}
      stroke="#e0e0e0"
      stroke-width="0.5"
    />
    <!-- Curve -->
    <path
      d={path}
      fill="none"
      stroke="#4f46e5"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <!-- Control points connection lines -->
    <line
      x1={padding}
      y1={padding + scale}
      x2={x1}
      y2={y1}
      stroke="#ccc"
      stroke-width="0.5"
      stroke-dasharray="2"
    />
    <line
      x1={x2}
      y1={y2}
      x2={padding + scale}
      y2={padding}
      stroke="#ccc"
      stroke-width="0.5"
      stroke-dasharray="2"
    />
    <!-- Control points -->
    <circle cx={x1} cy={y1} r="2" fill="#4f46e5" opacity="0.6" />
    <circle cx={x2} cy={y2} r="2" fill="#4f46e5" opacity="0.6" />
    <!-- Start and end points -->
    <circle cx={padding} cy={padding + scale} r="2.5" fill="#333" />
    <circle cx={padding + scale} cy={padding} r="2.5" fill="#333" />
  </svg>
{/snippet}

{#snippet strokeStylePreview(value: StrokeStyleValue)}
  <div class="stroke-style-preview">
    <svg
      viewBox="0 0 200 80"
      class="stroke-style-svg"
      xmlns="http://www.w3.org/2000/svg"
    >
      {#if value === "solid"}
        <line x1="10" y1="40" x2="190" y2="40" stroke="#333" stroke-width="2" />
      {:else if value === "dashed"}
        <line
          x1="10"
          y1="40"
          x2="190"
          y2="40"
          stroke="#333"
          stroke-width="2"
          stroke-dasharray="8,4"
        />
      {:else if value === "dotted"}
        <line
          x1="10"
          y1="40"
          x2="190"
          y2="40"
          stroke="#333"
          stroke-width="2"
          stroke-dasharray="2,4"
          stroke-linecap="round"
        />
      {:else if value === "double"}
        <line x1="10" y1="37" x2="190" y2="37" stroke="#333" stroke-width="2" />
        <line x1="10" y1="43" x2="190" y2="43" stroke="#333" stroke-width="2" />
      {:else if value === "groove"}
        <line x1="10" y1="40" x2="190" y2="40" stroke="#999" stroke-width="2" />
        <line x1="10" y1="41" x2="190" y2="41" stroke="#eee" stroke-width="1" />
      {:else if value === "ridge"}
        <line x1="10" y1="40" x2="190" y2="40" stroke="#eee" stroke-width="2" />
        <line x1="10" y1="41" x2="190" y2="41" stroke="#999" stroke-width="1" />
      {:else if value === "outset"}
        <line x1="10" y1="39" x2="190" y2="39" stroke="#bbb" stroke-width="1" />
        <line x1="10" y1="41" x2="190" y2="41" stroke="#666" stroke-width="2" />
      {:else if value === "inset"}
        <line x1="10" y1="39" x2="190" y2="39" stroke="#666" stroke-width="2" />
        <line x1="10" y1="41" x2="190" y2="41" stroke="#bbb" stroke-width="1" />
      {:else}
        <line
          x1="10"
          y1="40"
          x2="190"
          y2="40"
          stroke="#333"
          stroke-width="2"
          stroke-dasharray={value.dashArray.map((dim) => dim.value).join(",")}
          stroke-linecap={value.lineCap}
        />
      {/if}
    </svg>
  </div>
  <div class="typography-info">
    {#if typeof value === "string"}
      <div>Style: {value}</div>
    {:else if typeof value === "object"}
      <div>
        Dash Array: {value.dashArray.map(toDimensionValue).join(", ")}
      </div>
      <div>Line Cap: {value.lineCap}</div>
    {:else}
      <div>Custom stroke style</div>
    {/if}
  </div>
{/snippet}

{#snippet tokenCard(tokenMeta: TokenMeta)}
  {@const tokenValue = resolveTokenValue(tokenMeta, treeState.nodes())}
  <div class="token-card">
    <div class="token-name">{tokenMeta.name}</div>
    <div class="token-type">{titleCase(noCase(tokenValue.type))}</div>

    {#if tokenValue.type === "color"}
      {@const color = serializeColor(tokenValue.value)}
      <div class="color-preview" style="background: {color};"></div>
      <div class="color-value">{color}</div>
    {:else if tokenValue.type === "dimension"}
      <div class="dimension-value">
        {toDimensionValue(tokenValue.value)}
      </div>
    {:else if tokenValue.type === "duration"}
      <div class="duration-value">
        {toDurationValue(tokenValue.value)}
      </div>
    {:else if tokenValue.type === "number"}
      <div class="number-value">{tokenValue.value}</div>
    {:else if tokenValue.type === "fontFamily"}
      {@const fontFamily = toFontFamily(tokenValue.value)}
      <div class="font-family-preview" style="font-family: {fontFamily};">
        Aa Bb Cc 123
      </div>
      <div class="typography-info">{fontFamily}</div>
    {:else if tokenValue.type === "fontWeight"}
      {@const weight = tokenValue.value}
      <div class="font-weight-preview">
        <div class="font-weight-sample" style="font-weight: {weight};">
          Aa Bb Cc 123 (Weight: {weight})
        </div>
      </div>
      <div class="typography-info">Weight: {tokenValue.value}</div>
    {:else if tokenValue.type === "cubicBezier"}
      <div class="cubic-bezier-preview">
        {@render cubicBezierPreview(tokenValue.value)}
      </div>
      <div class="typography-info">
        {toCubicBezierValue(tokenValue.value)}
      </div>
    {:else if tokenValue.type === "transition"}
      {@const transition = tokenValue.value}
      <div class="cubic-bezier-preview">
        {@render cubicBezierPreview(transition.timingFunction)}
      </div>
      <div class="typography-info">
        Duration: {toDurationValue(transition.duration)}<br />
        Delay: {toDurationValue(transition.delay)}<br />
        Timing: {toCubicBezierValue(transition.timingFunction)}
      </div>
    {:else if tokenValue.type === "typography"}
      {@const typo = tokenValue.value}
      {@const fontFamily = toFontFamily(typo.fontFamily)}
      <div class="typography-preview">
        <div
          class="typography-sample"
          style="
          font-family: {fontFamily};
          font-weight: {typo.fontWeight};
          font-size: {toDimensionValue(typo.fontSize)};
          line-height: {typo.lineHeight};
          letter-spacing: {toDimensionValue(typo.letterSpacing)};"
        >
          Aa Bb Cc
        </div>
      </div>
      <div class="typography-info">
        Font: {fontFamily}<br />
        Weight: {typo.fontWeight}<br />
        Size: {toDimensionValue(typo.fontSize)}<br />
        Line Height: {typo.lineHeight}<br />
        Letter Spacing: {toDimensionValue(typo.letterSpacing)}
      </div>
    {:else if tokenValue.type === "gradient"}
      {@const gradient = toGradient(tokenValue.value)}
      <div class="gradient-preview" style="background: {gradient};"></div>
      <div class="color-value">{gradient}</div>
    {:else if tokenValue.type === "shadow"}
      {@const shadows = Array.isArray(tokenValue.value)
        ? tokenValue.value
        : [tokenValue.value]}
      <div
        class="shadow-preview"
        style="box-shadow: {toShadow(tokenValue.value)};"
      ></div>
      <div class="typography-info">{shadows.length} shadow(s)</div>
    {:else if tokenValue.type === "border"}
      {@const border = tokenValue.value}
      {@const color = serializeColor(border.color)}
      {@const style = typeof border.style === "string" ? border.style : "solid"}
      <div
        class="border-preview"
        style="border: {toDimensionValue(border.width)} {style} {color};"
      >
        Border
      </div>
    {:else if tokenValue.type === "strokeStyle"}
      {@render strokeStylePreview(tokenValue.value)}
    {/if}

    {#if tokenMeta.description}
      <div class="token-description">{tokenMeta.description}</div>
    {/if}
    {#if tokenMeta.deprecated}
      {@const reason =
        typeof tokenMeta.deprecated === "string"
          ? `: ${tokenMeta.deprecated}`
          : ""}
      <div class="token-deprecated">Deprecated{reason}</div>
    {/if}
  </div>
{/snippet}

{#snippet renderNodes(parentId: string | undefined, depth: number)}
  {@const children = treeState
    .getChildren(parentId)
    .filter((node) => visibleNodes.size === 0 || visibleNodes.has(node.nodeId))}
  {@const groups = children.filter(
    (node) => node.meta.nodeType === "token-group",
  )}
  {@const tokens = children.filter((node) => node.meta.nodeType === "token")}
  {#each groups as group (group.nodeId)}
    {#if group.meta.nodeType === "token-group"}
      <svelte:element this={`h${depth}`}>
        {group.meta.name}
      </svelte:element>
      {#if group.meta.description}
        <p>
          {group.meta.description}
        </p>
      {/if}
      {@render renderNodes(group.nodeId, depth + 1)}
    {/if}
  {/each}
  {#if tokens.length > 0}
    <div class="token-grid">
      {#each tokens as node (node.nodeId)}
        {#if node.meta.nodeType === "token"}
          {@render tokenCard(node.meta)}
        {/if}
      {/each}
    </div>
  {/if}
{/snippet}

<div class="styleguide">
  <div class="container">
    <h1>Design Tokens Styleguide</h1>
    {@render renderNodes(undefined, 2)}
  </div>
</div>

<style>
  .styleguide {
    background: #f0f0f0;
    color: #333;
    line-height: 1.6;
    overflow: auto;
    height: 100%;
    flex: 1;
    scrollbar-width: thin;
    scrollbar-color: rgb(0 0 0 / 0.2) #f0f0f0;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 20px;
  }

  h1 {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 30px;
    color: #000;
  }

  h2 {
    font-size: 24px;
    font-weight: 600;
    margin-top: 40px;
    margin-bottom: 20px;
    color: #222;
    border-bottom: 2px solid #e0e0e0;
    padding-bottom: 10px;
  }

  h3 {
    font-size: 16px;
    font-weight: 600;
    margin-top: 20px;
    margin-bottom: 12px;
    color: #444;
  }

  h4 {
    font-size: 14px;
    font-weight: 600;
    margin-top: 16px;
    margin-bottom: 10px;
    color: #555;
  }

  p {
    color: #666;
    margin-bottom: 20px;
  }

  .token-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }

  .token-card {
    background: white;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: box-shadow 0.2s ease;
  }

  .token-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .token-name {
    font-weight: 600;
    font-size: 13px;
    color: #333;
    margin-bottom: 8px;
    font-family: var(--typography-monospace-code);
  }

  .token-type {
    font-size: 11px;
    color: #999;
    text-transform: uppercase;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .color-preview {
    width: 100%;
    height: 80px;
    border-radius: 4px;
    border: 1px solid #e0e0e0;
    margin-bottom: 8px;
  }

  .color-value {
    font-family: var(--typography-monospace-code);
    font-size: 11px;
    color: #666;
    word-break: break-all;
  }

  .dimension-value,
  .number-value,
  .duration-value {
    font-family: var(--typography-monospace-code);
    font-size: 13px;
    color: #333;
    font-weight: 500;
  }

  .typography-preview {
    padding: 12px;
    background: #f9f9f9;
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .typography-sample {
    font-size: 18px;
    margin-bottom: 8px;
    color: #333;
  }

  .typography-info {
    font-family: var(--typography-monospace-code);
    font-size: 11px;
    color: #666;
  }

  .font-family-preview {
    padding: 12px;
    background: #f9f9f9;
    border-radius: 4px;
    margin-bottom: 8px;
    font-size: 24px;
    line-height: 1.5;
    min-height: 50px;
    display: flex;
    align-items: center;
  }

  .font-weight-preview {
    padding: 12px;
    background: #f9f9f9;
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .font-weight-sample {
    font-size: 18px;
    margin-bottom: 6px;
    line-height: 1.4;
    color: #333;
  }

  .token-description {
    font-size: 12px;
    color: #666;
    margin-top: 8px;
    font-style: italic;
  }

  .token-deprecated {
    background: #fff3cd;
    color: #856404;
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 500;
    margin-top: 8px;
    display: inline-block;
  }

  .gradient-preview {
    width: 100%;
    height: 60px;
    border-radius: 4px;
    border: 1px solid #e0e0e0;
  }

  .shadow-preview {
    height: 60px;
    background: white;
    border-radius: 4px;
    margin: 8px 0;
  }

  .border-preview {
    height: 40px;
    background: white;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 8px 0;
    font-size: 12px;
    color: #666;
  }

  .cubic-bezier-preview {
    width: 100%;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f9f9f9;
    border-radius: 4px;
    border: 1px solid #e0e0e0;
    margin-bottom: 8px;
  }

  .cubic-bezier-svg {
    width: 100%;
    height: 100%;
    max-width: 120px;
    max-height: 120px;
  }

  .stroke-style-preview {
    width: 100%;
    height: 80px;
    background: white;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 8px 0;
  }
</style>
