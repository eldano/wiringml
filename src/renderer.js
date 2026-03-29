'use strict';

const { WIRE_COLORS, getComponentDef } = require('./components');

const MARGIN        = 30;   // outer SVG margin
const MARKER_R      = 8;    // conduit marker radius on panel
const PANEL_GAP     = 70;   // gap between panels and wiring diagram
const PANEL_W_DEF   = 120;  // default panel face width
const PANEL_H_DEF   = 160;  // default panel face height (3:4 ratio with width 120)

/** Resolve panel dimensions from the casing type or explicit overrides. */
function panelDims(overviews) {
  if (overviews.width && overviews.height) return { w: overviews.width, h: overviews.height };
  const type = overviews.casing?.type;
  if (type === '3x4') return { w: 120, h: 160 };
  return { w: PANEL_W_DEF, h: PANEL_H_DEF };
}

// Right-panel module dimensions
const MOD_W   = 80;
const MOD_H   = 28;
const MOD_GAP = 10;

// Where along a wall a position keyword maps to (0–1 fraction)
const H_FRAC = { left: 0.2, center: 0.5, right: 0.8 };
const V_FRAC = { top:  0.2, center: 0.5, bottom: 0.8 };

/**
 * Render graph + elkjs layout result to an SVG string.
 * If graph.casing is defined, renders a physical panel section on the left
 * connected to the wiring diagram on the right via dashed lines.
 */
