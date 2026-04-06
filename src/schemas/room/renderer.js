'use strict';

const MARGIN     = 50;
const TARGET_W   = 800;
const WALL_SW    = 6;
const ROOM_FILL  = '#F5F2EB';
const WALL_COLOR = '#222';
const WIN_COLOR  = '#6699CC';
const DOOR_COLOR = '#888';
const WIN_LINES  = 3;

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
  const W = width * scale;
  const H = depth * scale;

  // --- Resolve openings to pixel gaps in room-relative space (room TL = 0,0) ---

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
  // Returns {px, py, tx, ty, ex, ey, r, sweep} for each door opening.
  // px/py = pivot point, tx/ty = tip (far jamb), ex/ey = arc endpoint.

  function computeDoorArcs(gaps, side) {
    const isH      = side === 'north' || side === 'south';
    const wallCoord = { north: 0, south: H, east: W, west: 0 }[side];

    return gaps.filter(g => g.type === 'door').map(g => {
      const r     = g.width * scale;
      const swing = g.swing || { pivot: isH ? 'left' : 'top', direction: 'cw' };
      const sweep = swing.direction === 'cw' ? 1 : 0;
      let px, py, tx, ty, ex, ey;

      if (isH) {
        const pivotLeft = swing.pivot === 'left';
        px = pivotLeft ? g.start : g.end;   py = wallCoord;
        tx = pivotLeft ? g.end   : g.start; ty = wallCoord;
        ex = px;
        ey = wallCoord + (tx > px ? 1 : -1) * (sweep ? 1 : -1) * r;
      } else {
        const pivotTop = swing.pivot === 'top';
        py = pivotTop ? g.start : g.end;   px = wallCoord;
        ty = pivotTop ? g.end   : g.start; tx = wallCoord;
        ey = py;
        ex = wallCoord + (ty > py ? -1 : 1) * (sweep ? 1 : -1) * r;
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

  // --- Compute extra padding from arc extents beyond room bounds ---

  const minX = flatArcs.reduce((m, a) => Math.min(m, a.px, a.tx, a.ex), 0);
  const maxX = flatArcs.reduce((m, a) => Math.max(m, a.px, a.tx, a.ex), W);
  const minY = flatArcs.reduce((m, a) => Math.min(m, a.py, a.ty, a.ey), 0);
  const maxY = flatArcs.reduce((m, a) => Math.max(m, a.py, a.ty, a.ey), H);

  const padLeft   = Math.ceil(Math.max(0, -minX));
  const padRight  = Math.ceil(Math.max(0, maxX - W));
  const padTop    = Math.ceil(Math.max(0, -minY));
  const padBottom = Math.ceil(Math.max(0, maxY - H));

  // --- SVG coordinate system with room placed at (x0, y0) ---

  const x0 = MARGIN + padLeft;
  const y0 = MARGIN + padTop;
  const x1 = x0 + W;
  const y3 = y0 + H;

  const totalW = Math.ceil(W + padLeft + padRight + MARGIN * 2);
  const totalH = Math.ceil(H + padTop + padBottom + MARGIN * 2);

  // --- Wall segment lines ---

  function hWallSegs(y, gaps, fromX) {
    return subtractGaps(W, gaps).map(([a, b]) =>
      `<line x1="${fromX + a}" y1="${y}" x2="${fromX + b}" y2="${y}" stroke="${WALL_COLOR}" stroke-width="${WALL_SW}" stroke-linecap="square"/>`
    ).join('\n  ');
  }

  function vWallSegs(x, gaps, fromY) {
    return subtractGaps(H, gaps).map(([a, b]) =>
      `<line x1="${x}" y1="${fromY + a}" x2="${x}" y2="${fromY + b}" stroke="${WALL_COLOR}" stroke-width="${WALL_SW}" stroke-linecap="square"/>`
    ).join('\n  ');
  }

  const wallSegs = [
    hWallSegs(y0, northGaps, x0),
    hWallSegs(y3, southGaps, x0),
    vWallSegs(x1, eastGaps,  y0),
    vWallSegs(x0, westGaps,  y0),
  ].filter(Boolean).join('\n  ');

  // --- Window symbols ---

  function windowSymbols(gaps, orientation, wallCoord, fromCoord) {
    const spacing = WALL_SW / (WIN_LINES + 1);
    return gaps.filter(g => g.type === 'window').map(g => {
      const lines = [];
      for (let i = 1; i <= WIN_LINES; i++) {
        const off = -WALL_SW / 2 + i * spacing;
        if (orientation === 'h') {
          lines.push(`<line x1="${fromCoord + g.start}" y1="${wallCoord + off}" x2="${fromCoord + g.end}" y2="${wallCoord + off}" stroke="${WIN_COLOR}" stroke-width="1.5"/>`);
        } else {
          lines.push(`<line x1="${wallCoord + off}" y1="${fromCoord + g.start}" x2="${wallCoord + off}" y2="${fromCoord + g.end}" stroke="${WIN_COLOR}" stroke-width="1.5"/>`);
        }
      }
      return lines.join('\n  ');
    }).join('\n  ');
  }

  const windowSyms = [
    windowSymbols(northGaps, 'h', y0, x0),
    windowSymbols(southGaps, 'h', y3, x0),
    windowSymbols(eastGaps,  'v', x1, y0),
    windowSymbols(westGaps,  'v', x0, y0),
  ].filter(Boolean).join('\n  ');

  // --- Door symbols (from precomputed arcs, shifted by room origin) ---
  // Each door: thin rectangle (panel in open position) + jamb line + dashed arc.
  // Door thickness ~4 cm in meters, minimum 3 px.
  const DOOR_T = Math.max(3, Math.round(0.04 * scale));

  function doorSVG(arcs) {
    return arcs.map(a => {
      // Panel rectangle: runs from just outside the wall edge to the arc endpoint.
      // The wall-side edge is offset by WALL_SW/2 so the panel only meets the wall at one corner.
      let panel;
      if (a.isH) {
        // swingDir: perpendicular direction toward which door swings
        // wallEdge: outer edge of wall stroke in the swing direction (where door rect starts in y)
        // capDir:   direction from pivot into the gap (toward tip)
        // gapEdge:  inner corner of wall's square linecap — the single touch point
        const swingDir = Math.sign(a.ey - a.py);
        const wallEdge = a.py + (WALL_SW / 2) * swingDir;
        const capDir   = a.tx > a.px ? 1 : -1;
        const gapEdge  = a.px + (WALL_SW / 2) * capDir;
        const rectLeft = capDir > 0 ? gapEdge : gapEdge - DOOR_T;
        const rx = Math.round(rectLeft + x0);
        const ry = Math.round(Math.min(wallEdge, a.ey) + y0);
        const rh = Math.round(Math.abs(a.ey - wallEdge));
        panel = `<rect x="${rx}" y="${ry}" width="${DOOR_T}" height="${rh}" fill="${DOOR_COLOR}"/>`;
      } else {
        const swingDir = Math.sign(a.ex - a.px);
        const wallEdge = a.px + (WALL_SW / 2) * swingDir;
        const capDir   = a.ty > a.py ? 1 : -1;
        const gapEdge  = a.py + (WALL_SW / 2) * capDir;
        const rectTop  = capDir > 0 ? gapEdge : gapEdge - DOOR_T;
        const rx = Math.round(Math.min(wallEdge, a.ex) + x0);
        const ry = Math.round(rectTop + y0);
        const rw = Math.round(Math.abs(a.ex - wallEdge));
        panel = `<rect x="${rx}" y="${ry}" width="${rw}" height="${DOOR_T}" fill="${DOOR_COLOR}"/>`;
      }
      return [
        panel,
        `<path d="M ${a.tx + x0},${a.ty + y0} A ${a.r},${a.r} 0 0 ${a.sweep} ${a.ex + x0},${a.ey + y0}" fill="none" stroke="${DOOR_COLOR}" stroke-width="1" stroke-dasharray="4,3"/>`,
      ].join('\n  ');
    }).join('\n  ');
  }

  const doorSyms = Object.values(allDoorArcs).map(doorSVG).filter(Boolean).join('\n  ');

  // --- Labels ---

  const labelSVG = title
    ? `<text x="${x0 + W / 2}" y="${y0 + H / 2}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="16" fill="#777">${title}</text>`
    : '';

  const dimW = `<text x="${x0 + W / 2}" y="${y3 + 22}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#999">${width} m</text>`;
  const dimH = `<text x="${x0 - 10}" y="${y0 + H / 2}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="11" fill="#999" transform="rotate(-90 ${x0 - 10} ${y0 + H / 2})">${depth} m</text>`;

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${totalW} ${totalH}">`,
    `  <rect width="${totalW}" height="${totalH}" fill="#F5F5F5"/>`,
    `  <rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="${ROOM_FILL}"/>`,
    wallSegs   ? `  ${wallSegs}`   : '',
    windowSyms ? `  ${windowSyms}` : '',
    doorSyms   ? `  ${doorSyms}`   : '',
    labelSVG   ? `  ${labelSVG}`   : '',
    `  ${dimW}`,
    `  ${dimH}`,
    `</svg>`,
  ].filter(Boolean).join('\n');
}

module.exports = { render };
