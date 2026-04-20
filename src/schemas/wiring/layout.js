'use strict';

const { getComponentDef, getComponentWidth, getComponentHeight } = require('./components');

const MIN_STUB  = 10; // minimum straight distance before a wire may turn
const STUB_STEP = 10; // extra offset per wire in a shared-port group

function reverseDir(dir) {
  return { up: 'down', down: 'up', left: 'right', right: 'left' }[dir];
}

/**
 * Determine the exit direction of a port based on where it sits on the component boundary.
 * Returns 'up' | 'down' | 'left' | 'right' | null (center/flexible).
 */
function portExitDir(portX, portY, compW, compH) {
  if (portY === 0)     return 'up';
  if (portY === compH) return 'down';
  if (portX === 0)     return 'left';
  if (portX === compW) return 'right';
  return null;
}

/** Move a point `len` pixels in the given direction. */
function applyStub(p, dir, len) {
  switch (dir) {
    case 'up':    return { x: p.x, y: p.y - len };
    case 'down':  return { x: p.x, y: p.y + len };
    case 'left':  return { x: p.x - len, y: p.y };
    case 'right': return { x: p.x + len, y: p.y };
    default:      return { ...p };
  }
}

/**
 * Returns true if going directly from sp to tp would require the wire to
 * reverse its current direction (180° turn), which is not allowed.
 */
function wouldReverse(sp, tp, dir) {
  if (dir === 'up'    && tp.y > sp.y) return true;
  if (dir === 'down'  && tp.y < sp.y) return true;
  if (dir === 'left'  && tp.x > sp.x) return true;
  if (dir === 'right' && tp.x < sp.x) return true;
  return false;
}

/**
 * When a direct connection would require a U-turn, route the wire around
 * the obstacle by detouring to one side first.
 */
function sideDetour(sp, tp, dir) {
  const DETOUR = 40;
  const { x: sx, y: sy } = sp;
  const { x: tx, y: ty } = tp;
  if (dir === 'up' || dir === 'down') {
    const sideX = Math.max(sx, tx) + DETOUR;
    return [{ x: sideX, y: sy }, { x: sideX, y: ty }];
  } else {
    const sideY = Math.max(sy, ty) + DETOUR;
    return [{ x: sx, y: sideY }, { x: tx, y: sideY }];
  }
}

/**
 * Connect two intermediate points (sp → tp) with orthogonal bend points.
 * fromDir: the direction the wire is traveling when it leaves sp.
 * toDir:   the direction the wire must be traveling when it arrives at tp
 *          (= reverseDir of the target port's exit direction).
 */
