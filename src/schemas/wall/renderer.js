'use strict';

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

  // Compute openings in pixel space
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
    const rect = `    <rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="#F5EDD8" stroke="${STROKE}" stroke-width="${SW_OPENING}"/>`;
    if (f.link) {
      return `  <a href="#${f.link}" style="cursor:pointer">\n${rect}\n  </a>`;
    }
    return rect;
  }).filter(Boolean).join('\n');

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${totalW} ${totalH}">`,
    `  <rect width="${totalW}" height="${totalH}" fill="#F5F5F5"/>`,
    `  <path d="${outlinePath}" fill="none" stroke="${STROKE}" stroke-width="${SW_WALL}" stroke-linejoin="miter"/>`,
    floorPath ? `  <path d="${floorPath}" fill="none" stroke="${STROKE}" stroke-width="${SW_WALL}"/>` : '',
    windowSVG,
    doorSVG,
    fixtureSVG,
    `</svg>`,
  ].filter(Boolean).join('\n');
}

module.exports = { render };
