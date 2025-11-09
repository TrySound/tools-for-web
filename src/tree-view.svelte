<script module lang="ts">
  export type TreeItem = {
    id: string;
    name: string;
    children: TreeItem[];
  };
</script>

<script lang="ts">
  import { ChevronDown } from "@lucide/svelte";
  import { SvelteSet } from "svelte/reactivity";

  // based on https://www.w3.org/WAI/ARIA/apg/patterns/treeview/

  let {
    id: treeId,
    label,
    data,
    selectedItems,
    defaultExpandedItems,
    hoveredItemId = $bindable(),
    renderItem,
  }: {
    id: string;
    label: string;
    data: TreeItem[];
    selectedItems: SvelteSet<string>;
    defaultExpandedItems: string[];
    hoveredItemId?: string;
    renderItem?: (item: TreeItem) => any;
  } = $props();

  // based on https://www.w3.org/WAI/ARIA/apg/patterns/treeview/

  const expandedItems = new SvelteSet(defaultExpandedItems);
  let activeItemId = $state(Array.from(selectedItems).at(0));
  let treeElement: undefined | HTMLElement;

  const getItemId = (item: undefined | null | Element) => {
    if (item?.role === "treeitem") {
      return item.id.slice(`${treeId}--`.length);
    }
  };

  const getItemElementId = (itemId: string) => {
    return `${treeId}--${itemId}`;
  };

  const getVisibleItems = () => {
    if (!treeElement) {
      return [];
    }
    const items = Array.from(treeElement.querySelectorAll("[role=treeitem]"));
    const visibleItems = items.filter(
      (item) =>
        !item.parentElement?.closest("[role=treeitem][aria-expanded=false]"),
    );
    return visibleItems;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!treeElement) {
      return;
    }
    const activeItemElement = activeItemId
      ? treeElement.querySelector(`#${getItemElementId(activeItemId)}`)
      : treeElement.querySelector("[role=treeitem]");

    // - When focus is on a closed node, opens the node; focus does not move.
    // - When focus is on a open node, moves focus to the first child node.
    // - When focus is on an end node, does nothing.
    if (event.key === "ArrowRight") {
      // prevent scrolling with arrows
      event.preventDefault();
      if (activeItemElement?.ariaExpanded === "true") {
        const firstChildItemId = getItemId(
          activeItemElement?.querySelector("[role=treeitem]"),
        );
        if (firstChildItemId) {
          selectedItems.clear();
          selectedItems.add(firstChildItemId);
          activeItemId = firstChildItemId;
          // move focus from .select button to tree element
          // so keyboard events continue dispatching
          treeElement.focus();
        }
      }
      if (activeItemElement?.ariaExpanded === "false" && activeItemId) {
        expandedItems.add(activeItemId);
      }
    }

    // - When focus is on an open node, closes the node.
    // - When focus is on a child node that is also either an end node or a closed node, moves focus to its parent node.
    // - When focus is on a root node that is also either an end node or a closed node, does nothing.
    if (event.key === "ArrowLeft") {
      // prevent scrolling with arrows
      event.preventDefault();
      if (activeItemElement?.ariaExpanded === "true" && activeItemId) {
        expandedItems.delete(activeItemId);
      }
      if (
        activeItemElement?.ariaExpanded == null ||
        activeItemElement?.ariaExpanded === "false"
      ) {
        const parentItemId = getItemId(
          activeItemElement?.parentElement?.closest("[role=treeitem]"),
        );
        if (parentItemId) {
          selectedItems.clear();
          selectedItems.add(parentItemId);
          activeItemId = parentItemId;
          treeElement.focus();
        }
      }
    }

    // Moves focus to the next node that is focusable without opening or closing a node.
    if (event.key === "ArrowDown") {
      // prevent scrolling with arrows
      event.preventDefault();
      const visibleItems = getVisibleItems();
      if (activeItemElement) {
        let nextIndex = visibleItems.indexOf(activeItemElement) + 1;
        if (nextIndex >= visibleItems.length) {
          nextIndex -= visibleItems.length;
        }
        const nextItemId = getItemId(visibleItems.at(nextIndex));
        if (nextItemId) {
          // multi-select with shift
          if (!event.shiftKey) {
            selectedItems.clear();
          }
          selectedItems.add(nextItemId);
          activeItemId = nextItemId;
          treeElement.focus();
        }
      }
    }

    // Moves focus to the previous node that is focusable without opening or closing a node.
    if (event.key === "ArrowUp") {
      // prevent scrolling with arrows
      event.preventDefault();
      const visibleItems = getVisibleItems();
      if (activeItemElement) {
        const prevIndex = visibleItems.indexOf(activeItemElement) - 1;
        const prevItemId = getItemId(visibleItems.at(prevIndex));
        if (prevItemId) {
          // multi-select with shift
          if (!event.shiftKey) {
            selectedItems.clear();
          }
          selectedItems.add(prevItemId);
          activeItemId = prevItemId;
          treeElement.focus();
        }
      }
    }

    // Expands all siblings that are at the same level as the current node.
    if (event.key === "*") {
      for (const sibling of activeItemElement?.parentElement?.children ?? []) {
        const itemId = getItemId(sibling);
        if (itemId) {
          expandedItems.add(itemId);
        }
      }
    }

    if (event.key === "a" && event.metaKey) {
      // prevent text selection
      event.preventDefault();
      const visibleItems = getVisibleItems();
      for (const itemElement of visibleItems) {
        const itemId = getItemId(itemElement);
        if (itemId) {
          selectedItems.add(itemId);
        }
      }
    }
  };

  const selectItem = (event: MouseEvent) => {
    const itemId = getItemId(
      (event.target as HTMLElement).closest("[role=treeitem]"),
    );
    if (itemId) {
      // multi-select with ctrl or cmd pressed
      if (!event.metaKey) {
        selectedItems.clear();
      }
      selectedItems.add(itemId);
      activeItemId = itemId;
    }
  };

  const toggleItem = (event: MouseEvent) => {
    const itemElement = (event.target as HTMLElement).closest(
      "[role=treeitem]",
    );
    const itemId = getItemId(itemElement);
    if (!itemId) {
      return;
    }
    if (expandedItems.has(itemId)) {
      expandedItems.delete(itemId);
    } else {
      expandedItems.add(itemId);
    }
    // toggle all descendants
    if (event.altKey) {
      const descendants =
        itemElement?.querySelectorAll("[role=treeitem]") ?? [];
      if (expandedItems.has(itemId)) {
        for (const itemElement of descendants) {
          const itemId = getItemId(itemElement);
          if (itemElement.ariaExpanded != null && itemId) {
            expandedItems.add(itemId);
          }
        }
      } else {
        for (const itemElement of descendants) {
          const itemId = getItemId(itemElement);
          if (itemId) {
            expandedItems.delete(itemId);
          }
        }
      }
    }
  };