function connectPoints(sp, tp, fromDir, toDir) {
  const { x: sx, y: sy } = sp;
  const { x: tx, y: ty } = tp;

  if (sx === tx && sy === ty) return [];

  // Same direction (or unconstrained)
  if (!fromDir || !toDir || fromDir === toDir) {
    if (sx === tx || sy === ty) {
      // Axis-aligned: a direct segment is possible only if it doesn't reverse
      if (fromDir && wouldReverse(sp, tp, fromDir)) return sideDetour(sp, tp, fromDir);
      return [];
    }
    // L-shape: one bend
    if (fromDir === 'up' || fromDir === 'down') return [{ x: tx, y: sy }];
    if (fromDir === 'left' || fromDir === 'right') return [{ x: sx, y: ty }];
    return [{ x: tx, y: sy }]; // no direction info: horizontal first
  }

  // Opposite directions: the stubs face away from each other.
  // Bridge via an extra segment further in fromDir, then cross, then back.
  // This never reverses: wire continues in fromDir, turns 90°, turns 90° again.
  if (fromDir === reverseDir(toDir)) {
    if (fromDir === 'down' || fromDir === 'up') {
      const midY = fromDir === 'down'
        ? Math.max(sy, ty) + 30
        : Math.min(sy, ty) - 30;
      return [{ x: sx, y: midY }, { x: tx, y: midY }];
    } else {
      const midX = fromDir === 'right'
        ? Math.max(sx, tx) + 30
        : Math.min(sx, tx) - 30;
      return [{ x: midX, y: sy }, { x: midX, y: ty }];
    }
  }

  // Perpendicular: pick the L-shape that doesn't reverse fromDir AND arrives at tp in toDir.
  // If no single L works, use a Z-shape (2 bends) that routes past tp to approach correctly.
  {
    const DETOUR = 40;

    // Direction the wire travels from point a to point b.
    const segDir = (a, b) => {
      if (b.x > a.x) return 'right';
      if (b.x < a.x) return 'left';
      if (b.y < a.y) return 'up';
      return 'down';
    };

    // Two candidate L-shapes
    const isVert = fromDir === 'up' || fromDir === 'down';
    const bend1  = isVert ? { x: sx, y: ty } : { x: tx, y: sy }; // fromDir-axis first
    const bend2  = isVert ? { x: tx, y: sy } : { x: sx, y: ty }; // other axis first

    const lOk = (bend) => {
      if (wouldReverse(sp, bend, fromDir)) return false;
      if (!toDir) return true;
      if (bend.x === tp.x && bend.y === tp.y) return true; // degenerate: bend is already tp
      return segDir(bend, tp) === toDir;
    };

    if (lOk(bend1)) return [bend1];
    if (lOk(bend2)) return [bend2];

    // Neither L works — route past tp so the final approach is in toDir
    if (!toDir) return [bend1]; // no arrival constraint: best-effort
    if (toDir === 'left')  return [{ x: tx + DETOUR, y: sy }, { x: tx + DETOUR, y: ty }];
    if (toDir === 'right') return [{ x: tx - DETOUR, y: sy }, { x: tx - DETOUR, y: ty }];
    if (toDir === 'up')    return [{ x: sx, y: ty - DETOUR }, { x: tx, y: ty - DETOUR }];
    /* toDir === 'down' */  return [{ x: sx, y: ty + DETOUR }, { x: tx, y: ty + DETOUR }];
  }
}

/**
 * Returns true when the straight line from src to tgt already satisfies both
 * exit directions — i.e. no turn is required and stubs can be skipped.
 */
function canGoDirect(src, srcDir, tgt, tgtDir) {
  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  if (dx !== 0 && dy !== 0) return false; // not axis-aligned, always needs a bend

  if (srcDir) {
    if (srcDir === 'up'    && dy >= 0) return false;
    if (srcDir === 'down'  && dy <= 0) return false;
    if (srcDir === 'left'  && dx >= 0) return false;
    if (srcDir === 'right' && dx <= 0) return false;
  }
  if (tgtDir) {
    const arr = reverseDir(tgtDir); // direction wire must be travelling when it arrives
    if (arr === 'up'    && dy >= 0) return false;
    if (arr === 'down'  && dy <= 0) return false;
    if (arr === 'left'  && dx >= 0) return false;
    if (arr === 'right' && dx <= 0) return false;
  }
  return true;
}

/**
 * Returns true if axis-aligned segment p1→p2 passes through the interior of rect.
 * Touching the boundary is not counted as an intersection.
 */
function segmentIntersectsRect(p1, p2, rect) {
  const sx1 = Math.min(p1.x, p2.x), sx2 = Math.max(p1.x, p2.x);
  const sy1 = Math.min(p1.y, p2.y), sy2 = Math.max(p1.y, p2.y);
  return sx1 < rect.x + rect.width  && sx2 > rect.x &&
         sy1 < rect.y + rect.height && sy2 > rect.y;
}

const CLEARANCE    = 20; // minimum gap a wire must keep from any component it doesn't connect to
const WIRE_TOL     = 1;  // pixel tolerance for treating two segments as coincident

/**
 * Returns true if two axis-aligned segments lie on top of each other
 * (same axis, within WIRE_TOL, overlapping ranges).
 */
