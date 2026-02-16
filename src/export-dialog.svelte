<script lang="ts">
  import stringify from "json-stringify-pretty-compact";
  import { X } from "@lucide/svelte";
  import { treeState, type GroupMeta, type TokenMeta } from "./state.svelte";
  import { generateCssVariables } from "./css-variables";
  import { generateScssVariables } from "./scss";
  import { serializeDesignTokens } from "./tokens";
  import { serializeTokenResolver } from "./resolver";
  import Code from "./code.svelte";
  import type { TreeNode } from "./store";

  let exportMode = $state<"json" | "css" | "scss" | "resolver">("json");

  const nodes = $derived(treeState.nodes());
  const jsonOutput = $derived.by(() => {
    const filteredNodes = new Map<string, TreeNode<TokenMeta | GroupMeta>>();
    // remove set node from data and serialize as DTCG format module
    const setIds = new Set<undefined | string>();
    for (const node of nodes.values()) {
      if (
        node.meta.nodeType === "token-modifier" ||
        node.meta.nodeType === "token-context"
      ) {
        continue;
      }
      if (node.meta.nodeType === "token-set") {
        setIds.add(node.nodeId);
      } else {
        filteredNodes.set(node.nodeId, node as TreeNode<TokenMeta | GroupMeta>);
      }
    }
    for (const node of filteredNodes.values()) {
      if (setIds.has(node.parentId)) {
        // avoid mutating nodes
        filteredNodes.set(node.nodeId, { ...node, parentId: undefined });
      }
    }
    return stringify(serializeDesignTokens(filteredNodes));
  });
  const cssOutput = $derived(generateCssVariables(nodes));
  const scssOutput = $derived(generateScssVariables(nodes));
  const resolverOutput = $derived(stringify(serializeTokenResolver(nodes)));
</script>

<dialog id="export-dialog" class="dialog" closedby="any">
  <div class="a-tab-scroller">
    <div class="a-tab-list" role="tablist" aria-label="Export format">
      <button
        role="tab"
        aria-selected={exportMode === "json"}
        aria-controls="export-dialog-json"
        class="a-tab"
        onclick={() => (exportMode = "json")}
      >
        Export JSON
      </button>
      <button
        role="tab"
        aria-selected={exportMode === "resolver"}
        aria-controls="export-dialog-resolver"
        class="a-tab"
        onclick={() => (exportMode = "resolver")}
      >
        Export Resolver JSON
      </button>
      <button
        role="tab"
        aria-selected={exportMode === "css"}
        aria-controls="export-dialog-css"
        class="a-tab"
        onclick={() => (exportMode = "css")}
      >
        Export CSS
      </button>
      <button
        role="tab"
        aria-selected={exportMode === "scss"}
        aria-controls="export-dialog-scss"
        class="a-tab"
        onclick={() => (exportMode = "scss")}
      >
        Export SCSS
      </button>
    </div>
    <button
      class="a-button a-tab-action"
      aria-label="Close"
      commandfor="export-dialog"
      command="close"
    >
      <X size={16} />
    </button>
  </div>

  {#if exportMode === "json"}
    <div id="export-dialog-json" class="code-panel">
      <Code code={jsonOutput} language="json" />
    </div>
  {/if}
  {#if exportMode === "css"}
    <div id="export-dialog-css" class="code-panel">
      <Code code={cssOutput} language="css" />
    </div>
  {/if}
  {#if exportMode === "scss"}
    <div id="export-dialog-scss" class="code-panel">
      <Code code={scssOutput} language="scss" />
    </div>
  {/if}
  {#if exportMode === "resolver"}
    <div id="export-dialog-resolver" class="code-panel">
      <Code code={resolverOutput} language="json" />
    </div>
  {/if}
</dialog>

<style>
  .dialog:modal {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 0;
    max-width: 980px;
    width: 100%;
    height: 80vh;
    display: grid;
    grid-template-rows: max-content 1fr;
    box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);

    &::backdrop {
      background: rgba(0, 0, 0, 0.5);
    }
  }

  .code-panel {
    overflow: hidden;
  }
</style>