</script>

{#snippet item(itemData: TreeItem, level: number, position: number)}
  {@const { id, name, children } = itemData}
  <div
    id={getItemElementId(id)}
    role="treeitem"
    aria-level={level}
    style:--tree-view-level={level}
    aria-selected={selectedItems.has(id)}
    aria-expanded={children.length > 0 ? expandedItems.has(id) : undefined}
    data-hovered={hoveredItemId === id}
    data-position={position}
  >
    <div
      class="node"
      role="presentation"
      onmouseenter={() => (hoveredItemId = id)}
      onmouseleave={() => (hoveredItemId = undefined)}
    >
      <button
        class="select"
        aria-label={name}
        tabindex="-1"
        onclick={selectItem}
      ></button>
      <button class="toggle" tabindex="-1" onclick={toggleItem}>
        <ChevronDown size={16} />
      </button>
      {#if renderItem}
        {@render renderItem(itemData)}
      {:else}
        <div class="name">{name}</div>
      {/if}
    </div>
    <div role="group">
      {#each children as child, position (child.id)}
        {@render item(child, level + 1, position)}
      {/each}
    </div>
  </div>
{/snippet}

<div
  bind:this={treeElement}
  id={treeId}
  tabindex="0"
  role="tree"
  aria-multiselectable="true"
  aria-label={label}
  aria-activedescendant={activeItemId
    ? getItemElementId(activeItemId)
    : undefined}
  onkeydown={handleKeyDown}
>
  {#each data as root, position (root.id)}
    {@render item(root, 1, position)}
  {/each}
</div>

<style>
  [role="tree"] {
    padding: 8px 0;
    height: stretch;
    &:focus-visible,
    &:has(:focus-visible) {
      outline: none;
      background-color: var(--bg-secondary);
    }
  }

  [role="treeitem"] {
    position: relative;
    /* unsupported syntax in svelte */
    /* --tree-view-level: attr(aria-level type(<integer>)); */
    --tree-view-toggle-visibility: hidden;
    --tree-view-bg: transparent;
    --tree-view-bg-hover: var(--bg-hover);

    &[aria-expanded="true"] {
      --tree-view-toggle-visibility: visible;
      --tree-view-toggle-rotate: 0deg;
    }

    &[aria-expanded="false"] {
      --tree-view-toggle-visibility: visible;
      --tree-view-toggle-rotate: -90deg;
    }

    [role="tree"] &[data-hovered="true"] {
      --tree-view-bg: var(--bg-hover);
      --tree-view-bg-hover: var(--bg-hover);
      --tree-view-item-hover-visibility: visible;
    }

    [role="tree"] &[aria-selected="true"] {
      --tree-view-bg: var(--accent);
      --tree-view-bg-hover: var(--accent-hover);
    }
  }

  [role="group"] {
    display: none;

    [role="treeitem"][aria-expanded="true"] > & {
      display: block;
    }
  }

  .node {
    position: relative;
    display: flex;
    align-items: center;
    transition: 200ms;
    padding: 0 8px;
    padding-left: calc(8px + (var(--tree-view-level) - 1) * 12px);
    background-color: var(--tree-view-bg);
    color: var(--text-primary);
    --tree-view-item-hover-visibility: hidden;

    &:hover {
      background-color: var(--tree-view-bg-hover);
      --tree-view-item-hover-visibility: visible;
    }
  }

  .select {
    position: absolute;
    inset: 0;
    color: inherit;
    border: 0;
    background-color: transparent;
    /* selected/focused treeitem is already highlighted */
    outline: none;
  }

  .toggle {
    isolation: isolate;
    color: var(--text-primary);
    border: 0;
    padding: 0;
    background-color: transparent;
    visibility: var(--tree-view-toggle-visibility);
    rotate: var(--tree-view-toggle-rotate);
    width: 24px;
    height: stretch;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: 200ms;
    /* the state is fully controlled with keyboard */
    outline: none;
    opacity: 0.5;

    &:hover {
      opacity: 1;
    }
  }

  .name {
    isolation: isolate;
    font-size: 14px;
    pointer-events: none;
    padding: 4px 0;
  }
</style>