function segmentsOverlap(p1, p2, q1, q2) {
  const horiz1 = p1.y === p2.y;
  const horiz2 = q1.y === q2.y;
  if (horiz1 !== horiz2) return false; // perpendicular — they cross, not overlap

  if (horiz1) {
    if (Math.abs(p1.y - q1.y) > WIRE_TOL) return false;
    const px1 = Math.min(p1.x, p2.x), px2 = Math.max(p1.x, p2.x);
    const qx1 = Math.min(q1.x, q2.x), qx2 = Math.max(q1.x, q2.x);
    return px1 < qx2 && px2 > qx1;
  } else {
    if (Math.abs(p1.x - q1.x) > WIRE_TOL) return false;
    const py1 = Math.min(p1.y, p2.y), py2 = Math.max(p1.y, p2.y);
    const qy1 = Math.min(q1.y, q2.y), qy2 = Math.max(q1.y, q2.y);
    return py1 < qy2 && py2 > qy1;
  }
}

/**
 * Returns true when no segment in pts[] either clips a component or overlaps
 * an already-routed wire segment.
 */
function pathClear(pts, positions, excludeIds, routedSegments) {
  const skip = new Set(excludeIds);

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];

    // Component clearance check
    if (positions) {
      for (const [id, rect] of Object.entries(positions)) {
        if (skip.has(id)) continue;
        const padded = {
          x: rect.x - CLEARANCE, y: rect.y - CLEARANCE,
          width: rect.width + CLEARANCE * 2, height: rect.height + CLEARANCE * 2,
        };
        if (segmentIntersectsRect(a, b, padded)) return false;
      }
    }

    // Wire-on-wire overlap check
    if (routedSegments) {
      for (const [q1, q2] of routedSegments) {
        if (segmentsOverlap(a, b, q1, q2)) return false;
      }
    }
  }

  return true;
}

/** Build the deduplicated point list and section object for a given stub config. */
function buildSection(src, srcDir, sLen, tgt, tgtDir, tLen) {
  const sp = srcDir ? applyStub(src, srcDir, sLen) : src;
  const tp = tgtDir ? applyStub(tgt, tgtDir, tLen) : tgt;
  const arrivalDir = tgtDir ? reverseDir(tgtDir) : null;
  const mid = connectPoints(sp, tp, srcDir, arrivalDir);

  const pts = [src];
  if (srcDir && (sp.x !== src.x || sp.y !== src.y)) pts.push(sp);
  pts.push(...mid);
  if (tgtDir && (tp.x !== tgt.x || tp.y !== tgt.y)) pts.push(tp);
  pts.push(tgt);

  const deduped = pts.filter((p, i) =>
    i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y
  );
  const start = deduped[0];
  const end   = deduped[deduped.length - 1];
  return {
    startPoint: start,
    bendPoints: deduped.slice(1, -1),
    endPoint:   end,
    _pts:       deduped, // kept for the clearance check; stripped before returning
  };
}

const MAX_STUB_TRIES = 24;

/**
 * The "late" stub length: extend the source stub until it is aligned with tp
 * (the stub-adjusted target point), so sp and tp share an axis and need only
 * one segment to connect. Falls back to minLen if tp is in the wrong direction.
 */
function lateStubLen(src, srcDir, tgt, tgtDir, tLen, minLen) {
  const base = minLen ?? MIN_STUB;
  const tp   = tgtDir ? applyStub(tgt, tgtDir, tLen) : tgt;
  switch (srcDir) {
    case 'right': return Math.max(base, tp.x - src.x);
    case 'left':  return Math.max(base, src.x - tp.x);
    case 'down':  return Math.max(base, tp.y - src.y);
    case 'up':    return Math.max(base, src.y - tp.y);
    default:      return base;
  }
}

/**
 * Returns true if two axis-aligned segments (one horizontal, one vertical)
 * strictly cross each other (T-intersections and endpoint touches excluded).
 */
function segmentsCross(p1, p2, q1, q2) {
  const h1 = p1.y === p2.y;
  const h2 = q1.y === q2.y;
  if (h1 === h2) return false; // parallel — overlap handled elsewhere

  const [h, v] = h1 ? [[p1, p2], [q1, q2]] : [[q1, q2], [p1, p2]];
  const hMinX = Math.min(h[0].x, h[1].x), hMaxX = Math.max(h[0].x, h[1].x);
  const vMinY = Math.min(v[0].y, v[1].y), vMaxY = Math.max(v[0].y, v[1].y);
  return v[0].x > hMinX && v[0].x < hMaxX && h[0].y > vMinY && h[0].y < vMaxY;
}

