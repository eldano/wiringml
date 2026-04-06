'use strict';

const MARGIN     = 50;
const TARGET_W   = 800;
const WALL_T     = 0.15;    // default wall thickness in meters
const ROOM_FILL  = '#FAFAF8';
const WALL_FILL  = '#FFFFFF';
const WALL_COLOR = '#111';
const WIN_COLOR  = '#6699CC';
const DOOR_COLOR = '#888';
const WIN_LINES  = 2;

// Break a 1-D segment [0, length] into solid sub-segments given a list of gaps.
function subtractGaps(length, gaps) {
  const events = [0, length];
  for (const g of gaps) {
    events.push(Math.max(0, g.start));
    events.push(Math.min(length, g.end));
  }
  const sorted = [...new Set(events)].sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    const mid = (a + b) / 2;
    if (!gaps.some(g => mid >= g.start && mid <= g.end)) result.push([a, b]);
  }
  return result;
}

function render({ title, width, depth, walls }, _layout) {
  const scale = (TARGET_W - MARGIN * 2) / width;
  const W = width  * scale;
  const H = depth  * scale;
  const T = Math.round(WALL_T * scale);   // wall thickness in pixels

  // --- Resolve openings to pixel gaps in room-relative space (interior NW = 0,0) ---

  function resolveStart(o, wallLength) {
    const { from, offset } = o.position;
    return (from === 'left' || from === 'top')
      ? offset * scale
      : wallLength - (offset + o.width) * scale;
  }

  function wallGaps(side) {
    const wallLength = (side === 'north' || side === 'south') ? W : H;
    return (walls[side].openings || []).map(o => {
      const start = resolveStart(o, wallLength);
      return { ...o, start, end: start + o.width * scale };
    });
  }

  const northGaps = wallGaps('north');
  const southGaps = wallGaps('south');
  const eastGaps  = wallGaps('east');
  const westGaps  = wallGaps('west');

  // --- Compute door arc geometry in room-relative space ---

  function computeDoorArcs(gaps, side) {
    const isH = side === 'north' || side === 'south';

    const faces = {
      north: { inner: 0,   outer: -T   },
      south: { inner: H,   outer: H+T  },
      east:  { inner: W,   outer: W+T  },
      west:  { inner: 0,   outer: -T   },
    }[side];

    // Sign of the perpendicular direction pointing toward the room interior
    const roomSign = { north: 1, south: -1, east: -1, west: 1 }[side];

    return gaps.filter(g => g.type === 'door').map(g => {
      const r        = g.width * scale;
      const swing    = g.swing || { direction: 'cw', opens: 'in' };
      const isCW     = swing.direction === 'cw';
      const isInward = swing.opens !== 'out';
      const sweep    = isCW ? 1 : 0;
      const face     = isInward ? faces.inner : faces.outer;
      const arcDisp  = roomSign * (isInward ? 1 : -1) * r;

      let px, py, tx, ty, ex, ey;

      if (isH) {
        // north: pivotLeft when (cw===inward); south flips it
        const pivotLeft = (isCW === isInward) !== (side === 'south');
        px = pivotLeft ? g.start : g.end;   py = face;
        tx = pivotLeft ? g.end   : g.start; ty = face;
        ex = px; ey = face + arcDisp;
      } else {
        // east: pivotTop when (cw===inward); west flips it
        const pivotTop = (isCW === isInward) !== (side === 'west');
        py = pivotTop ? g.start : g.end;   px = face;
        ty = pivotTop ? g.end   : g.start; tx = face;
        ey = py; ex = face + arcDisp;
      }

      return { px, py, tx, ty, ex, ey, r, sweep, isH };
    });
  }

  const allDoorArcs = {
    north: computeDoorArcs(northGaps, 'north'),
    south: computeDoorArcs(southGaps, 'south'),
    east:  computeDoorArcs(eastGaps,  'east'),
    west:  computeDoorArcs(westGaps,  'west'),
  };
  const flatArcs = Object.values(allDoorArcs).flat();

  // --- Extra padding: include wall exterior and any outward door arcs ---

  const minX = flatArcs.reduce((m, a) => Math.min(m, a.px, a.tx, a.ex), -T);
  const maxX = flatArcs.reduce((m, a) => Math.max(m, a.px, a.tx, a.ex), W + T);
  const minY = flatArcs.reduce((m, a) => Math.min(m, a.py, a.ty, a.ey), -T);
  const maxY = flatArcs.reduce((m, a) => Math.max(m, a.py, a.ty, a.ey), H + T);

  const padLeft   = Math.ceil(Math.max(0, -minX));
  const padRight  = Math.ceil(Math.max(0, maxX - W));
  const padTop    = Math.ceil(Math.max(0, -minY));
  const padBottom = Math.ceil(Math.max(0, maxY - H));

  const x0 = MARGIN + padLeft;   // interior NW corner
  const y0 = MARGIN + padTop;
  const x1 = x0 + W;             // interior NE/SE corner x
  const y3 = y0 + H;             // interior SW/SE corner y

  const totalW = Math.ceil(W + padLeft + padRight + MARGIN * 2);
  const totalH = Math.ceil(H + padTop  + padBottom + MARGIN * 2);

  const strokeAttr = `stroke="${WALL_COLOR}" stroke-width="1" stroke-linecap="butt"`;

  // --- Room interior fill ---
  const roomFillSVG = `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="${ROOM_FILL}"/>`;

  // --- Wall fill rectangles (white, no stroke, drawn before face lines) ---

  // 4 corner squares
  const cornerFills = [
    `<rect x="${x0-T}" y="${y0-T}" width="${T}" height="${T}" fill="${WALL_FILL}"/>`,
    `<rect x="${x1}"   y="${y0-T}" width="${T}" height="${T}" fill="${WALL_FILL}"/>`,
    `<rect x="${x1}"   y="${y3}"   width="${T}" height="${T}" fill="${WALL_FILL}"/>`,
    `<rect x="${x0-T}" y="${y3}"   width="${T}" height="${T}" fill="${WALL_FILL}"/>`,
  ].join('\n  ');

  // Wall segment fills (solid sections only, no corners)
  function hWallFill(yTop, gaps, fromX) {
    return subtractGaps(W, gaps).map(([a, b]) =>
      `<rect x="${fromX+a}" y="${yTop}" width="${b-a}" height="${T}" fill="${WALL_FILL}"/>`
    ).join('\n  ');
  }
  function vWallFill(xLeft, gaps, fromY) {
    return subtractGaps(H, gaps).map(([a, b]) =>
      `<rect x="${xLeft}" y="${fromY+a}" width="${T}" height="${b-a}" fill="${WALL_FILL}"/>`
    ).join('\n  ');
  }

  const wallFills = [
    hWallFill(y0-T, northGaps, x0),
    hWallFill(y3,   southGaps, x0),
    vWallFill(x1,   eastGaps,  y0),
    vWallFill(x0-T, westGaps,  y0),
  ].filter(Boolean).join('\n  ');

  // --- Wall face lines ---
  // Each wall: outer face (with T corner extensions), inner face (gapped), two end caps.

  function hWallLines(yOuter, yInner, gaps, fromX) {
    const segs = [];
    // Outer face: always-solid corner extensions + gapped interior
    for (const [a, b] of [[-T, 0], ...subtractGaps(W, gaps), [W, W+T]]) {
      segs.push(`<line x1="${fromX+a}" y1="${yOuter}" x2="${fromX+b}" y2="${yOuter}" ${strokeAttr}/>`);
    }
    // Inner face: gapped, interior width only (no corner extensions)
    for (const [a, b] of subtractGaps(W, gaps)) {
      segs.push(`<line x1="${fromX+a}" y1="${yInner}" x2="${fromX+b}" y2="${yInner}" ${strokeAttr}/>`);
    }
    // No vertical caps: they would be collinear with the east/west inner faces,
    // making those lines appear to extend into the outer walls.
    return segs.join('\n  ');
  }

  function vWallLines(xOuter, xInner, gaps, fromY) {
    const segs = [];
    // Outer face: always-solid corner extensions + gapped interior
    for (const [a, b] of [[-T, 0], ...subtractGaps(H, gaps), [H, H+T]]) {
      segs.push(`<line x1="${xOuter}" y1="${fromY+a}" x2="${xOuter}" y2="${fromY+b}" ${strokeAttr}/>`);
    }
    // Inner face: gapped, spans interior height only (no corner extensions)
    for (const [a, b] of subtractGaps(H, gaps)) {
      segs.push(`<line x1="${xInner}" y1="${fromY+a}" x2="${xInner}" y2="${fromY+b}" ${strokeAttr}/>`);
    }
    // No horizontal caps: they would be collinear with the north/south inner faces,
    // making those lines appear to extend into the outer walls.
    return segs.join('\n  ');
  }

  const wallLines = [
    hWallLines(y0-T, y0, northGaps, x0),   // north: outer above, inner below
    hWallLines(y3+T, y3, southGaps, x0),   // south: outer below, inner above
    vWallLines(x1+T, x1, eastGaps,  y0),   // east:  outer right, inner left
    vWallLines(x0-T, x0, westGaps,  y0),   // west:  outer left,  inner right
  ].filter(Boolean).join('\n  ');

  // --- Window symbols ---
  // 2 parallel lines spanning the wall thickness, across the opening width.

  function windowSymbols(gaps, side) {
    const isH = side === 'north' || side === 'south';
    const { outer, inner, from } = {
      north: { outer: y0-T, inner: y0,   from: x0 },
      south: { outer: y3+T, inner: y3,   from: x0 },
      east:  { outer: x1+T, inner: x1,   from: y0 },
      west:  { outer: x0-T, inner: x0,   from: y0 },
    }[side];

    return gaps.filter(g => g.type === 'window').map(g => {
      const gStart = from + g.start;
      const gEnd   = from + g.end;
      const lines  = [];
      for (let i = 1; i <= WIN_LINES; i++) {
        const pos = outer + (inner - outer) * i / (WIN_LINES + 1);
        lines.push(isH
          ? `<line x1="${gStart}" y1="${pos}" x2="${gEnd}"   y2="${pos}"   stroke="${WIN_COLOR}" stroke-width="1.5"/>`
          : `<line x1="${pos}"   y1="${gStart}" x2="${pos}"   y2="${gEnd}"   stroke="${WIN_COLOR}" stroke-width="1.5"/>`
        );
      }
      return lines.join('\n  ');
    }).join('\n  ');
  }

  const windowSyms = [
    windowSymbols(northGaps, 'north'),
    windowSymbols(southGaps, 'south'),
    windowSymbols(eastGaps,  'east'),
    windowSymbols(westGaps,  'west'),
  ].filter(Boolean).join('\n  ');

  // --- Door symbols ---
  // Panel starts at inner face (py/px in room-relative coords), flush with gap edge.
  const DOOR_T = Math.max(3, Math.round(0.04 * scale));

  function doorSVG(arcs) {
    return arcs.map(a => {
      let panel;
      if (a.isH) {
        const wallEdge = a.py;
        const capDir   = a.tx > a.px ? 1 : -1;
        const rectLeft = a.px + (capDir < 0 ? -DOOR_T : 0);
        const rx = Math.round(rectLeft + x0);
        const ry = Math.round(Math.min(wallEdge, a.ey) + y0);
        const rh = Math.round(Math.abs(a.ey - wallEdge));
        panel = `<rect x="${rx}" y="${ry}" width="${DOOR_T}" height="${rh}" fill="${DOOR_COLOR}"/>`;
      } else {
        const wallEdge = a.px;
        const capDir   = a.ty > a.py ? 1 : -1;
        const rectTop  = a.py + (capDir < 0 ? -DOOR_T : 0);
        const rx = Math.round(Math.min(wallEdge, a.ex) + x0);
        const ry = Math.round(rectTop + y0);
        const rw = Math.round(Math.abs(a.ex - wallEdge));
        panel = `<rect x="${rx}" y="${ry}" width="${rw}" height="${DOOR_T}" fill="${DOOR_COLOR}"/>`;
      }
      return [
        panel,
        `<path d="M ${a.tx+x0},${a.ty+y0} A ${a.r},${a.r} 0 0 ${a.sweep} ${a.ex+x0},${a.ey+y0}" fill="none" stroke="${DOOR_COLOR}" stroke-width="1" stroke-dasharray="4,3"/>`,
      ].join('\n  ');
    }).join('\n  ');
  }

  const doorSyms = Object.values(allDoorArcs).map(doorSVG).filter(Boolean).join('\n  ');

  // --- Labels ---
  const labelSVG = title
    ? `<text x="${x0 + W/2}" y="${y0 + H/2}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="16" fill="#777">${title}</text>`
    : '';

  const dimW = `<text x="${x0 + W/2}" y="${y3 + T + 22}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#999">${width} m</text>`;
  const dimH = `<text x="${x0 - T - 10}" y="${y0 + H/2}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="11" fill="#999" transform="rotate(-90 ${x0-T-10} ${y0+H/2})">${depth} m</text>`;

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${totalW} ${totalH}">`,
    `  <rect width="${totalW}" height="${totalH}" fill="#F0F0F0"/>`,
    `  ${roomFillSVG}`,
    `  ${cornerFills}`,
    wallFills  ? `  ${wallFills}`  : '',
    `  ${wallLines}`,
    windowSyms ? `  ${windowSyms}` : '',
    doorSyms   ? `  ${doorSyms}`   : '',
    labelSVG   ? `  ${labelSVG}`   : '',
    `  ${dimW}`,
    `  ${dimH}`,
    `</svg>`,
  ].filter(Boolean).join('\n');
}

module.exports = { render };
