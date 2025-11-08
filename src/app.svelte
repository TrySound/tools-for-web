<script lang="ts">
  import { treeState } from "./state.svelte";
  import type { GroupMeta, TokenMeta } from "./state.svelte";
  import type { TreeNode } from "./store";

  const rootNodes = $derived(treeState.getChildren(undefined));

  let expandedNodes = $state(new Set<string>());
  let selectedNodeId = $state<string | null>(null);

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
</script>

{#snippet treeItem(node: TreeNode<GroupMeta | TokenMeta>, depth: number)}
  {@const children = getChildren(node.nodeId)}
  {@const hasChildren = children.length > 0}
  {@const isExpanded = expandedNodes.has(node.nodeId)}
  {@const isSelected = selectedNodeId === node.nodeId}

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
    <span
      class="tree-label"
      class:selected={isSelected}
      onclick={() => selectNode(node.nodeId)}
    >
      {node.meta.name}
    </span>
  </div>

  {#if isExpanded && hasChildren}
    {#each children as child (child.nodeId)}
      {@render treeItem(child, depth + 1)}
    {/each}
  {/if}
{/snippet}

<div class="container">
  <!-- Toolbar -->
  <header class="toolbar">
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

    <!-- Right Panel: CSS Variables -->
    <main class="panel right-panel">
      <div class="panel-header">
        <h2 class="panel-title">CSS Variables</h2>
      </div>

      <textarea class="css-textarea"></textarea>
    </main>
  </div>
</div>
