'use strict';

const { getComponentWidth, getComponentHeight } = require('./components');

const H_GAP  = 80;  // horizontal gap between layers
const V_GAP  = 60;  // vertical gap between nodes in the same layer
const MARGIN = 50;  // canvas margin

/**
 * Compute x/y positions for all components using a simple layered layout.
 * Layer assignment: longest-path from any source node (iterative relaxation).
 * Within each layer, components are stacked top-to-bottom.
 *
 * Returns { [id]: { x, y, width, height } }
 */
function layout(graph) {
  const { components, wires } = graph;
  if (components.length === 0) return {};

  // Deduplicate directed edges (for layout purposes only)
  const edgeSet = new Set();
  const edges   = [];
  for (const wire of wires) {
    const { id: from } = wire.from;
    const { id: to }   = wire.to;
    if (from === to) continue;
    const key = `${from}\x00${to}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push({ from, to });
    }
  }

  // Longest-path layer assignment (iterative relaxation — handles DAGs correctly)
  const layer = {};
  for (const c of components) layer[c.id] = 0;

  let changed = true;
  while (changed) {
    changed = false;
    for (const { from, to } of edges) {
      const candidate = (layer[from] ?? 0) + 1;
      if (candidate > (layer[to] ?? 0)) {
        layer[to] = candidate;
        changed = true;
      }
    }
  }

  // Group by layer
  const byLayer = {};
  for (const c of components) {
    const l = layer[c.id] ?? 0;
    (byLayer[l] = byLayer[l] || []).push(c);
  }

  // Assign pixel positions
  const positions = {};
  let x = MARGIN;

  for (const l of Object.keys(byLayer).sort((a, b) => Number(a) - Number(b))) {
    const comps  = byLayer[l];
    let y        = MARGIN;
    let maxWidth = 0;

    for (const comp of comps) {
      const w = getComponentWidth(comp);
      const h = getComponentHeight(comp);
      positions[comp.id] = { x, y, width: w, height: h };
      y += h + V_GAP;
      if (w > maxWidth) maxWidth = w;
    }

    x += maxWidth + H_GAP;
  }

  return positions;
}

module.exports = { layout };
