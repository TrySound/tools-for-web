<script module lang="ts">
  import "@oddbird/popover-polyfill";
  import "invokers-polyfill";
  import "dialog-closedby-polyfill";
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { generateKeyBetween } from "fractional-indexing";
  import {
    focusGroupKeyUX,
    hotkeyKeyUX,
    hotkeyMacCompat,
    startKeyUX,
  } from "keyux";
  import stringify from "json-stringify-pretty-compact";
  import { Settings, Trash2, Folder } from "@lucide/svelte";
  import TreeView, { type TreeItem } from "./tree-view.svelte";
  import Editor from "./editor.svelte";
  import AddToken from "./add-token.svelte";
  import AppMenu from "./app-menu.svelte";
  import Styleguide from "./styleguide.svelte";
  import type { TreeNode } from "./store";
  import {
    resolveTokenValue,
    treeState,
    type TreeNodeMeta,
  } from "./state.svelte";
  import { serializeDesignTokens } from "./tokens";
  import { generateCssVariables } from "./css-variables";
  import { serializeColor } from "./color";

  onMount(() => {
    return startKeyUX(window, [
      hotkeyKeyUX([hotkeyMacCompat()]),
      focusGroupKeyUX(),
    ]);
  });

  const rootNodes = $derived(treeState.getChildren(undefined));

  let selectedItems = new SvelteSet<string>();
  let outputMode = $state<"styleguide" | "css" | "json">("styleguide");
  let editingMode = $state(false);

  const buildTreeItem = (node: TreeNode<TreeNodeMeta>): TreeItem => {
    const children = treeState.getChildren(node.nodeId);
    return {
      id: node.nodeId,
      parentId: node.parentId,
      name: node.meta.name,
      children: children.map(buildTreeItem),
    };
  };

  const treeData = $derived(rootNodes.map(buildTreeItem));
  const defaultExpandedItems = $derived([]);

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

  const handleDelete = () => {
    if (selectedItems.size === 0) {
      return;
    }
    // find the next focus target before deletion
    const currentNodeId = Array.from(selectedItems).at(0);
    let nextFocusId: string | undefined;
    if (currentNodeId) {
      const nextSelectedNode =
        treeState.getNextSibling(currentNodeId) ??
        treeState.getPrevSibling(currentNodeId) ??
        treeState.getParent(currentNodeId);
      if (nextSelectedNode) {
        nextFocusId = nextSelectedNode.nodeId;
      }
    }
    // delete selected nodes
    treeState.transact((tx) => {
      for (const nodeId of selectedItems) {
        tx.delete(nodeId);
      }
    });
    // move selection to the next focus target
    selectedItems.clear();
    if (nextFocusId) {
      selectedItems.add(nextFocusId);
    }
  };

  const handleAddGroup = () => {
    if (selectedItems.size === 0) {
      return;
    }
    const firstSelectedId = Array.from(selectedItems)[0];
    const firstSelectedNode = treeState.getNode(firstSelectedId);
    if (!firstSelectedNode) {
      return;
    }
    // determine parent and index for new group
    let parentId: string | undefined;
    let insertAfterIndex: string;
    if (firstSelectedNode.meta.nodeType === "token-group") {
      parentId = firstSelectedId;
      // add at the end of the group
      const children = treeState.getChildren(firstSelectedId);
      const lastChildIndex =
        children.length > 0 ? children[children.length - 1].index : null;
      insertAfterIndex = generateKeyBetween(lastChildIndex, null);
    } else {
      // add after the token
      parentId = firstSelectedNode.parentId;
      insertAfterIndex = generateKeyBetween(firstSelectedNode.index, null);
    }
    const newGroup: TreeNode<TreeNodeMeta> = {
      nodeId: crypto.randomUUID(),
      parentId,
      index: insertAfterIndex,
      meta: {
        nodeType: "token-group",
        name: "New Group",
      },
    };
    treeState.transact((tx) => {
      tx.set(newGroup);
    });
    selectedItems.clear();
    selectedItems.add(newGroup.nodeId);
  };

  const handleTokenAdded = (tokenNodeId: string) => {
    // select and open editor for the new token
    selectedItems.clear();
    selectedItems.add(tokenNodeId);
    editingMode = true;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("input, textarea, [contenteditable]")
    ) {
      return;
    }
    if (event.key === "Backspace") {
      handleDelete();
    }
    // when node editor is open -> hide
    // otherwise remove selection
    if (event.key === "Escape") {
      if (editingMode) {
        editingMode = false;
      } else {
        selectedItems.clear();
      }
    }
  };

  const handleMove = (
    itemIds: string[],
    newParentId: string,
    position: number,
  ) => {
    // get the children of the new parent to calculate the new index
    const newParentChildren = treeState.getChildren(newParentId);
    const prevIndex = newParentChildren[position - 1]?.index ?? null;
    const nextIndex = newParentChildren[position]?.index ?? null;
    treeState.transact((tx) => {
      // move each item to the new parent
      for (const itemId of itemIds) {
        const node = treeState.getNode(itemId);
        if (node) {
          tx.set({
            ...node,
            parentId: newParentId,
            index: generateKeyBetween(prevIndex, nextIndex),
          });
        }
      }
    });
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="container" onkeydown={handleKeyDown}>
  <!-- Main Content -->
  <div class="content">
    <!-- Left Panel: Design Tokens -->
    <aside class="panel left-panel">
      <div class="panel-header">
        <AppMenu />
        <h2 class="panel-title">Design Tokens</h2>
        <div class="toolbar-actions">
          {#if selectedItems.size > 0}
            <button
              class="a-button"
              aria-label={`Delete ${selectedItems.size} item(s)`}
              onclick={handleDelete}
            >
              <Trash2 size={20} />
            </button>
            <button
              class="a-button"
              aria-label="Add group"
              onclick={handleAddGroup}
            >
              <Folder size={20} />
            </button>
          {/if}
          <AddToken {selectedItems} onTokenAdded={handleTokenAdded} />
        </div>
      </div>

      {#snippet renderTreeItem(item: TreeItem)}
        {@const meta = treeState.getNode(item.id)?.meta}
        <div class="token">
          {#if meta?.nodeType === "token"}
            {@const tokenValue = resolveTokenValue(meta, treeState.nodes())}
            {#if tokenValue.type === "color"}
              <div
                class="token-preview"
                style="background: {serializeColor(tokenValue.value)};"
              ></div>
            {/if}
          {/if}
          <span class="token-name">{item.name}</span>
          {#if meta?.type}
            <div class="token-hint">{meta.type}</div>
          {/if}
          <button
            class="edit-btn"
            onclick={() => {
              editingMode = true;
              selectedItems.clear();
              selectedItems.add(item.id);
            }}
            aria-label="Edit"
          >
            <Settings size={16} />
          </button>
        </div>
      {/snippet}

      <div class="tokens-container">
        <TreeView
          id="tokens-tree"
          label="Design Tokens"
          data={treeData}
          {selectedItems}
          {defaultExpandedItems}
          renderItem={renderTreeItem}
          canAcceptChildren={(nodeId) =>
            treeState.getNode(nodeId)?.meta.nodeType === "token-group"}
          onMove={handleMove}
        />
      </div>
    </aside>

    <!-- Right Panel: CSS Variables / JSON -->
    <main class="panel right-panel">
      <!-- Editor Panel -->
      {#if editingMode}
        <Editor {selectedItems} bind:editingMode />
      {:else}
        <div class="tablist-header" role="tablist" aria-label="Output format">
          <button
            role="tab"
            aria-selected={outputMode === "styleguide"}
            aria-controls="styleguide-tabpanel"
            class="tab-btn"
            onclick={() => (outputMode = "styleguide")}
          >
            Styleguide
          </button>
          <button
            role="tab"
            aria-selected={outputMode === "css"}
            aria-controls="css-tabpanel"
            class="tab-btn"
            onclick={() => (outputMode = "css")}
          >
            CSS
          </button>
          <button
            role="tab"
            aria-selected={outputMode === "json"}
            aria-controls="json-tabpanel"
            class="tab-btn"
            onclick={() => (outputMode = "json")}
          >
            JSON
          </button>
        </div>
        {#if outputMode === "styleguide"}
          <div id="styleguide-tabpanel" class="styleguide-panel">
            <Styleguide {selectedItems} />
          </div>
        {/if}
        {#if outputMode === "css"}
          <textarea
            id="css-tabpanel"
            class="css-textarea"
            readonly
            value={cssOutput}
          ></textarea>
        {/if}
        {#if outputMode === "json"}
          <textarea
            id="json-tabpanel"
            class="css-textarea"
            readonly
            value={jsonOutput}
          ></textarea>
        {/if}
      {/if}
    </main>
  </div>
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    height: 100vh;
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
    justify-content: flex-start;
    align-items: center;
    padding: 0 8px 0 12px;
    height: 48px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    background: var(--bg-primary);
    gap: 12px;
  }

  .toolbar-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-left: auto;
  }

  .panel-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .tokens-container {
    overflow: auto;
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
  }

  .edit-btn {
    pointer-events: auto;
    visibility: var(--tree-view-item-hover-visibility);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: 4px;
    color: var(--text-primary);
    opacity: 0.6;
    transition: all 0.2s ease;
    margin-left: 4px;
  }

  .edit-btn:hover {
    background: var(--bg-hover);
    color: var(--accent);
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

  /* Styleguide panel */
  .styleguide-panel {
    flex: 1;
    overflow: hidden;
  }

  .tablist-header {
    display: flex;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    background: var(--bg-primary);
    height: 48px;

    &::after {
      content: "";
      position: absolute;
      position-anchor: --app-selected-tab;
      left: anchor(left);
      right: anchor(right);
      /* cover header border */
      bottom: calc(anchor(bottom) - 1px);
      border-bottom: 2px solid var(--accent);
      transition: all 200ms;
    }
  }

  /* Tab button styles */
  .tab-btn {
    padding: 0 16px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-radius: 0;
    transition: all 0.2s ease;
    position: relative;
    height: 100%;
    display: flex;
    align-items: center;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;

    &:hover {
      color: var(--text-primary);
      background: var(--bg-secondary);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }

    &[aria-selected="true"] {
      color: var(--accent);
      anchor-name: --app-selected-tab;
    }
  }
</style>
