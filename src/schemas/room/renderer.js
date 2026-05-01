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

function render({ title, walls }, _layout) {
  const nWall = walls.north, sWall = walls.south;
  const eWall = walls.east,  wWall = walls.west;

  // Bounding box: width from any horizontal wall; depth = max of vertical wall lengths.
  const width = (nWall || sWall).length;
  const depth = Math.max(eWall ? eWall.length : 0, wWall ? wWall.length : 0) || width;

  const scale = (TARGET_W - MARGIN * 2) / width;
  const W  = width * scale;
  const H  = depth * scale;
  const T  = Math.round(WALL_T * scale);

  // Each vertical wall has its own height (may be less than H).
  const E_h  = eWall ? eWall.length * scale : 0;
  const Ww_h = wWall ? wWall.length * scale : 0;

  // Anchor: if north is present (or no south), the wall hangs from the top (y=0).
  // If north is absent but south is present, it anchors at the bottom (y=H).
  const eTopAnchored = !!(nWall || !sWall);
  const wTopAnchored = !!(nWall || !sWall);
  const eTopY = eTopAnchored ? 0 : H - E_h;
  const wTopY = wTopAnchored ? 0 : H - Ww_h;

  // Corner connectivity: a corner exists only where two adjacent walls meet.
  const hasNW = !!(nWall && wWall);
  const hasNE = !!(nWall && eWall);
  const hasSE = !!(eWall && sWall && Math.round(eTopY + E_h)  >= Math.round(H));
  const hasSW = !!(wWall && sWall && Math.round(wTopY + Ww_h) >= Math.round(H));

  // --- Resolve openings to pixel gaps in wall-relative space (wall start = 0) ---

  function resolveStart(o, wallLen) {
    const { from, offset } = o.position;
    return (from === 'left' || from === 'top')
      ? offset * scale
      : wallLen - (offset + o.width) * scale;
  }

  function wallGaps(wall, wallLen) {
    if (!wall) return [];
    return wall.openings.map(o => {
      const start = resolveStart(o, wallLen);
      return { ...o, start, end: start + o.width * scale };
    });
  }

  const northGaps = wallGaps(nWall, W);
  const southGaps = wallGaps(sWall, W);
  const eastGaps  = wallGaps(eWall, E_h);
  const westGaps  = wallGaps(wWall, Ww_h);

  // --- Compute door arc geometry in room-relative space (interior NW = 0,0) ---

  // wallOffset: room-relative y of the wall's start (for bottom-anchored V walls, > 0).
  function computeDoorArcs(gaps, side, wallOffset = 0) {
    const isH = side === 'north' || side === 'south';

    const faces = {
      north: { inner: 0,   outer: -T   },
      south: { inner: H,   outer: H+T  },
      east:  { inner: W,   outer: W+T  },
      west:  { inner: 0,   outer: -T   },
    }[side];

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
        const pivotLeft = (isCW === isInward) !== (side === 'south');
        px = pivotLeft ? g.start : g.end;   py = face;
        tx = pivotLeft ? g.end   : g.start; ty = face;
        ex = px; ey = face + arcDisp;
      } else {
        const pivotTop = (isCW === isInward) !== (side === 'west');
        py = (pivotTop ? g.start : g.end)   + wallOffset; px = face;
        ty = (pivotTop ? g.end   : g.start) + wallOffset; tx = face;
        ey = py; ex = face + arcDisp;
      }

      return { px, py, tx, ty, ex, ey, r, sweep, isH };
    });
  }

  const allDoorArcs = {
    north: computeDoorArcs(northGaps, 'north'),
    south: computeDoorArcs(southGaps, 'south'),
    east:  computeDoorArcs(eastGaps,  'east',  eTopY),
    west:  computeDoorArcs(westGaps,  'west',  wTopY),
  };
  const flatArcs = Object.values(allDoorArcs).flat();

  // --- Extra padding: outer faces of present walls + any outward door arcs ---

  const minX = flatArcs.reduce((m, a) => Math.min(m, a.px, a.tx, a.ex), wWall ? -T : 0);
  const maxX = flatArcs.reduce((m, a) => Math.max(m, a.px, a.tx, a.ex), eWall ? W+T : W);
  const minY = flatArcs.reduce((m, a) => Math.min(m, a.py, a.ty, a.ey), nWall ? -T : 0);
  const maxY = flatArcs.reduce((m, a) => Math.max(m, a.py, a.ty, a.ey), sWall ? H+T : Math.max(E_h, Ww_h));

  const padLeft   = Math.ceil(Math.max(0, -minX));
  const padRight  = Math.ceil(Math.max(0, maxX - W));
  const padTop    = Math.ceil(Math.max(0, -minY));
  const padBottom = Math.ceil(Math.max(0, maxY - H));

  const x0 = MARGIN + padLeft;
  const y0 = MARGIN + padTop;
  const x1 = x0 + W;
  const y3 = y0 + H;

  const COMPASS_PAD = 60;  // extra space reserved for the compass rose
  const totalW = Math.ceil(W + padLeft + padRight + MARGIN * 2 + COMPASS_PAD);
  const totalH = Math.ceil(H + padTop  + padBottom + MARGIN * 2);

  const strokeAttr = `stroke="${WALL_COLOR}" stroke-width="1" stroke-linecap="butt"`;

  // --- Room interior fill (bounding box) ---
  const roomFillSVG = `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="${ROOM_FILL}"/>`;

  // --- Corner fills: T×T squares only where two walls meet ---
  const cornerFills = [
    hasNW ? `<rect x="${x0-T}" y="${y0-T}" width="${T}" height="${T}" fill="${WALL_FILL}"/>` : '',
    hasNE ? `<rect x="${x1}"   y="${y0-T}" width="${T}" height="${T}" fill="${WALL_FILL}"/>` : '',
    hasSE ? `<rect x="${x1}"   y="${y3}"   width="${T}" height="${T}" fill="${WALL_FILL}"/>` : '',
    hasSW ? `<rect x="${x0-T}" y="${y3}"   width="${T}" height="${T}" fill="${WALL_FILL}"/>` : '',
  ].filter(Boolean).join('\n  ');

  // --- Wall segment fills ---
  function hWallFill(yTop, gaps, fromX, wallW) {
    return subtractGaps(wallW, gaps).map(([a, b]) =>
      `<rect x="${fromX+a}" y="${yTop}" width="${b-a}" height="${T}" fill="${WALL_FILL}"/>`
    ).join('\n  ');
  }
  function vWallFill(xLeft, gaps, fromY, wallH) {
    return subtractGaps(wallH, gaps).map(([a, b]) =>
      `<rect x="${xLeft}" y="${fromY+a}" width="${T}" height="${b-a}" fill="${WALL_FILL}"/>`
    ).join('\n  ');
  }

  const wallFills = [
    nWall ? hWallFill(y0-T, northGaps, x0, W)              : '',
    sWall ? hWallFill(y3,   southGaps, x0, W)              : '',
    eWall ? vWallFill(x1,   eastGaps,  y0 + eTopY, E_h)   : '',
    wWall ? vWallFill(x0-T, westGaps,  y0 + wTopY, Ww_h)  : '',
  ].filter(Boolean).join('\n  ');

  // --- Wall face lines ---
  // hasLeft/hasRight (or hasTop/hasBottom): if true, extend into the corner;
  // if false, draw a perpendicular termination cap across the wall thickness.

  function hWallLines(yOuter, yInner, gaps, fromX, wallW, hasLeft, hasRight) {
    const segs = [];
    const leftExt  = hasLeft  ? [[-T, 0]]           : [];
    const rightExt = hasRight ? [[wallW, wallW + T]] : [];
    for (const [a, b] of [...leftExt, ...subtractGaps(wallW, gaps), ...rightExt]) {
      segs.push(`<line x1="${fromX+a}" y1="${yOuter}" x2="${fromX+b}" y2="${yOuter}" ${strokeAttr}/>`);
    }
    if (!hasLeft)  segs.push(`<line x1="${fromX}"       y1="${yOuter}" x2="${fromX}"       y2="${yInner}" ${strokeAttr}/>`);
    if (!hasRight) segs.push(`<line x1="${fromX+wallW}" y1="${yOuter}" x2="${fromX+wallW}" y2="${yInner}" ${strokeAttr}/>`);
    for (const [a, b] of subtractGaps(wallW, gaps)) {
      segs.push(`<line x1="${fromX+a}" y1="${yInner}" x2="${fromX+b}" y2="${yInner}" ${strokeAttr}/>`);
    }
    for (const g of gaps) {
      segs.push(`<line x1="${fromX+g.start}" y1="${yOuter}" x2="${fromX+g.start}" y2="${yInner}" ${strokeAttr}/>`);
      segs.push(`<line x1="${fromX+g.end}"   y1="${yOuter}" x2="${fromX+g.end}"   y2="${yInner}" ${strokeAttr}/>`);
    }
    return segs.join('\n  ');
  }

  function vWallLines(xOuter, xInner, gaps, fromY, wallH, hasTop, hasBottom) {
    const segs = [];
    const topExt    = hasTop    ? [[-T, 0]]           : [];
    const bottomExt = hasBottom ? [[wallH, wallH + T]] : [];
    for (const [a, b] of [...topExt, ...subtractGaps(wallH, gaps), ...bottomExt]) {
      segs.push(`<line x1="${xOuter}" y1="${fromY+a}" x2="${xOuter}" y2="${fromY+b}" ${strokeAttr}/>`);
    }
    if (!hasTop)    segs.push(`<line x1="${xOuter}" y1="${fromY}"       x2="${xInner}" y2="${fromY}"       ${strokeAttr}/>`);
    if (!hasBottom) segs.push(`<line x1="${xOuter}" y1="${fromY+wallH}" x2="${xInner}" y2="${fromY+wallH}" ${strokeAttr}/>`);
    for (const [a, b] of subtractGaps(wallH, gaps)) {
      segs.push(`<line x1="${xInner}" y1="${fromY+a}" x2="${xInner}" y2="${fromY+b}" ${strokeAttr}/>`);
    }
    for (const g of gaps) {
      segs.push(`<line x1="${xOuter}" y1="${fromY+g.start}" x2="${xInner}" y2="${fromY+g.start}" ${strokeAttr}/>`);
      segs.push(`<line x1="${xOuter}" y1="${fromY+g.end}"   x2="${xInner}" y2="${fromY+g.end}"   ${strokeAttr}/>`);
    }
    return segs.join('\n  ');
  }

  const wallLines = [
    nWall ? hWallLines(y0-T, y0, northGaps, x0, W,    hasNW, hasNE)             : '',
    sWall ? hWallLines(y3+T, y3, southGaps, x0, W,    hasSW, hasSE)             : '',
    eWall ? vWallLines(x1+T, x1, eastGaps,  y0 + eTopY, E_h,  hasNE, hasSE)    : '',
    wWall ? vWallLines(x0-T, x0, westGaps,  y0 + wTopY, Ww_h, hasNW, hasSW)    : '',
  ].filter(Boolean).join('\n  ');

  // --- Window symbols ---

  function windowSymbols(gaps, side) {
    const isH = side === 'north' || side === 'south';
    const { outer, inner, from } = {
      north: { outer: y0-T, inner: y0,   from: x0          },
      south: { outer: y3+T, inner: y3,   from: x0          },
      east:  { outer: x1+T, inner: x1,   from: y0 + eTopY  },
      west:  { outer: x0-T, inner: x0,   from: y0 + wTopY  },
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

  // --- Compass rose ---
  function compassRose(cx, cy) {
    const R   = 16;  // circle radius
    const ext = 5;   // how far lines extend beyond the circle
    const lbl = 8;   // label offset from line end
    const textAttr = `font-family="sans-serif" font-size="10" font-weight="bold" fill="#555"`;
    return [
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#999" stroke-width="1"/>`,
      // N–S line
      `<line x1="${cx}" y1="${cy - R - ext}" x2="${cx}" y2="${cy + R + ext}" stroke="#999" stroke-width="1"/>`,
      // E–W line
      `<line x1="${cx - R - ext}" y1="${cy}" x2="${cx + R + ext}" y2="${cy}" stroke="#999" stroke-width="1"/>`,
      // Cardinal labels
      `<text x="${cx}"        y="${cy - R - ext - lbl + 4}" text-anchor="middle"  ${textAttr}>N</text>`,
      `<text x="${cx}"        y="${cy + R + ext + lbl}"     text-anchor="middle"  ${textAttr}>S</text>`,
      `<text x="${cx + R + ext + lbl}" y="${cy + 4}"        text-anchor="start"   ${textAttr}>E</text>`,
      `<text x="${cx - R - ext - lbl}" y="${cy + 4}"        text-anchor="end"     ${textAttr}>W</text>`,
    ].join('\n  ');
  }

  const compassSVG = compassRose(totalW - COMPASS_PAD / 2 - 10, MARGIN);

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
    cornerFills ? `  ${cornerFills}` : '',
    wallFills   ? `  ${wallFills}`   : '',
    `  ${wallLines}`,
    windowSyms  ? `  ${windowSyms}`  : '',
    doorSyms    ? `  ${doorSyms}`    : '',
    labelSVG    ? `  ${labelSVG}`    : '',
    `  ${dimW}`,
    `  ${dimH}`,
    `  ${compassSVG}`,
    `</svg>`,
  ].filter(Boolean).join('\n');
}

module.exports = { render };
