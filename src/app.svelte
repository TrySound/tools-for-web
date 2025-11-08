<script lang="ts">
  import { kebabCase } from "change-case";
  import { treeState } from "./state.svelte";
  import type { GroupMeta, TokenMeta } from "./state.svelte";
  import type { TreeNode } from "./store";
  import { serializeDesignTokens } from "./tokens";

  const rootNodes = $derived(treeState.getChildren(undefined));

  let expandedNodes = $state(new Set<string>());
  let selectedNodeId = $state<string | null>(null);
  let outputMode = $state<"css" | "json">("css");

  function toggleNode(nodeId: string) {
    const newSet = new Set(expandedNodes);
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId);
    } else {
      newSet.add(nodeId);
    }
    expandedNodes = newSet;
  }

  function selectNode(nodeId: string) {
    selectedNodeId = nodeId;
  }

  function getChildren(nodeId: string): TreeNode<GroupMeta | TokenMeta>[] {
    return treeState.getChildren(nodeId);
  }

  function formatValue(meta: GroupMeta | TokenMeta): string | null {
    if (meta.nodeType !== "token") return null;

    switch (meta.type) {
      case "color": {
        const { colorSpace, components } = meta.value;
        if (colorSpace === "srgb" && components.length === 3) {
          const r = Math.round(components[0] * 255);
          const g = Math.round(components[1] * 255);
          const b = Math.round(components[2] * 255);
          return `rgb(${r}, ${g}, ${b})`;
        }
        return `${colorSpace}(${components.join(", ")})`;
      }
      case "dimension":
        return `${meta.value.value}${meta.value.unit}`;
      case "duration":
        return `${meta.value.value}${meta.value.unit}`;
      case "number":
        return String(meta.value);
      case "fontFamily":
        return Array.isArray(meta.value) ? meta.value[0] : meta.value;
      case "fontWeight":
        return String(meta.value);
      case "cubicBezier":
        return `cubic-bezier(${meta.value.join(", ")})`;
      default:
        return null;
    }
  }

  function getColorPreview(meta: GroupMeta | TokenMeta): string | null {
    if (meta.nodeType !== "token" || meta.type !== "color") return null;

    const { colorSpace, components } = meta.value;
    if (colorSpace === "srgb" && components.length === 3) {
      const r = Math.round(components[0] * 255);
      const g = Math.round(components[1] * 255);
      const b = Math.round(components[2] * 255);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return "transparent";
  }

  function buildPath(nodeId: string): string[] {
    const path: string[] = [];
    let currentId: string | null = nodeId;

    while (currentId) {
      const nodes = treeState.values();
      const node = nodes.find((n) => n.nodeId === currentId);
      if (!node) break;

      path.unshift(node.meta.name);
      currentId = node.parentId ?? null;
    }

    return path;
  }

  function generateCssVariables(): string {
    const nodes = treeState.values();
    const tokens = nodes.filter((node) => node.meta.nodeType === "token");

    if (tokens.length === 0) {
      return ":root {\n  /* No tokens defined */\n}";
    }

    const cssVars = tokens
      .map((node) => {
        const tokenMeta = node.meta as TokenMeta;
        const path = buildPath(node.nodeId);
        const kebabPath = path.map((segment) => kebabCase(segment));
        const varName = `--${kebabPath.join("-")}`;
        const value = formatValue(tokenMeta);

        if (value === null) return null;

        return `  ${varName}: ${value};`;
      })
      .filter((line): line is string => line !== null);

    return `:root {\n${cssVars.join("\n")}\n}`;
  }

  const cssOutput = $derived(generateCssVariables());

  function serializeToJson(): string {
    const result = serializeDesignTokens(treeState.nodes());
    return JSON.stringify(result, null, 2);
  }

  const jsonOutput = $derived(serializeToJson());
</script>

{#snippet treeItem(node: TreeNode<GroupMeta | TokenMeta>, depth: number)}
  {@const children = getChildren(node.nodeId)}
  {@const hasChildren = children.length > 0}
  {@const isExpanded = expandedNodes.has(node.nodeId)}
  {@const isSelected = selectedNodeId === node.nodeId}
  {@const valuePreview = formatValue(node.meta)}
  {@const colorPreview = getColorPreview(node.meta)}

  <div class="tree-node" style="padding-left: {depth * 16}px;">
    {#if hasChildren}
      <button
        class="tree-toggle"
        onclick={() => toggleNode(node.nodeId)}
        title={isExpanded ? "Collapse" : "Expand"}
      >
        <span class="tree-chevron" class:rotated={isExpanded}> ▶ </span>
      </button>
      <span class="tree-folder-icon">📁</span>
    {:else}
      <span class="tree-spacer"></span>
    {/if}
    {#if colorPreview}
      <div class="token-preview" style="background: {colorPreview};"></div>
    {/if}
    <button
      class="tree-label"
      class:selected={isSelected}
      onclick={() => selectNode(node.nodeId)}
    >
      {node.meta.name}
    </button>
    {#if valuePreview}
      <div class="tree-preview">
        <span class="tree-preview-value">{valuePreview}</span>
      </div>
    {/if}
  </div>

  {#if isExpanded && hasChildren}
    {#each children as child (child.nodeId)}
      {@render treeItem(child, depth + 1)}
    {/each}
  {/if}
{/snippet}

<div class="container">
  <!-- Toolbar -->
  <header class="toolbar" hidden>
    <div class="toolbar-section">
      <button class="toolbar-btn" title="New project">
        <span class="icon">✚</span>
      </button>
      <button class="toolbar-btn" title="Open">
        <span class="icon">📁</span>
      </button>
      <button class="toolbar-btn" title="Save">
        <span class="icon">💾</span>
      </button>
    </div>

    <div class="toolbar-section">
      <button class="toolbar-btn" title="Export">
        <span class="icon">⬇</span>
      </button>
      <button class="toolbar-btn" title="Settings">
        <span class="icon">⚙</span>
      </button>
    </div>
  </header>

  <!-- Main Content -->
  <div class="content">
    <!-- Left Panel: Design Tokens -->
    <aside class="panel left-panel">
      <div class="panel-header">
        <h2 class="panel-title">Design Tokens</h2>
        <button class="add-btn" title="Add token">+</button>
      </div>

      <div class="tokens-list">
        {#each rootNodes as node (node.nodeId)}
          {@render treeItem(node, 0)}
        {/each}
      </div>
    </aside>

    <!-- Right Panel: CSS Variables / JSON -->
    <main class="panel right-panel">
      <div class="panel-header">
        <h2 class="panel-title">
          {outputMode === "css" ? "CSS Variables" : "Design Tokens JSON"}
        </h2>
        <div class="output-mode-switcher">
          <button
            class="mode-btn"
            class:active={outputMode === "css"}
            onclick={() => (outputMode = "css")}
            title="Show CSS Variables"
          >
            CSS
          </button>
          <button
            class="mode-btn"
            class:active={outputMode === "json"}
            onclick={() => (outputMode = "json")}
            title="Show JSON"
          >
            JSON
          </button>
        </div>
      </div>

      <textarea
        class="css-textarea"
        readonly
        value={outputMode === "css" ? cssOutput : jsonOutput}
      ></textarea>
    </main>
  </div>
</div>