/** Count how many segments in pts[] cross segments already in routedSegments. */
function countCrossings(pts, routedSegments) {
  let count = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    for (const [q1, q2] of routedSegments) {
      if (segmentsCross(pts[i], pts[i + 1], q1, q2)) count++;
    }
  }
  return count;
}

/**
 * Route a single wire between two absolute port positions.
 * Tries both an early-turn path (small stub, grow until clear) and a late-turn
 * path (stub aligned with target, grow until clear), then picks whichever
 * crosses fewer already-routed wires. Falls back to the early path on a tie.
 * Returns one ELK-compatible section: { startPoint, bendPoints, endPoint }.
 */
function routeWire(src, srcDir, tgt, tgtDir, srcStubLen, tgtStubLen, positions, excludeIds, routedSegments) {
  // Direct axis-aligned path — use it if it doesn't cross anything.
  if (canGoDirect(src, srcDir, tgt, tgtDir)) {
    if (pathClear([src, tgt], positions, excludeIds, routedSegments)) {
      return { startPoint: src, bendPoints: [], endPoint: tgt };
    }
  }

  const tLen = tgtStubLen ?? MIN_STUB;

  // Early-turn candidate: start with the minimum stub and grow until clear.
  let sLenEarly    = srcStubLen ?? MIN_STUB;
  let lastEarly;
  let earlyCleared = false;
  for (let attempt = 0; attempt < MAX_STUB_TRIES; attempt++) {
    const section = buildSection(src, srcDir, sLenEarly, tgt, tgtDir, tLen);
    lastEarly = section;
    if (pathClear(section._pts, positions, excludeIds, routedSegments)) { earlyCleared = true; break; }
    sLenEarly += STUB_STEP;
  }

  // Late-turn candidate: start with the stub aligned to tp (stub-adjusted target) and grow until clear.
  let sLenLate    = lateStubLen(src, srcDir, tgt, tgtDir, tLen, srcStubLen);
  let lastLate;
  let lateCleared = false;
  for (let attempt = 0; attempt < MAX_STUB_TRIES; attempt++) {
    const section = buildSection(src, srcDir, sLenLate, tgt, tgtDir, tLen);
    lastLate = section;
    if (pathClear(section._pts, positions, excludeIds, routedSegments)) { lateCleared = true; break; }
    sLenLate += STUB_STEP;
  }

  // A cleared candidate always beats an uncleared one.
  // Between two cleared candidates, pick the one with fewer crossings (early wins ties).
  const crossEarly = countCrossings(lastEarly._pts, routedSegments);
  const crossLate  = countCrossings(lastLate._pts,  routedSegments);
  const useLate    = lateCleared && (!earlyCleared || crossLate < crossEarly);
  const best       = useLate ? lastLate : lastEarly;

  const { _pts: _, ...result } = best;
  return result;
}

/**
 * Resolve the absolute (x, y) of a named port on a placed component,
 * and the exit direction implied by its position on the component boundary.
 */
function resolvePort(comp, portName, placed) {
  const def      = getComponentDef(comp.type);
  const portDefs = def.ports(comp.props);
  const port     = portName ? portDefs[portName] : null;
  const w = placed.width;
  const h = placed.height;

  if (port) {
    return {
      pos: { x: placed.x + port.x, y: placed.y + port.y },
      dir: portExitDir(port.x, port.y, w, h),
    };
  }

  // No port specified → component center, no forced exit direction
  return {
    pos: { x: placed.x + w / 2, y: placed.y + h / 2 },
    dir: null,
  };
}

/**
 * For each (component, port) pair that is shared by more than one wire endpoint,
 * compute evenly-spaced positions along the component edge and return a per-wire
 * override map: wireIndex -> { from?: {pos,dir}, to?: {pos,dir} }
 */
