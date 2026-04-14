'use strict';

const { renderExtra } = require('./extras');

const MARGIN        = 40;    // outer SVG margin in px
const TARGET_W      = 800;   // target drawable width in px (dims are scaled to fit)
const STROKE        = '#111';
const SW_WALL       = 1;
const SW_OPENING    = 1;
const DOOR_FRAME_M  = 0.04;  // door frame width in meters (4 cm)
const DOOR_FRAME_FILL = '#DDD0B0';

// Physical dimensions of fixture types in meters
const FIXTURE_DIMS = {
  plaqueta: { w: 0.08, h: 0.12 },
  '3x4':    { w: 0.08, h: 0.12 },
};

function render({ width, left_height, right_height, openings = [], fixtures = [], extras = [] }, _layout) {
  const scale = (TARGET_W - MARGIN * 2) / width;

  const W  = Math.round(width        * scale);
  const LH = Math.round(left_height  * scale);
  const RH = Math.round(right_height * scale);

  const maxH   = Math.max(LH, RH);
  const floorY = MARGIN + maxH;
  const totalW = W + MARGIN * 2;
  const totalH = maxH + MARGIN * 2;

  // Wall corners
  const x0 = MARGIN,     y0 = floorY;           // bottom-left
  const x1 = MARGIN + W, y1 = floorY;           // bottom-right
  const x2 = MARGIN + W, y2 = floorY - RH;      // top-right
  const x3 = MARGIN,     y3 = floorY - LH;      // top-left

  // Compute openings in pixel space
  const DOOR_TYPES = new Set(['door', 'door_window', 'archway']);

  const mapOpening = o => {
    const dW = Math.round(o.width  * scale);
    const dH = Math.round(o.height * scale);
    const dX = o.position.from === 'right'
      ? x1 - Math.round((o.position.offset + o.width) * scale)
      : x0 + Math.round(o.position.offset * scale);
    return { x: dX, w: dW, h: dH, type: o.type };
  };

  // All door-like openings punch a gap in the floor line.
  const doorLike = openings.filter(o => DOOR_TYPES.has(o.type)).map(mapOpening);
  // Only framed types get the jamb/header drawing.
  const doors    = doorLike.filter(d => d.type !== 'archway');

  const windows = openings
    .filter(o => o.type === 'window')
    .map(o => {
      const wW = Math.round(o.width  * scale);
      const wH = Math.round(o.height * scale);
      const wX = o.position.from === 'right'
        ? x1 - Math.round((o.position.offset + o.width) * scale)
        : x0 + Math.round(o.position.offset * scale);
      const wY = floorY - Math.round(o.position.height * scale) - wH; // top-left y
      return { x: wX, y: wY, w: wW, h: wH };
    });

  // Build wall outline as a path, breaking the floor line at each door-like gap
  const floorSegments = [];
  let cursor = x0;
  for (const d of doorLike.sort((a, b) => a.x - b.x)) {
    if (d.x > cursor) floorSegments.push([cursor, d.x]);
    cursor = d.x + d.w;
  }
  if (cursor < x1) floorSegments.push([cursor, x1]);

  const floorPath = floorSegments.map(([a, b]) =>
    `M ${a},${y0} L ${b},${y0}`
  ).join(' ');

  // Left wall, ceiling, right wall as a single open path
  const outlinePath = `M ${x0},${y0} L ${x3},${y3} L ${x2},${y2} L ${x1},${y1}`;

  // Windows: frame (4 sides) + outer stroke
  const windowSVG = windows.map(w => {
    const fw = Math.round(DOOR_FRAME_M * scale);
    return [
      // Filled frame pieces
      `  <rect x="${w.x}"             y="${w.y}"             width="${w.w}" height="${fw}"  fill="${DOOR_FRAME_FILL}" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`,
      `  <rect x="${w.x}"             y="${w.y + w.h - fw}"  width="${w.w}" height="${fw}"  fill="${DOOR_FRAME_FILL}" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`,
      `  <rect x="${w.x}"             y="${w.y + fw}"         width="${fw}"  height="${w.h - 2 * fw}" fill="${DOOR_FRAME_FILL}" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`,
      `  <rect x="${w.x + w.w - fw}"  y="${w.y + fw}"         width="${fw}"  height="${w.h - 2 * fw}" fill="${DOOR_FRAME_FILL}" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`,
      // Outer stroke rect on top
      `  <rect x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" fill="none" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`,
    ].join('\n');
  }).join('\n');

  // Archways: single-line opening outline (no frame fill)
  const archwaySVG = doorLike.filter(d => d.type === 'archway').map(d => {
    const top = floorY - d.h;
    return [
      `  <line x1="${d.x}"       y1="${floorY}" x2="${d.x}"       y2="${top}" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`,
      `  <line x1="${d.x}"       y1="${top}"    x2="${d.x + d.w}" y2="${top}" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`,
      `  <line x1="${d.x + d.w}" y1="${top}"    x2="${d.x + d.w}" y2="${floorY}" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`,
    ].join('\n');
  }).join('\n');

  // Door frames: outer opening lines + inner frame (jambs + header)
  const doorSVG = doors.map(d => {
    const fw = Math.round(DOOR_FRAME_M * scale); // frame width in px
    const top = floorY - d.h;
    return [
      // Filled frame pieces (drawn first so outer lines sit on top)
      `  <rect x="${d.x}"             y="${top}" width="${fw}"      height="${d.h}" fill="${DOOR_FRAME_FILL}" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`,
      `  <rect x="${d.x + d.w - fw}"  y="${top}" width="${fw}"      height="${d.h}" fill="${DOOR_FRAME_FILL}" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`,
      `  <rect x="${d.x}"             y="${top}" width="${d.w}"      height="${fw}"  fill="${DOOR_FRAME_FILL}" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`,
      // Outer opening edges (crisp lines over the rects)
      `  <line x1="${d.x}"       y1="${floorY}" x2="${d.x}"       y2="${top}" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`,
      `  <line x1="${d.x}"       y1="${top}"    x2="${d.x + d.w}" y2="${top}" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`,
      `  <line x1="${d.x + d.w}" y1="${top}"    x2="${d.x + d.w}" y2="${floorY}" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`,
    ].join('\n');
  }).join('\n');

  // Fixture tooltips
  function escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildTooltip(notes, fx, fy) {
    const lines  = notes.split('\n');
    const lineH  = 16;
    const padX   = 8;
    const padY   = 6;
    const tipW   = Math.max(80, Math.ceil(Math.max(...lines.map(l => l.length)) * 6.5) + padX * 2);
    const tipH   = lines.length * lineH + padY * 2;
    const tx     = fx;
    const ty     = fy - tipH - 6;
    const tspans = lines.map((ln, i) =>
      `<tspan x="${tx + padX}" dy="${i === 0 ? 0 : lineH}">${escapeXml(ln)}</tspan>`
    ).join('');
    return [
      `<g class="wml-tip">`,
      `  <rect x="${tx}" y="${ty}" width="${tipW}" height="${tipH}" rx="3" fill="#1A1A1A" fill-opacity="0.85"/>`,
      `  <text x="${tx + padX}" y="${ty + padY + 11}" font-family="sans-serif" font-size="11" fill="#FFF">${tspans}</text>`,
      `</g>`,
    ].join('\n    ');
  }

  // Fixtures
  const hasTooltips = fixtures.some(f => f.notes);

  const fixtureSVG = fixtures.map(f => {
    const dims = FIXTURE_DIMS[f.type];
    if (!dims) return '';
    const fw = Math.round(dims.w * scale);
    const fh = Math.round(dims.h * scale);
    const fx = f.position.from === 'right'
      ? x1 - Math.round((f.position.offset + dims.w) * scale)
      : x0 + Math.round(f.position.offset * scale);
    const fy = floorY - Math.round(f.position.height * scale) - fh;
    const rect = `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="#F5EDD8" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`;
    if (f.notes) {
      const tooltip = buildTooltip(f.notes, fx, fy);
      const tag = f.link ? `a href="#${f.link}" style="cursor:pointer"` : 'g';
      const closeTag = f.link ? 'a' : 'g';
      return `  <${tag} class="wml-fix">\n    ${rect}\n    ${tooltip}\n  </${closeTag}>`;
    }
    if (f.link) {
      return `  <a href="#${f.link}" style="cursor:pointer">\n    ${rect}\n  </a>`;
    }
    return `  ${rect}`;
  }).filter(Boolean).join('\n');

  const styleSVG = hasTooltips
    ? `  <style>.wml-tip{visibility:hidden;pointer-events:none}.wml-fix:hover .wml-tip{visibility:visible}</style>`
    : '';

  // Extras: fixed schematic renders (ac_split, etc.)
  const extrasSVG = extras.map(e => {
    const ew = Math.round(e.width  * scale);
    const eh = Math.round(e.height * scale);
    const ex = e.position.from === 'right'
      ? x1 - Math.round((e.position.offset + e.width) * scale)
      : x0 + Math.round(e.position.offset * scale);
    const ey = floorY - Math.round(e.position.height * scale) - eh;
    return renderExtra(e.type, ex, ey, ew, eh);
  }).join('\n');

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${totalW} ${totalH}">`,
    styleSVG,
    `  <rect width="${totalW}" height="${totalH}" fill="#F5F5F5"/>`,
    `  <path d="${outlinePath}" fill="none" stroke="${STROKE}" stroke-width="${SW_WALL}" stroke-linejoin="miter"/>`,
    floorPath ? `  <path d="${floorPath}" fill="none" stroke="${STROKE}" stroke-width="${SW_WALL}"/>` : '',
    windowSVG,
    archwaySVG,
    doorSVG,
    extrasSVG,
    fixtureSVG,
    `</svg>`,
  ].filter(Boolean).join('\n');
}

module.exports = { render };