function render(graph, { positions, edges }) {
  const { components, overviews, props = {}, notes = [] } = graph;

  // --- Panel section (optional) ---
  let panelResult = null;
  let xOffset     = 0;

  if (overviews?.casing !== undefined) {
    panelResult = buildPanel(overviews);
  }

  // --- Wiring diagram bounds ---
  let wiringMaxX = 0, wiringMaxY = 0;
  for (const pos of Object.values(positions)) {
    if (pos.x + pos.width  > wiringMaxX) wiringMaxX = pos.x + pos.width;
    if (pos.y + pos.height > wiringMaxY) wiringMaxY = pos.y + pos.height;
  }

  // Only shift the wiring diagram rightward when there's actually a circuit to show
  if (panelResult && components.length > 0) {
    xOffset = panelResult.panelRight + PANEL_GAP;
  }

  // --- Right panel (closed enclosure schematic) — sits below the open casing ---
  let rightPanelResult = null;
  if (overviews?.modules !== undefined) {
    const rpX = MARGIN;
    const rpY = (panelResult ? panelResult.panelBottom : MARGIN) + 20;
    rightPanelResult = buildRightPanel(overviews.modules || [], rpX, rpY, overviews);
  }

  const totalW = Math.max(800, components.length > 0
    ? xOffset + wiringMaxX + MARGIN
    : 1000);

  const NOTE_H    = notes.length ? notes.length * 18 + 12 : 0;
  const totalH = Math.max(
    rightPanelResult  ? rightPanelResult.panelBottom  + MARGIN : 0,
    panelResult       ? panelResult.panelBottom       + MARGIN : 0,
    wiringMaxY + MARGIN
  ) + NOTE_H;

  // --- Wires (ELK-routed, drawn in wiring coordinate space) ---
  const wireSVG = edges.map(({ wire, sections }) => {
    if (!sections.length) return '';
    const color = WIRE_COLORS[wire.color] || wire.color;
    return sections.map(section => {
      const pts = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
      const d   = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return `      <path d="${d}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join('\n');
  }).join('\n');

  // --- Components (drawn in wiring coordinate space) ---
  const compSVG = components.map(comp => {
    const pos = positions[comp.id];
    if (!pos) return '';
    return getComponentDef(comp.type).svg(pos.x, pos.y, comp.props, comp.id);
  }).join('\n');


  const titleSVG = props.title
    ? `  <text x="${MARGIN}" y="${MARGIN - 8}" font-family="sans-serif" font-size="13" font-weight="bold" fill="#444">${props.title}</text>`
    : null;

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${totalW} ${totalH}">`,
    `  <rect width="${totalW}" height="${totalH}" fill="#F5F5F5"/>`,
    titleSVG,
    panelResult      ? panelResult.svg      : null,
    rightPanelResult ? rightPanelResult.svg : null,
    components.length > 0 ? [
      `  <g id="wiring" transform="translate(${xOffset}, 0)">`,
      `    <g id="wires">`,
      wireSVG,
      `    </g>`,
      `    <g id="components">`,
      compSVG,
      `    </g>`,
      `  </g>`,
    ].join('\n') : null,
    notes.length ? [
      `  <g id="notes" font-family="sans-serif" font-size="11" fill="#555">`,
      ...notes.map((n, i) =>
        `    <text x="${MARGIN}" y="${totalH - NOTE_H + 16 + i * 18}">${n}</text>`
      ),
      `  </g>`,
    ].join('\n') : null,
    `</svg>`,
  ].filter(Boolean).join('\n');
}

/**
 * Build the casing panel SVG and metadata.
 * Conduit positions are declared as { wall, position } — semantic placement on the
 * physical enclosure face. Allowed walls: left | right | top | bottom | back.
 * Allowed positions: left | right | top | bottom | center.
 *
 * Returns { svg, panelRight, panelBottom, connectorPoints }
 */
function buildPanel(overviews) {
  const entries = Object.entries(overviews.casing || {}).filter(([k]) => k !== 'type');

  const { w: panelW, h: panelH } = panelDims(overviews);
  const panelX = MARGIN;
  const panelY = MARGIN + 20;

  const connectorPoints = {};
  const markers = [];

  for (const [id, def] of entries) {
    const wall     = def.wall     || 'back';
    const position = def.position || 'center';
    const { x: cx, y: cy } = markerPos(wall, position, panelX, panelY, panelW, panelH);

    connectorPoints[id] = { x: cx, y: cy };

    // Knockout symbol: filled orange circle with hollow centre
    markers.push(
      `    <circle cx="${cx}" cy="${cy}" r="${MARKER_R}" fill="#FF8C00" stroke="#555" stroke-width="1.5"/>`,
      `    <circle cx="${cx}" cy="${cy}" r="${Math.round(MARKER_R * 0.45)}" fill="#E8E8E8"/>`,
    );

    // Label placed just inside the panel face from the marker
    const lbl = labelPos(wall, cx, cy);
    markers.push(
      `    <text x="${lbl.x}" y="${lbl.y}" text-anchor="${lbl.anchor}" font-family="sans-serif" font-size="8" fill="#333">${id}</text>`,
    );
  }

  const svg = [
    `  <g id="casing">`,
    `    <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" fill="#AAAAAA" stroke="#555" stroke-width="2" rx="4"/>`,
    ...markers,
    `  </g>`,
  ].join('\n');

  return {
    svg,
    panelRight:  panelX + panelW,
    panelBottom: panelY + panelH,
    connectorPoints,
  };
}

/** Compute absolute (x, y) of a conduit marker given its wall and position. */
function markerPos(wall, position, panelX, panelY, panelW, panelH) {
  const inset = MARKER_R + 2;
  switch (wall) {
    case 'top':    return { x: panelX + panelW * (H_FRAC[position] ?? 0.5), y: panelY + inset };
    case 'bottom': return { x: panelX + panelW * (H_FRAC[position] ?? 0.5), y: panelY + panelH - inset };
    case 'left':   return { x: panelX + inset,          y: panelY + panelH * (V_FRAC[position] ?? 0.5) };
    case 'right':  return { x: panelX + panelW - inset, y: panelY + panelH * (V_FRAC[position] ?? 0.5) };
    case 'back':
    default:       return { x: panelX + panelW * (H_FRAC[position] ?? 0.5),
                             y: panelY + panelH * (V_FRAC[position] ?? 0.5) };
  }
}

/** Place the label just inside the panel face relative to the wall. */
function labelPos(wall, cx, cy) {
  const off = MARKER_R + 5;
  switch (wall) {
    case 'top':    return { x: cx,       y: cy + off + 5, anchor: 'middle' };
    case 'bottom': return { x: cx,       y: cy - off,     anchor: 'middle' };
    case 'left':   return { x: cx + off, y: cy + 4,       anchor: 'start'  };
    case 'right':  return { x: cx - off, y: cy + 4,       anchor: 'end'    };
    default:       return { x: cx + off, y: cy + 4,       anchor: 'start'  };
  }
}

/**
 * Build the right-side closed-panel schematic.
 * Modules are stacked vertically and centred inside the panel rectangle.
 * Supported module types: 'tipo_l' (rectangle + 3 pin holes), 'closed' (blank rectangle).
 */
function buildRightPanel(modules, panelX, panelY, overviews) {
  const { w: panelW, h: panelH } = panelDims(overviews);

  let moduleSVGs = [];
  if (modules.length > 0) {
    const stackH  = modules.length * MOD_H + (modules.length - 1) * MOD_GAP;
    const startY  = panelY + (panelH - stackH) / 2;
    const moduleX = panelX + (panelW - MOD_W) / 2;
    moduleSVGs = modules.map((type, i) =>
      renderModule(type, moduleX, startY + i * (MOD_H + MOD_GAP))
    );
  }

  const fill = modules.length > 0 ? '#F5EDD8' : '#555555';
  const svg = [
    `  <g id="right-panel">`,
    `    <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" fill="${fill}" stroke="#555" stroke-width="2" rx="4"/>`,
    ...moduleSVGs,
    `  </g>`,
  ].join('\n');

  return {
    svg,
    panelRight:  panelX + panelW,
    panelBottom: panelY + panelH,
  };
}

function renderModule(type, x, y) {
  if (type === 'switch-2p') {
    const offY = y + MOD_H * 0.72;
    const onY  = y + MOD_H * 0.72;
    return [
      `    <rect x="${x}" y="${y}" width="${MOD_W}" height="${MOD_H}" fill="#FFF9E6" stroke="#888" stroke-width="1" rx="2"/>`,
      `    <circle cx="${x + MOD_W * 0.14}" cy="${offY}" r="3" fill="none" stroke="#444" stroke-width="1.5"/>`,
      `    <line x1="${x + MOD_W * 0.82}" y1="${onY}" x2="${x + MOD_W * 0.90}" y2="${onY}" stroke="#444" stroke-width="2" stroke-linecap="round"/>`,
    ].join('\n');
  }
  if (type === 'switch-1p3w') {
    const offY = y + MOD_H * 0.72;
    const onY  = y + MOD_H * 0.72;
    return [
      `    <rect x="${x}" y="${y}" width="${MOD_W}" height="${MOD_H}" fill="#FFF9E6" stroke="#888" stroke-width="1" rx="2"/>`,
      `    <circle cx="${x + MOD_W * 0.14}" cy="${offY}" r="3" fill="none" stroke="#444" stroke-width="1.5"/>`,
      `    <line x1="${x + MOD_W * 0.82}" y1="${onY}" x2="${x + MOD_W * 0.90}" y2="${onY}" stroke="#444" stroke-width="2" stroke-linecap="round"/>`,
    ].join('\n');
  }
  if (type === 'switch-1p') {
    const offY = y + MOD_H * 0.72; // near bottom — OFF symbol
    const onY  = y + MOD_H * 0.72; // same height — ON symbol
    return [
      `    <rect x="${x}" y="${y}" width="${MOD_W}" height="${MOD_H}" fill="#FFF9E6" stroke="#888" stroke-width="1" rx="2"/>`,
      // OFF: small circle near the left edge
      `    <circle cx="${x + MOD_W * 0.14}" cy="${offY}" r="3" fill="none" stroke="#444" stroke-width="1.5"/>`,
      // ON: short horizontal bar near the right edge
      `    <line x1="${x + MOD_W * 0.82}" y1="${onY}" x2="${x + MOD_W * 0.90}" y2="${onY}" stroke="#444" stroke-width="2" stroke-linecap="round"/>`,
    ].join('\n');
  }
  if (type === 'tipo_l') {
    const pinXs = [
      Math.round(MOD_W * 0.25),
      Math.round(MOD_W * 0.50),
      Math.round(MOD_W * 0.75),
    ];
    const pins = pinXs.map(ox =>
      `    <circle cx="${x + ox}" cy="${y + MOD_H / 2}" r="4" fill="#444" stroke="#222" stroke-width="1"/>`
    ).join('\n');
    return [
      `    <rect x="${x}" y="${y}" width="${MOD_W}" height="${MOD_H}" fill="#F0EDE8" stroke="#444" stroke-width="1" rx="2"/>`,
      pins,
    ].join('\n');
  }
  // closed: slightly darker cream rectangle
  return `    <rect x="${x}" y="${y}" width="${MOD_W}" height="${MOD_H}" fill="#CBBA96" stroke="#555" stroke-width="1" rx="2"/>`;
}

module.exports = { render };
