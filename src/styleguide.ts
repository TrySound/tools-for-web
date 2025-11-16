import { compareTreeNodes, type TreeNode } from "./store";
import type { TreeNodeMeta } from "./state.svelte";
import { serializeColor } from "./color";

export const generateStyleguide = (
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): string => {
  const childrenMap = new Map<string | undefined, TreeNode<TreeNodeMeta>[]>();

  for (const node of nodes.values()) {
    const children = childrenMap.get(node.parentId) ?? [];
    children.push(node);
    childrenMap.set(node.parentId, children);
  }

  for (const children of childrenMap.values()) {
    children.sort(compareTreeNodes);
  }

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Design Tokens Styleguide</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
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
      font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
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
      font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
      font-size: 11px;
      color: #666;
      word-break: break-all;
    }

    .dimension-value,
    .number-value,
    .duration-value {
      font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
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
      font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
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

     .stroke-style-svg {
       width: 100%;
       height: 100%;
     }

     .empty-section {
       color: #999999;
       font-style: italic;
       padding: 20px;
       text-align: center;
     }
  </style>
</head>
<body>
  <div class="container">
    <h1>Design Tokens Styleguide</h1>
`;

  const renderToken = (node: TreeNode<TreeNodeMeta>): string => {
    const meta = node.meta;

    if (meta.nodeType !== "token") {
      return "";
    }

    let html = `<div class="token-card">
      <div class="token-name">${escapeHtml(meta.name)}</div>
      <div class="token-type">${meta.type}</div>
`;

    // Render based on token type
    if (meta.type === "color") {
      const color = serializeColor(meta.value);
      html += `
      <div class="color-preview" style="background: ${color};"></div>
      <div class="color-value">${color}</div>
`;
    } else if (meta.type === "dimension") {
      const dim = meta.value;
      html += `<div class="dimension-value">${dim.value}${dim.unit}</div>`;
    } else if (meta.type === "duration") {
      const dur = meta.value;
      html += `<div class="duration-value">${dur.value}${dur.unit}</div>`;
    } else if (meta.type === "number") {
      html += `<div class="number-value">${meta.value}</div>`;
    } else if (meta.type === "fontFamily") {
      const fontFamily = Array.isArray(meta.value)
        ? meta.value.join(", ")
        : meta.value;
      html += `<div class="font-family-preview" style="font-family: ${fontFamily};">Aa Bb Cc 123</div>
       <div class="typography-info">${escapeHtml(fontFamily)}</div>`;
    } else if (meta.type === "fontWeight") {
      const weight =
        typeof meta.value === "string" ? parseInt(meta.value) : meta.value;
      html += `<div class="font-weight-preview">
         <div class="font-weight-sample" style="font-weight: ${weight};">Aa Bb Cc 123 (Weight: ${weight})</div>
       </div>
       <div class="typography-info">Weight: ${meta.value}</div>`;
    } else if (meta.type === "cubicBezier") {
      const cb = meta.value;
      html += `<div class="cubic-bezier-preview">${generateCubicBezierSVG(cb)}</div>
      <div class="typography-info">cubic-bezier(${cb[0]}, ${cb[1]}, ${cb[2]}, ${cb[3]})</div>`;
    } else if (meta.type === "transition") {
      const tr = meta.value;
      html += `<div class="cubic-bezier-preview">${generateCubicBezierSVG(tr.timingFunction)}</div>
      <div class="typography-info">
        Duration: ${tr.duration.value}${tr.duration.unit}<br>
        Delay: ${tr.delay.value}${tr.delay.unit}<br>
        Timing: cubic-bezier(${tr.timingFunction[0]}, ${tr.timingFunction[1]}, ${tr.timingFunction[2]}, ${tr.timingFunction[3]})
      </div>`;
    } else if (meta.type === "typography") {
      const typo = meta.value;
      const fontFamily = Array.isArray(typo.fontFamily)
        ? typo.fontFamily.join(", ")
        : typo.fontFamily;
      html += `<div class="typography-preview">
        <div class="typography-sample" style="font-family: ${fontFamily}; font-weight: ${typo.fontWeight}; font-size: ${typo.fontSize.value}${typo.fontSize.unit}; line-height: ${typo.lineHeight}; letter-spacing: ${typo.letterSpacing.value}${typo.letterSpacing.unit};">
          Aa Bb Cc
        </div>
      </div>
      <div class="typography-info">
        Font: ${escapeHtml(fontFamily)}<br>
        Weight: ${typo.fontWeight}<br>
        Size: ${typo.fontSize.value}${typo.fontSize.unit}<br>
        Line Height: ${typo.lineHeight}<br>
        Letter Spacing: ${typo.letterSpacing.value}${typo.letterSpacing.unit}
      </div>`;
    } else if (meta.type === "gradient") {
      const gradient = meta.value;
      const gradientStr = generateGradientCSS(gradient);
      html += `<div class="gradient-preview" style="background: ${gradientStr};"></div>
      <div class="color-value">${gradientStr}</div>`;
    } else if (meta.type === "shadow") {
      const shadows = Array.isArray(meta.value) ? meta.value : [meta.value];
      const shadowCSSParts = shadows.map((shadow) => generateShadowCSS(shadow));
      const combinedShadowCSS = shadowCSSParts.join(", ");
      html += `<div class="shadow-preview" style="box-shadow: ${combinedShadowCSS};"></div>`;
      html += `<div class="typography-info">${shadows.length} shadow(s)</div>`;
    } else if (meta.type === "border") {
      const border = meta.value;
      const color = serializeColor(border.color);
      const styleStr =
        typeof border.style === "string" ? border.style : "solid";
      html += `<div class="border-preview" style="border: ${border.width.value}${border.width.unit} ${styleStr} ${color};">Border</div>`;
    } else if (meta.type === "strokeStyle") {
      html += `<div class="stroke-style-preview">${generateStrokeStyleSVG(meta.value)}</div>`;
      const styleInfo = generateStrokeStyleInfo(meta.value);
      html += `<div class="typography-info">${styleInfo}</div>`;
    }

    if (meta.description) {
      html += `<div class="token-description">${escapeHtml(meta.description)}</div>`;
    }

    if (meta.deprecated) {
      const reason =
        typeof meta.deprecated === "string" ? `: ${meta.deprecated}` : "";
      html += `<div class="token-deprecated">Deprecated${reason}</div>`;
    }

    html += `</div>`;
    return html;
  };

  const renderGroup = (
    parentId: string | undefined,
    path: string[],
  ): string => {
    let html = "";
    const children = childrenMap.get(parentId) ?? [];

    if (children.length === 0) {
      return html;
    }

    // Group tokens by type
    const tokensByType = new Map<string, TreeNode<TreeNodeMeta>[]>();
    const groups: TreeNode<TreeNodeMeta>[] = [];

    for (const child of children) {
      if (child.meta.nodeType === "token-group") {
        groups.push(child);
      } else {
        const type = child.meta.type;
        if (!tokensByType.has(type)) {
          tokensByType.set(type, []);
        }
        tokensByType.get(type)!.push(child);
      }
    }

    // Render tokens grouped by type
    for (const [type, tokens] of tokensByType) {
      html += `<h3>${type}</h3>`;
      html += `<div class="token-grid">`;
      for (const token of tokens) {
        html += renderToken(token);
      }
      html += `</div>`;
    }

    // Render sub-groups
    for (const group of groups) {
      html += `<h2>${escapeHtml(group.meta.name)}</h2>`;
      if (group.meta.description) {
        html += `<p style="color: #666; margin-bottom: 20px;">${escapeHtml(group.meta.description)}</p>`;
      }
      html += renderGroup(group.nodeId, [...path, group.meta.name]);
    }

    return html;
  };

  html += renderGroup(undefined, []);

  html += `
  </div>
</body>
</html>`;

  return html;
};

const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
};

const generateCubicBezierSVG = (
  bezier: [number, number, number, number],
): string => {
  const [x1, y1, x2, y2] = bezier;
  const size = 120;
  const padding = 15;
  const scale = size - padding * 2;

  // Convert bezier coordinates to SVG coordinates
  const x1Svg = padding + x1 * scale;
  const y1Svg = padding + (1 - y1) * scale;
  const x2Svg = padding + x2 * scale;
  const y2Svg = padding + (1 - y2) * scale;

  // Create cubic bezier path
  const path = `M ${padding} ${padding + scale} C ${x1Svg} ${y1Svg} ${x2Svg} ${y2Svg} ${padding + scale} ${padding}`;

  return `<svg viewBox="0 0 ${size} ${size}" class="cubic-bezier-svg" xmlns="http://www.w3.org/2000/svg">
     <!-- Grid lines -->
     <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${padding + scale}" stroke="#e0e0e0" stroke-width="0.5"/>
     <line x1="${padding}" y1="${padding + scale}" x2="${padding + scale}" y2="${padding + scale}" stroke="#e0e0e0" stroke-width="0.5"/>
     
     <!-- Curve -->
     <path d="${path}" fill="none" stroke="#4f46e5" stroke-width="1.5" stroke-linecap="round"/>
     
     <!-- Control points connection lines -->
     <line x1="${padding}" y1="${padding + scale}" x2="${x1Svg}" y2="${y1Svg}" stroke="#ccc" stroke-width="0.5" stroke-dasharray="2"/>
     <line x1="${x2Svg}" y1="${y2Svg}" x2="${padding + scale}" y2="${padding}" stroke="#ccc" stroke-width="0.5" stroke-dasharray="2"/>
     
     <!-- Control points -->
     <circle cx="${x1Svg}" cy="${y1Svg}" r="2" fill="#4f46e5" opacity="0.6"/>
     <circle cx="${x2Svg}" cy="${y2Svg}" r="2" fill="#4f46e5" opacity="0.6"/>
     
     <!-- Start and end points -->
     <circle cx="${padding}" cy="${padding + scale}" r="2.5" fill="#333"/>
     <circle cx="${padding + scale}" cy="${padding}" r="2.5" fill="#333"/>
   </svg>`;
};

const generateGradientCSS = (gradient: any): string => {
  try {
    // gradient is an array of stops with color and position
    if (!Array.isArray(gradient) || gradient.length === 0) {
      return "linear-gradient(90deg, #ccc, #ccc)";
    }

    const stops = gradient
      .map(
        (stop: any) => `${serializeColor(stop.color)} ${stop.position * 100}%`,
      )
      .join(", ");
    return `linear-gradient(90deg, ${stops})`;
  } catch {
    return "linear-gradient(90deg, #ccc, #ccc)";
  }
};

const generateShadowCSS = (shadow: any): string => {
  try {
    const offsetX = shadow.offsetX?.value ?? 0;
    const offsetY = shadow.offsetY?.value ?? 0;
    const blur = shadow.blur?.value ?? 0;
    const spread = shadow.spread?.value ?? 0;
    const color = serializeColor(shadow.color);
    const inset = shadow.inset ? "inset " : "";
    return `${inset}${offsetX}px ${offsetY}px ${blur}px ${spread}px ${color}`;
  } catch {
    return "0 0 0 0 rgba(0, 0, 0, 0.1)";
  }
};

const generateStrokeStyleSVG = (value: any): string => {
  const width = 200;
  const height = 80;
  const padding = 10;
  const lineY = height / 2;

  let strokeDasharray = "";
  let strokeLinecap = "butt";

  if (typeof value === "string") {
    // Handle predefined stroke styles
    switch (value) {
      case "solid":
        break;
      case "dashed":
        strokeDasharray = "8,4";
        break;
      case "dotted":
        strokeDasharray = "2,4";
        break;
      case "double":
        // Double line effect - draw two lines
        return `<svg viewBox="0 0 ${width} ${height}" class="stroke-style-svg" xmlns="http://www.w3.org/2000/svg">
           <line x1="${padding}" y1="${lineY - 3}" x2="${width - padding}" y2="${lineY - 3}" stroke="#333" stroke-width="2"/>
           <line x1="${padding}" y1="${lineY + 3}" x2="${width - padding}" y2="${lineY + 3}" stroke="#333" stroke-width="2"/>
         </svg>`;
      case "groove":
        // Groove effect with shadow
        return `<svg viewBox="0 0 ${width} ${height}" class="stroke-style-svg" xmlns="http://www.w3.org/2000/svg">
           <line x1="${padding}" y1="${lineY}" x2="${width - padding}" y2="${lineY}" stroke="#999" stroke-width="2"/>
           <line x1="${padding}" y1="${lineY + 1}" x2="${width - padding}" y2="${lineY + 1}" stroke="#eee" stroke-width="1"/>
         </svg>`;
      case "ridge":
        // Ridge effect (opposite of groove)
        return `<svg viewBox="0 0 ${width} ${height}" class="stroke-style-svg" xmlns="http://www.w3.org/2000/svg">
           <line x1="${padding}" y1="${lineY}" x2="${width - padding}" y2="${lineY}" stroke="#eee" stroke-width="2"/>
           <line x1="${padding}" y1="${lineY + 1}" x2="${width - padding}" y2="${lineY + 1}" stroke="#999" stroke-width="1"/>
         </svg>`;
      case "outset":
        // Outset effect with highlight
        return `<svg viewBox="0 0 ${width} ${height}" class="stroke-style-svg" xmlns="http://www.w3.org/2000/svg">
           <line x1="${padding}" y1="${lineY - 1}" x2="${width - padding}" y2="${lineY - 1}" stroke="#bbb" stroke-width="1"/>
           <line x1="${padding}" y1="${lineY + 1}" x2="${width - padding}" y2="${lineY + 1}" stroke="#666" stroke-width="2"/>
         </svg>`;
      case "inset":
        // Inset effect (opposite of outset)
        return `<svg viewBox="0 0 ${width} ${height}" class="stroke-style-svg" xmlns="http://www.w3.org/2000/svg">
           <line x1="${padding}" y1="${lineY - 1}" x2="${width - padding}" y2="${lineY - 1}" stroke="#666" stroke-width="2"/>
           <line x1="${padding}" y1="${lineY + 1}" x2="${width - padding}" y2="${lineY + 1}" stroke="#bbb" stroke-width="1"/>
         </svg>`;
    }
  } else if (typeof value === "object" && value.dashArray) {
    // Handle custom dash array
    const dashArray = value.dashArray;
    strokeLinecap = value.lineCap || "butt";

    // Convert dash array to SVG strokeDasharray format
    strokeDasharray = dashArray.map((dim: any) => dim.value || 0).join(",");
  }

  return `<svg viewBox="0 0 ${width} ${height}" class="stroke-style-svg" xmlns="http://www.w3.org/2000/svg">
     <line x1="${padding}" y1="${lineY}" x2="${width - padding}" y2="${lineY}" stroke="#333" stroke-width="2" stroke-dasharray="${strokeDasharray}" stroke-linecap="${strokeLinecap}"/>
   </svg>`;
};

const generateStrokeStyleInfo = (value: any): string => {
  if (typeof value === "string") {
    return `Style: ${value}`;
  }

  if (typeof value === "object" && value.dashArray) {
    const dashes = value.dashArray
      .map((dim: any) => `${dim.value}${dim.unit}`)
      .join(", ");
    return `Dash Array: ${dashes}<br>Line Cap: ${value.lineCap || "butt"}`;
  }

  return "Custom stroke style";
};
