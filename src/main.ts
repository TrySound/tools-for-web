import { mount } from "svelte";
import App from "./app.svelte";
import "./app.css";
import { parseDesignTokens } from "./tokens";
import { treeState } from "./state.svelte";
import designTokens from "./design-tokens-example.tokens.json";

// Parse design tokens and populate state
const parseResult = parseDesignTokens(designTokens);

// Log any parsing errors
if (parseResult.errors.length > 0) {
  console.error("Design token parsing errors:", parseResult.errors);
}

// Populate the tree state with parsed nodes
treeState.transact((tx) => {
  for (const node of parseResult.nodes) {
    tx.set(node);
  }
});

console.info("Loaded design tokens:", parseResult.nodes.length, "nodes");

mount(App, { target: document.body });