function buildSpreadMap(components, wires, positions) {
  const compById = Object.fromEntries(components.map(c => [c.id, c]));

  // Group wire endpoints by the port they connect to
  const groups = {}; // key `compId:portName` -> { compId, portName, items[] }
  wires.forEach((wire, i) => {
    for (const endpoint of ['from', 'to']) {
      const ep  = wire[endpoint];
      const key = `${ep.id}:${ep.port ?? ''}`;
      if (!groups[key]) groups[key] = { compId: ep.id, portName: ep.port, items: [] };
      groups[key].items.push({ wireIdx: i, endpoint });
    }
  });

  const overrides = {}; // wireIdx -> { from?: {pos,dir}, to?: {pos,dir} }

  for (const { compId, portName, items } of Object.values(groups)) {
    if (items.length < 2) continue; // single wire — no spread needed

    const comp   = compById[compId];
    const placed = positions[compId];
    if (!comp || !placed) continue;

    // Resolve the base port to get the edge direction and optional spreadZone
    const { dir } = resolvePort(comp, portName, placed);
    if (!dir) continue; // center/flexible — can't determine an edge to spread along

    const def        = getComponentDef(comp.type);
    const portDef    = portName ? def.ports(comp.props)[portName] : null;
    const spreadZone = portDef?.spreadZone; // { start, end } in component-local coords

    const n    = items.length;
    const w    = placed.width;
    const h    = placed.height;
    const isHz = dir === 'up' || dir === 'down';

    // Centre the group of wires around the base port coordinate, 10px apart.
    // If a spreadZone is defined, clamp each position to stay within it.
    const WIRE_GAP   = 10;
    const baseCoord  = portDef ? (isHz ? portDef.x : portDef.y) : (isHz ? w / 2 : h / 2);
    const groupStart = baseCoord - ((n - 1) * WIRE_GAP) / 2;
    const zoneMin    = spreadZone ? spreadZone.start : 0;
    const zoneMax    = spreadZone ? spreadZone.end   : (isHz ? w : h);

    items.forEach(({ wireIdx, endpoint }, idx) => {
      const offset = Math.round(Math.max(zoneMin, Math.min(zoneMax, groupStart + idx * WIRE_GAP)));
      const pos = isHz
        ? { x: placed.x + offset, y: placed.y + (dir === 'down' ? h : 0) }
        : { x: placed.x + (dir === 'right' ? w : 0), y: placed.y + offset };

      if (!overrides[wireIdx]) overrides[wireIdx] = {};
      overrides[wireIdx][endpoint] = { pos, dir, stubLen: MIN_STUB + idx * STUB_STEP };
    });
  }

  return overrides;
}

/**
 * Lay out the graph using fixed positions declared on each component (props.x / props.y).
 * Returns { positions: { [id]: { x, y, width, height } }, edges: [{ wire, sections }] }
 */
async function layout(graph) {
  const { components, wires } = graph;
  if (components.length === 0) return { positions: {}, edges: [] };

  const positions = {};
  for (const comp of components) {
    positions[comp.id] = {
      x:      comp.props.x      ?? 0,
      y:      comp.props.y      ?? 0,
      width:  getComponentWidth(comp),
      height: getComponentHeight(comp),
    };
  }

  const compById       = Object.fromEntries(components.map(c => [c.id, c]));
  const spreadMap      = buildSpreadMap(components, wires, positions);
  const routedSegments = []; // accumulates segments of already-routed wires

  const edges = wires.map((wire, i) => {
    const fromComp = compById[wire.from.id];
    const toComp   = compById[wire.to.id];
    if (!fromComp || !toComp) return { wire, sections: [] };

    const spread = spreadMap[i] || {};

    const { pos: src, dir: srcDir, stubLen: srcStubLen } =
      spread.from ?? resolvePort(fromComp, wire.from.port, positions[wire.from.id]);
    const { pos: tgt, dir: tgtDir, stubLen: tgtStubLen } =
      spread.to ?? resolvePort(toComp, wire.to.port, positions[wire.to.id]);

    const section = routeWire(
      src, srcDir, tgt, tgtDir,
      srcStubLen, tgtStubLen,
      positions, [wire.from.id, wire.to.id],
      routedSegments,
    );

    // Register this wire's segments so subsequent wires can avoid them
    const pts = [section.startPoint, ...section.bendPoints, section.endPoint];
    for (let j = 0; j < pts.length - 1; j++) routedSegments.push([pts[j], pts[j + 1]]);

    return { wire, sections: [section] };
  });

  return { positions, edges };
}

module.exports = { layout };
