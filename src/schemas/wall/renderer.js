'use strict';

const MARGIN     = 40;   // outer SVG margin in px
const TARGET_W   = 800;  // target drawable width in px (dims are scaled to fit)

// Physical dimensions of fixture types in meters
const FIXTURE_DIMS = {
  plaqueta: { w: 0.08, h: 0.12 },
  '3x4':    { w: 0.08, h: 0.12 },
};

function render({ width, left_height, right_height, openings = [], fixtures = [] }, _layout) {
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

  // Compute door openings in pixel space (only type=door for now)
  const doors = openings
    .filter(o => o.type === 'door')
    .map(o => {
      const dW = Math.round(o.width  * scale);
      const dH = Math.round(o.height * scale);
      const dX = o.position.from === 'right'
        ? x1 - Math.round((o.position.offset + o.width) * scale)
        : x0 + Math.round(o.position.offset * scale);
      return { x: dX, w: dW, h: dH };
    });

  // Build wall outline as a path, breaking the floor line at each door gap
  const floorSegments = [];
  let cursor = x0;
  for (const d of doors.sort((a, b) => a.x - b.x)) {
    if (d.x > cursor) floorSegments.push([cursor, d.x]);
    cursor = d.x + d.w;
  }
  if (cursor < x1) floorSegments.push([cursor, x1]);

  const floorPath = floorSegments.map(([a, b]) =>
    `M ${a},${y0} L ${b},${y0}`
  ).join(' ');

  // Left wall, ceiling, right wall as a single open path
  const outlinePath = `M ${x0},${y0} L ${x3},${y3} L ${x2},${y2} L ${x1},${y1}`;

  // Door frames: left edge, top lintel, right edge
  const doorSVG = doors.map(d => [
    `  <line x1="${d.x}"      y1="${floorY}"      x2="${d.x}"      y2="${floorY - d.h}" stroke="#888" stroke-width="2"/>`,
    `  <line x1="${d.x}"      y1="${floorY - d.h}" x2="${d.x + d.w}" y2="${floorY - d.h}" stroke="#888" stroke-width="2"/>`,
    `  <line x1="${d.x + d.w}" y1="${floorY - d.h}" x2="${d.x + d.w}" y2="${floorY}"      stroke="#888" stroke-width="2"/>`,
  ].join('\n')).join('\n');

  // Fixtures
  const fixtureSVG = fixtures.map(f => {
    const dims = FIXTURE_DIMS[f.type];
    if (!dims) return '';
    const fw = Math.round(dims.w * scale);
    const fh = Math.round(dims.h * scale);
    const fx = f.position.from === 'right'
      ? x1 - Math.round((f.position.offset + dims.w) * scale)
      : x0 + Math.round(f.position.offset * scale);
    const fy = floorY - Math.round(f.position.height * scale) - fh;
    const rect = `    <rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="#F5EDD8" stroke="#111" stroke-width="1.5"/>`;
    if (f.link) {
      return `  <a href="#${f.link}" style="cursor:pointer">\n${rect}\n  </a>`;
    }
    return rect;
  }).filter(Boolean).join('\n');

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${totalW} ${totalH}">`,
    `  <rect width="${totalW}" height="${totalH}" fill="#F5F5F5"/>`,
    `  <path d="${outlinePath}" fill="none" stroke="#111" stroke-width="2" stroke-linejoin="miter"/>`,
    floorPath ? `  <path d="${floorPath}" fill="none" stroke="#111" stroke-width="2"/>` : '',
    doorSVG,
    fixtureSVG,
    `</svg>`,
  ].filter(Boolean).join('\n');
}

module.exports = { render };
