<script module lang="ts">
  import "@oddbird/popover-polyfill";
  import "invokers-polyfill";
  import "dialog-closedby-polyfill";
  import "hdr-color-input";
  import "interestfor";
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { generateKeyBetween } from "fractional-indexing";
  import {
    autoPlacement,
    autoUpdate,
    computePosition,
    offset,
    shift,
  } from "@floating-ui/dom";
  import {
    focusGroupKeyUX,
    hotkeyKeyUX,
    hotkeyMacCompat,
    startKeyUX,
  } from "keyux";
  import {
    Settings,
    Trash2,
    Folder,
    Square,
    Ruler,
    Clock,
    Type,
    Hash,
    Bold,
    Tangent,
    CaseUpper,
    ArrowRightLeft,
    LineSquiggle,
    Paintbrush,
    Tags,
    ListPlus,
    Layers,
    GitBranch,
  } from "@lucide/svelte";
  import TreeView, { type TreeItem } from "./tree-view.svelte";
  import Editor from "./editor.svelte";
  import AddToken from "./add-token.svelte";
  import AppMenu from "./app-menu.svelte";
  import Styleguide from "./styleguide.svelte";
  import type { TreeNode } from "./store";
  import {
    findTokenType,
    resolveTokenValue,
    treeState,
    type TreeNodeMeta,
  } from "./state.svelte";
  import { serializeColor } from "./color";
  import type { Value } from "./schema";
  import NewProject, { type Preset } from "./new-project.svelte";

  const { presets = [] }: { presets?: Preset[] } = $props();

  let appElement: undefined | HTMLDivElement;
  const zeroIndex = generateKeyBetween(null, null);

  let selectedContextId = $state<string | undefined>(undefined);
  let isConfiguringModifiers = $state(false);

  onMount(() => {
    return startKeyUX(window, [
      hotkeyKeyUX([hotkeyMacCompat()]),
      focusGroupKeyUX(),
    ]);
  });

  const rootNodes = $derived(
    treeState
      .getChildren(undefined)
      .filter((item) =>
        isConfiguringModifiers
          ? item.meta.nodeType === "token-modifier"
          : item.meta.nodeType === "token-set",
      ),
  );

  // svelte-ignore state_referenced_locally
  let selectedItems = new SvelteSet<string>(
    rootNodes.length ? [rootNodes[0].nodeId] : [],
  );

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
  const expandedItems = new SvelteSet(
    // svelte-ignore state_referenced_locally
    rootNodes.length ? [rootNodes[0].nodeId] : [],
  );

  const allContexts = $derived.by(() => {
    const contexts: Array<{ nodeId: string; name: string }> = [];
    const rootNodes = treeState.getChildren(undefined);
    for (const node of rootNodes) {
      if (node.meta.nodeType === "token-modifier") {
        const modifierChildren = treeState.getChildren(node.nodeId);
        for (const child of modifierChildren) {
          if (child.meta.nodeType === "token-context") {
            contexts.push({ nodeId: child.nodeId, name: child.meta.name });
          }
        }
      }
    }
    return contexts;
  });

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

  const addNode = (config: {
    nodeType: TreeNodeMeta["nodeType"];
    parentTypes: TreeNodeMeta["nodeType"][];
    defaultName: string;
  }) => {
    const firstSelectedId = Array.from(selectedItems)[0];
    const firstSelectedNode = treeState.getNode(firstSelectedId);

    let parentId: string | undefined;
    let insertAfterIndex: string;

    if (config.parentTypes.length === 0) {
      // Root level node (token-set, token-modifier)
      const rootChildren = treeState.getChildren(undefined);
      const lastChildIndex = rootChildren.at(-1)?.index ?? zeroIndex;
      insertAfterIndex = generateKeyBetween(lastChildIndex, null);
      parentId = undefined;
    } else {
      // Child node - needs a parent from allowed types
      if (!firstSelectedNode) {
        return;
      }

      const selectedType = firstSelectedNode.meta.nodeType;

      if (config.parentTypes.includes(selectedType)) {
        // Add as child of selected node
        parentId = firstSelectedId;
        const children = treeState.getChildren(firstSelectedId);
        const lastChildIndex = children.at(-1)?.index ?? zeroIndex;
        insertAfterIndex = generateKeyBetween(lastChildIndex, null);
      } else if (
        firstSelectedNode.parentId &&
        config.parentTypes.includes(
          treeState.getNode(firstSelectedNode.parentId)?.meta.nodeType!,
        )
      ) {
        // Add as sibling after selected node (same parent)
        parentId = firstSelectedNode.parentId;
        insertAfterIndex = generateKeyBetween(firstSelectedNode.index, null);
      } else {
        // Cannot add here
        return;
      }
    }

    const newNode: TreeNode<TreeNodeMeta> = {
      nodeId: crypto.randomUUID(),
      parentId,
      index: insertAfterIndex,
      meta: {
        nodeType: config.nodeType,
        name: config.defaultName,
      } as TreeNodeMeta,
    };

    treeState.transact((tx) => {
      tx.set(newNode);
    });
    selectedItems.clear();
    selectedItems.add(newNode.nodeId);
  };

  const addSet = () =>
    addNode({
      nodeType: "token-set",
      parentTypes: [],
      defaultName: "New Set",
    });

  const addGroup = () =>
    addNode({
      nodeType: "token-group",
      parentTypes: ["token-set", "token-group"],
      defaultName: "New Group",
    });

  const addModifier = () =>
    addNode({
      nodeType: "token-modifier",
      parentTypes: [],
      defaultName: "New Modifier",
    });

  const addContext = () =>
    addNode({
      nodeType: "token-context",
      parentTypes: ["token-modifier"],
      defaultName: "New Context",
    });

  const handleTokenAdded = (tokenNodeId: string) => {
    // select and open editor for the new token
    selectedItems.clear();
    selectedItems.add(tokenNodeId);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    if (
      event.target.closest("input, textarea, [contenteditable], color-input")
    ) {
      return;
    }
    const closestTree = event.target.closest("[role=tree]");
    // Space opens editor dialog
    if (event.key === " " && closestTree) {
      event.preventDefault();
      appElement?.querySelector<HTMLElement>("#app-node-editor")?.showPopover();
    }
    if (event.key === "Backspace" && closestTree) {
      handleDelete();
    }
  };

  const handleMove = (
    itemIds: string[],
    newParentId: undefined | string,
    position: number,
  ) => {
    // Validate move constraints based on node types
    for (const itemId of itemIds) {
      const node = treeState.getNode(itemId);
      if (!node) continue;

      const nodeType = node.meta.nodeType;

      // Token-sets and modifiers can only be at top level
      if (
        (nodeType === "token-set" || nodeType === "token-modifier") &&
        newParentId !== undefined
      ) {
        return;
      }

      // Contexts must have a modifier as parent
      if (nodeType === "token-context") {
        if (newParentId === undefined) return;
        const parentNode = treeState.getNode(newParentId);
        if (parentNode?.meta.nodeType !== "token-modifier") return;
      }

      // Groups and tokens must be under sets or groups
      if (nodeType === "token-group" || nodeType === "token") {
        if (newParentId !== undefined) {
          const parentNode = treeState.getNode(newParentId);
          if (
            parentNode?.meta.nodeType !== "token-set" &&
            parentNode?.meta.nodeType !== "token-group"
          ) {
            return;
          }
        } else {
          // Groups and tokens cannot be at root level
          return;
        }
      }
    }

    // get the children of the new parent to calculate the new index
    const newParentChildren = treeState.getChildren(newParentId);
    const prevIndex = newParentChildren[position - 1]?.index ?? zeroIndex;
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

  /**
   * polyfill for anchor positioning in popovers
   * detects toggle source (which is also poorly supported) with click handler
   * and uses floating-ui to position elements
   */
  let cleanupPositioningAutoUpdate: undefined | (() => void);
  const handleDocumentClick = (event: MouseEvent) => {
    // ignore if anchor-positioning is already supported
    if ("anchorName" in document.documentElement.style) {
      return;
    }
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[commandfor]",
    );
    if (button?.commandForElement) {
      const target = button.commandForElement;
      // ignore dialogs
      if (target instanceof HTMLDialogElement) {
        return;
      }
      // closed state is not always triggers beforetoggle
      cleanupPositioningAutoUpdate?.();
      const updatePosition = () => {
        computePosition(button, target, {
          middleware: [
            offset(8),
            shift({ padding: 12 }),
            autoPlacement({ allowedPlacements: ["top", "bottom"] }),
          ],
        }).then(({ x, y }) => {
          target.style.setProperty("margin", "0px");
          target.style.setProperty("left", `${x}px`);
          target.style.setProperty("top", `${y}px`);
        });
      };
      cleanupPositioningAutoUpdate = autoUpdate(button, target, updatePosition);
    }
  };

  const handleDocumentMouseOver = (event: MouseEvent) => {
    // ignore if anchor-positioning is already supported
    if ("anchorName" in document.documentElement.style) {
      return;
    }
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[interestfor]",
    );
    const interestFor = button?.getAttribute("interestfor");
    const target = interestFor
      ? appElement?.querySelector<HTMLElement>(`#${interestFor}`)
      : undefined;
    if (button && target) {
      // closed state is not always triggers beforetoggle
      cleanupPositioningAutoUpdate?.();
      const updatePosition = () => {
        computePosition(button, target, {
          middleware: [
            offset(8),
            shift({ padding: 12 }),
            autoPlacement({ allowedPlacements: ["top", "bottom"] }),
          ],
        }).then(({ x, y }) => {
          target.style.setProperty("margin", "0px");
          target.style.setProperty("left", `${x}px`);
          target.style.setProperty("top", `${y}px`);
        });
      };
      cleanupPositioningAutoUpdate = autoUpdate(button, target, updatePosition);
    }
  };
