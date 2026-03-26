'use strict';

const { WIRE_COLORS, getComponentDef } = require('./components');

/**
 * Render a graph and elkjs layout result to an SVG string.
 * layoutResult: { positions: { [id]: { x, y, width, height } }, edges: [{ wire, sections }] }
 */
function render(graph, { positions, edges }) {
  const { components } = graph;

  // Canvas dimensions from node extents
  let maxX = 0, maxY = 0;
  for (const pos of Object.values(positions)) {
    if (pos.x + pos.width  > maxX) maxX = pos.x + pos.width;
    if (pos.y + pos.height > maxY) maxY = pos.y + pos.height;
  }
  const W = maxX + 60;
  const H = maxY + 60;

  // Wires — use ELK-routed sections (absolute coordinates, overlap-free)
  const wireSVG = edges.map(({ wire, sections }) => {
    if (!sections.length) return '';
    const color = WIRE_COLORS[wire.color] || wire.color;
    return sections.map(section => {
      const points = [
        section.startPoint,
        ...(section.bendPoints || []),
        section.endPoint,
      ];
      const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return `  <path d="${d}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join('\n');
  }).join('\n');

  // Components
  const compSVG = components.map(comp => {
    const pos = positions[comp.id];
    if (!pos) return '';
    return getComponentDef(comp.type).svg(pos.x, pos.y, comp.props, comp.id);
  }).join('\n');

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `  <rect width="${W}" height="${H}" fill="#F5F5F5"/>`,
    `  <g id="wires">`,
    wireSVG,
    `  </g>`,
    `  <g id="components">`,
    compSVG,
    `  </g>`,
    `</svg>`,
  ].join('\n');
}

module.exports = { render };
