'use strict';

const { WIRE_COLORS, getComponentDef } = require('./components');

/**
 * Render a graph + layout positions to an SVG string.
 */
function render(graph, positions) {
  const { components, wires } = graph;

  // Canvas dimensions
  let maxX = 0, maxY = 0;
  for (const pos of Object.values(positions)) {
    if (pos.x + pos.width  > maxX) maxX = pos.x + pos.width;
    if (pos.y + pos.height > maxY) maxY = pos.y + pos.height;
  }
  const W = maxX + 60;
  const H = maxY + 60;

  const compById = Object.fromEntries(components.map(c => [c.id, c]));

  // Wires drawn first (under components)
  const wireSVG = wires.map(wire => {
    const p1    = resolvePort(wire.from, compById, positions);
    const p2    = resolvePort(wire.to,   compById, positions);
    const color = WIRE_COLORS[wire.color] || wire.color;
    const d     = manhattanPath(p1.x, p1.y, p2.x, p2.y);
    return `  <path d="${d}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('\n');

  // Components drawn on top
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

/**
 * Resolve an endpoint { id, port } to an absolute { x, y } on the canvas.
 * Falls back to component center if the port name is unknown.
 */
function resolvePort(endpoint, compById, positions) {
  const comp = compById[endpoint.id];
  const pos  = positions[endpoint.id];
  if (!comp || !pos) return { x: 0, y: 0 };

  const def   = getComponentDef(comp.type);
  const ports = def.ports(comp.props);

  const rel = (endpoint.port && ports[endpoint.port])
    ? ports[endpoint.port]
    : (ports.center || { x: pos.width / 2, y: pos.height / 2 });

  return { x: pos.x + rel.x, y: pos.y + rel.y };
}

/**
 * Orthogonal (Manhattan) path: horizontal → vertical → horizontal.
 * Keeps wires axis-aligned, avoids diagonals.
 */
function manhattanPath(x1, y1, x2, y2) {
  const mx = Math.round((x1 + x2) / 2);
  return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
}

module.exports = { render };