</script>

<NewProject
  {presets}
  onCreate={() => {
    const [firstRoot] = treeState.getChildren(undefined);
    expandedItems.clear();
    expandedItems.add(firstRoot.nodeId);
    selectedItems.clear();
    selectedItems.add(firstRoot.nodeId);
  }}
/>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="app"
  bind:this={appElement}
  onclickcapture={handleDocumentClick}
  onmouseovercapture={handleDocumentMouseOver}
  onkeydown={handleKeyDown}
>
  <div class="horizontal-container">
    <!-- Left Panel: Design Tokens -->
    <aside class="panel left-panel">
      <div class="panel-header app-toolbar">
        <AppMenu />
        <h1 class="a-panel-title">
          {isConfiguringModifiers ? "Modifiers" : "Engramma"}
        </h1>
        <div class="toolbar-actions">
          {#if selectedItems.size > 0}
            <button
              class="a-button"
              aria-label={`Delete ${selectedItems.size} item(s)`}
              interestfor="app-delete-tooltip"
              onclick={handleDelete}
            >
              <Trash2 size={16} />
            </button>
            <div id="app-delete-tooltip" popover="hint" class="a-tooltip">
              Delete selected items
            </div>
          {/if}
          {#if isConfiguringModifiers}
            <button
              class="a-button"
              aria-label="Add modifier"
              interestfor="app-add-modifier-tooltip"
              onclick={addModifier}
            >
              <Layers size={16} />
            </button>
            <div id="app-add-modifier-tooltip" popover="hint" class="a-tooltip">
              Add a new modifier
            </div>
            <button
              class="a-button"
              aria-label="Add context"
              interestfor="app-add-context-tooltip"
              onclick={addContext}
            >
              <GitBranch size={16} />
            </button>
            <div id="app-add-context-tooltip" popover="hint" class="a-tooltip">
              Add a new context
            </div>
          {:else}
            <button
              class="a-button"
              aria-label="Add set"
              interestfor="app-add-set-tooltip"
              onclick={addSet}
            >
              <ListPlus size={16} />
            </button>
            <div id="app-add-set-tooltip" popover="hint" class="a-tooltip">
              Add a new token set
            </div>
            <button
              class="a-button"
              aria-label="Add group"
              interestfor="app-add-group-tooltip"
              onclick={addGroup}
            >
              <Folder size={16} />
            </button>
            <div id="app-add-group-tooltip" popover="hint" class="a-tooltip">
              Add a new group
            </div>
            <AddToken {selectedItems} onTokenAdded={handleTokenAdded} />
          {/if}
        </div>
      </div>

      {#snippet renderTypeIcon(type: Value["type"])}
        {#if type === "color"}
          <div
            class="token-preview"
            style="background: var(--text-secondary);"
          ></div>
        {:else if type === "dimension"}
          <Ruler size={16} />
        {:else if type === "duration"}
          <Clock size={16} />
        {:else if type === "number"}
          <Hash size={16} />
        {:else if type === "fontFamily"}
          <CaseUpper size={16} />
        {:else if type === "fontWeight"}
          <Bold size={16} />
        {:else if type === "cubicBezier"}
          <Tangent size={16} />
        {:else if type === "transition"}
          <ArrowRightLeft size={16} />
        {:else if type === "typography"}
          <Type size={16} />
        {:else if type === "strokeStyle"}
          <LineSquiggle size={16} />
        {:else if type === "shadow"}
          <Tags size={16} />
        {:else if type === "border"}
          <Square size={16} />
        {:else if type === "gradient"}
          <Paintbrush size={16} />
        {/if}
      {/snippet}

      {#snippet treeItemEditorButton(nodeId: string)}
        <button
          class="a-small-button edit-button"
          aria-label="Edit"
          onclick={() => {
            selectedItems.clear();
            selectedItems.add(nodeId);
            /* safari closes dialog whenever cursor is out of button */
            appElement
              ?.querySelector<HTMLElement>("#app-node-editor")
              ?.showPopover();
          }}
        >
          <Settings size={16} />
        </button>
      {/snippet}

      {#snippet renderTreeItem(item: TreeItem)}
        {@const node = treeState.getNode(item.id)}

        {#if node?.meta.nodeType === "token-set"}
          <div class="token">
            <span class="token-set-name">{item.name}</span>
            {@render treeItemEditorButton(item.id)}
          </div>
        {/if}

        {#if node?.meta.nodeType === "token-group"}
          {@const type = findTokenType(node, treeState.nodes())}
          <div class="token">
            <div class="token-icon">
              {#if type}
                {@render renderTypeIcon(type)}
              {:else}
                <Folder size={16} />
              {/if}
            </div>
            <span class="token-name">{item.name}</span>
            {@render treeItemEditorButton(item.id)}
          </div>
        {/if}

        {#if node?.meta.nodeType === "token"}
          {@const tokenValue = resolveTokenValue(node, treeState.nodes())}
          <div class="token">
            {#if tokenValue.type === "color"}
              <div
                class="token-preview"
                style="background: {serializeColor(tokenValue.value)};"
              ></div>
            {:else}
              <div class="token-icon">
                {@render renderTypeIcon(tokenValue.type)}
              </div>
            {/if}
            <span class="token-name">{item.name}</span>
            {@render treeItemEditorButton(item.id)}
          </div>
        {/if}

        {#if node?.meta.nodeType === "token-modifier"}
          <div class="token">
            <div class="token-icon">
              <Layers size={16} />
            </div>
            <span class="token-name">{item.name}</span>
            {@render treeItemEditorButton(item.id)}
          </div>
        {/if}

        {#if node?.meta.nodeType === "token-context"}
          <div class="token">
            <div class="token-icon">
              <GitBranch size={16} />
            </div>
            <span class="token-name">{item.name}</span>
            {@render treeItemEditorButton(item.id)}
          </div>
        {/if}
      {/snippet}

      <div class="tokens-panel">
        <TreeView
          id="tokens-tree"
          label={isConfiguringModifiers ? "Modifiers" : "Design Tokens"}
          data={treeData}
          {selectedItems}
          {expandedItems}
          renderItem={renderTreeItem}
          onRenameItem={(itemId, newName) => {
            const node = treeState.getNode(itemId);
            if (node && newName !== node.meta.name) {
              treeState.transact((tx) => {
                tx.set({
                  ...node,
                  meta: { ...node.meta, name: newName },
                });
              });
            }
          }}
          canAcceptChildren={(targetId, items) => {
            if (!targetId) {
              // Root level constraints based on mode
              return items.every((itemId) => {
                const node = treeState.getNode(itemId);
                const nodeType = node?.meta.nodeType;
                return isConfiguringModifiers
                  ? nodeType === "token-modifier"
                  : nodeType === "token-set";
              });
            }

            const target = treeState.getNode(targetId);
            const targetType = target?.meta.nodeType;

            // token-set and token-group accept groups and tokens
            if (targetType === "token-set" || targetType === "token-group") {
              return items.every((itemId) => {
                const node = treeState.getNode(itemId);
                const nodeType = node?.meta.nodeType;
                return nodeType === "token-group" || nodeType === "token";
              });
            }

            // token-modifier accepts only token-context
            if (targetType === "token-modifier") {
              return items.every((itemId) => {
                const node = treeState.getNode(itemId);
                return node?.meta.nodeType === "token-context";
              });
            }

            // Other node types (token, token-context) don't accept children
            return false;
          }}
          onMove={handleMove}
        />
      </div>
    </aside>

    <Editor id="app-node-editor" {selectedItems} />

    <!-- Right Panel: CSS Variables / JSON -->
    <main class="panel right-panel">
      <div class="panel-header">
        <div class="a-tab-scroller">
          <div class="a-tab-list" role="tablist" aria-label="Modifier contexts">
            <button
              role="tab"
              aria-selected={selectedContextId === undefined &&
                !isConfiguringModifiers}
              class="a-tab"
              onclick={() => {
                selectedContextId = undefined;
                isConfiguringModifiers = false;
              }}
            >
              Sets
            </button>
            {#each allContexts as context (context.nodeId)}
              <button
                role="tab"
                aria-selected={selectedContextId === context.nodeId}
                class="a-tab"
                onclick={() => {
                  selectedContextId = context.nodeId;
                  isConfiguringModifiers = false;
                }}
              >
                {context.name}
              </button>
            {/each}
          </div>
          <button
            class="a-button a-tab-action"
            aria-label="Configure modifiers"
            onclick={() => (isConfiguringModifiers = !isConfiguringModifiers)}
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
      <div class="styleguide-panel">
        <Styleguide {selectedItems} {selectedContextId} />
      </div>
    </main>
  </div>
</div>

<style>
  .app {
    container-type: inline-size;
    anchor-name: --app;
    width: 100%;
    height: 100%;
    display: grid;
  }

  .horizontal-container {
    display: grid;
    grid-template-columns: clamp(320px, 30%, 360px) 1fr;
    grid-template-rows: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;

    @container (width <= 720px) {
      grid-template-columns: 100cqw 100cqw;
    }
  }

  /* Panels */
  .panel {
    display: grid;
    grid-template-rows: var(--panel-header-height) 1fr;
    background: var(--bg-primary);
    scroll-snap-align: center;
  }

  .left-panel {
    border-right: 1px solid var(--border-color);
  }

  .panel-header {
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    background: var(--bg-primary);
    overflow: hidden;
  }

  .app-toolbar {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding: 0 8px;
    gap: 8px;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    margin-left: auto;
  }

  .tokens-panel {
    anchor-name: --tokens-panel;
    overflow: auto;
  }

  /* Tree structure */
  .token {
    display: flex;
    align-items: center;
    gap: 8px;
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

  .token-icon {
    flex-shrink: 0;
    opacity: 0.6;
    display: flex;
    align-items: center;
  }

  .token-name {
    font-size: 14px;
    font-weight: 400;
    color: var(--text-primary);
  }

  .token-set-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .edit-button {
    pointer-events: auto;
    visibility: var(--tree-view-item-visibility);
  }

  .styleguide-panel {
    overflow: hidden;
  }
</style>
