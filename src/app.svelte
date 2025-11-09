<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import stringify from "json-stringify-pretty-compact";
  import TreeView, { type TreeItem } from "./tree-view.svelte";
  import { treeState, type TreeNodeMeta } from "./state.svelte";
  import type { TreeNode } from "./store";
  import { serializeDesignTokens } from "./tokens";
  import { generateCssVariables } from "./css-variables";

  const rootNodes = $derived(treeState.getChildren(undefined));

  let selectedItems = new SvelteSet<string>();
  let outputMode = $state<"css" | "json">("css");

  const buildTreeItem = (node: TreeNode<TreeNodeMeta>): TreeItem => {
    const children = treeState.getChildren(node.nodeId);
    return {
      id: node.nodeId,
      name: node.meta.name,
      children: children.map(buildTreeItem),
    };
  };

  const treeData = $derived(rootNodes.map(buildTreeItem));
  const defaultExpandedItems = $derived([]);

  const getColorPreview = (meta: undefined | TreeNodeMeta) => {
    if (meta?.nodeType !== "token" || meta.type !== "color") return null;

    const { colorSpace, components } = meta.value;
    if (colorSpace === "srgb" && components.length === 3) {
      const r = Math.round(components[0] * 255);
      const g = Math.round(components[1] * 255);
      const b = Math.round(components[2] * 255);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return "transparent";
  };

  const filterNodesToSelected = (
    nodes: Map<string, TreeNode<TreeNodeMeta>>,
    selectedIds: Set<string>,
  ) => {
    if (selectedIds.size === 0) {
      return nodes;
    }
    const filtered = new Map<string, TreeNode<TreeNodeMeta>>();
    // Collect all selected nodes and their descendants
    const addNodeAndDescendants = (nodeId: string) => {
      const node = nodes.get(nodeId);
      if (node) {
        filtered.set(node.nodeId, node);
        const children = Array.from(nodes.values()).filter(
          (n) => n.parentId === nodeId,
        );
        for (const child of children) {
          addNodeAndDescendants(child.nodeId);
        }
      }
    };
    // Collect all ancestors of selected nodes
    const addAncestors = (nodeId: string) => {
      const node = nodes.get(nodeId);
      if (node) {
        filtered.set(node.nodeId, node);
        if (node.parentId) {
          addAncestors(node.parentId);
        }
      }
    };
    // First add all selected nodes and their descendants
    for (const nodeId of selectedIds) {
      addNodeAndDescendants(nodeId);
    }
    // Then add all ancestors
    for (const nodeId of selectedIds) {
      const node = nodes.get(nodeId);
      if (node?.parentId) {
        addAncestors(node.parentId);
      }
    }
    return filtered;
  };

  const allSelectedNodes = $derived(
    filterNodesToSelected(treeState.nodes(), selectedItems),
  );
  const cssOutput = $derived(generateCssVariables(allSelectedNodes));
  const jsonOutput = $derived(
    stringify(serializeDesignTokens(allSelectedNodes)),
  );
</script>

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

      {#snippet renderTreeItem(item: TreeItem)}
        {@const meta = treeState.getNode(item.id)?.meta}
        <div class="token">
          {#if meta?.nodeType === "token" && meta?.type === "color"}
            <div
              class="token-preview"
              style="background: {getColorPreview(meta)};"
            ></div>
          {/if}
          <span class="token-name">{item.name}</span>
          {#if meta?.type}
            <div class="token-hint">{meta.type}</div>
          {/if}
        </div>
      {/snippet}

      <TreeView
        id="tokens-tree"
        label="Design Tokens"
        data={treeData}
        {selectedItems}
        {defaultExpandedItems}
        renderItem={renderTreeItem}
      />
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

<style>
  .container {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  /* Toolbar */
  .toolbar {
    display: none;
    justify-content: space-between;
    align-items: center;
    padding: 0 16px;
    height: 56px;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .toolbar-section {
    display: flex;
    gap: 4px;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 18px;
    transition: all 0.2s ease;
  }

  .toolbar-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .toolbar-btn:active {
    transform: translateY(0);
  }

  /* Main content */
  .content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* Panels */
  .panel {
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    border-right: 1px solid var(--border-color);
  }

  .left-panel {
    width: 50%;
    border-right: 1px solid var(--border-color);
  }

  .right-panel {
    flex: 1;
    border-right: none;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 16px;
    height: 60px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    background: var(--bg-primary);
    gap: 16px;
  }

  .panel-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--border-color);
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 16px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .add-btn:hover {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  /* Tree structure */
  .token {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    transition: all 0.2s ease;
  }

  .token-preview {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .token-hint {
    font-size: 12px;
    opacity: 0.6;
    font-family: var(--typography-monospace-code);
  }

  .token-name {
    font-size: 14px;
    font-weight: 400;
    color: var(--text-primary);
    flex: 1;
  }

  /* CSS Textarea */
  .css-textarea {
    flex: 1;
    padding: 16px;
    border: none;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--typography-monospace-code);
    font-size: 13px;
    line-height: 1.6;
    resize: none;
    outline: none;
  }

  .css-textarea::placeholder {
    color: var(--text-secondary);
    opacity: 0.6;
  }

  /* Output mode switcher */
  .output-mode-switcher {
    display: flex;
    gap: 4px;
    background: var(--bg-secondary);
    padding: 4px;
    border-radius: 6px;
  }

  .mode-btn {
    padding: 6px 16px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .mode-btn.active {
    background: var(--accent);
    color: white;
  }

  .mode-btn.active:hover {
    background: var(--accent-hover);
  }
</style>
