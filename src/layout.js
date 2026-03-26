'use strict';

const ELK = require('elkjs/lib/elk.bundled.js');
const { getComponentDef, getComponentWidth, getComponentHeight } = require('./components');

const elk = new ELK();

/**
 * The side of a conduit shape that wires exit from, given its casing wall.
 * Returns null for back wall or unknown (use default left/right logic).
 */
function wallExitSide(wall) {
  switch (wall) {
    case 'top':    return 'bottom';
    case 'bottom': return 'top';
    case 'left':   return 'right';
    case 'right':  return 'left';
    default:       return null;
  }
}

/** Absolute port coordinate on the given side of a w×h rectangle. */
function sideCoord(side, n, step, w, h) {
  switch (side) {
    case 'left':   return { x: 0, y: Math.round(step * n) };
    case 'right':  return { x: w, y: Math.round(step * n) };
    case 'top':    return { x: Math.round(step * n), y: 0 };
    case 'bottom': return { x: Math.round(step * n), y: h };
    default:       return { x: w / 2, y: h / 2 };
  }
}

/**
 * Assign synthetic spread ports to nodes that receive/send multiple portless wires,
 * so ELK has distinct anchor points and won't stack all wires on one spot.
 *
 * Wall-aware conduits: all portless connections (in + out) go to the wall-exit side.
 * Regular components: incoming → left edge, outgoing → right edge.
 * Single portless connection on a wall-aware conduit: still gets a centred port on
 * the correct side (so ELK doesn't pick an arbitrary boundary point).
 */
function assignAutoPorts(components, wires, casing) {
  const compById       = Object.fromEntries(components.map(c => [c.id, c]));
  const casingConduits = casing?.conduits || {};

  const resolvedWires = wires.map(w => ({
    ...w, from: { ...w.from }, to: { ...w.to },
  }));

  // Which side should portless connections on this node use?
  function portSide(nodeId, isIncoming) {
    const exitSide = wallExitSide(casingConduits[nodeId]?.wall);
    return exitSide ?? (isIncoming ? 'left' : 'right');
  }

  // Group portless endpoints by (nodeId, side)
  const groups = {}; // key `${nodeId}:${side}` → { nodeId, side, items }

  for (let i = 0; i < resolvedWires.length; i++) {
    const { from, to } = resolvedWires[i];

    if (!to.port) {
      const side = portSide(to.id, true);
      const key  = `${to.id}:${side}`;
      if (!groups[key]) groups[key] = { nodeId: to.id, side, items: [] };
      groups[key].items.push({ wi: i, endpoint: 'to' });
    }
    if (!from.port) {
      const side = portSide(from.id, false);
      const key  = `${from.id}:${side}`;
      if (!groups[key]) groups[key] = { nodeId: from.id, side, items: [] };
      groups[key].items.push({ wi: i, endpoint: 'from' });
    }
  }

  const extraPorts = {};

  for (const { nodeId, side, items } of Object.values(groups)) {
    const isWallAware = wallExitSide(casingConduits[nodeId]?.wall) !== null;

    // Regular components with a single portless connection: let ELK pick boundary
    if (items.length <= 1 && !isWallAware) continue;

    const comp = compById[nodeId];
    if (!comp) continue;

    const w       = getComponentWidth(comp);
    const h       = getComponentHeight(comp);
    const isHoriz = side === 'top' || side === 'bottom';
    const step    = (isHoriz ? w : h) / (items.length + 1);

    extraPorts[nodeId] = extraPorts[nodeId] || [];

    items.forEach(({ wi, endpoint }, idx) => {
      const portName     = `__auto_${side}_${idx}`;
      const { x, y }     = sideCoord(side, idx + 1, step, w, h);
      extraPorts[nodeId].push({ id: `${nodeId}.${portName}`, x, y });

      if (endpoint === 'to') {
        resolvedWires[wi].to   = { id: nodeId, port: portName };
      } else {
        resolvedWires[wi].from = { id: nodeId, port: portName };
      }
    });
  }

  return { resolvedWires, extraPorts };
}

/**
 * Lay out the graph using elkjs.
 * Returns { positions: { [id]: { x, y, width, height } }, edges: [{ wire, sections }] }
 */
async function layout(graph) {
  const { components, wires, casing } = graph;
  if (components.length === 0) return { positions: {}, edges: [] };

  const { resolvedWires, extraPorts } = assignAutoPorts(components, wires, casing);

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '60',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.padding': '[top=50, left=50, bottom=50, right=50]',
      'elk.layered.unnecessaryBendpoints': 'true',
    },
    children: components.map(comp => {
      const def      = getComponentDef(comp.type);
      const w        = getComponentWidth(comp);
      const h        = getComponentHeight(comp);
      const portDefs = def.ports(comp.props);

      const namedPorts = Object.entries(portDefs)
        .filter(([name]) => name !== 'center')
        .map(([name, pos]) => ({
          id: `${comp.id}.${name}`, x: pos.x, y: pos.y, width: 1, height: 1,
        }));

      const autoPorts = (extraPorts[comp.id] || []).map(p => ({
        id: p.id, x: p.x, y: p.y, width: 1, height: 1,
      }));

      const ports = [...namedPorts, ...autoPorts];

      return {
        id: comp.id,
        width: w,
        height: h,
        ports,
        layoutOptions: ports.length > 0
          ? { 'elk.portConstraints': 'FIXED_POS' }
          : {},
      };
    }),
    edges: resolvedWires.map((wire, i) => ({
      id:      `e${i}`,
      sources: [wire.from.port ? `${wire.from.id}.${wire.from.port}` : wire.from.id],
      targets: [wire.to.port   ? `${wire.to.id}.${wire.to.port}`     : wire.to.id],
    })),
  };

  const result = await elk.layout(elkGraph);

  const positions = {};
  for (const node of result.children || []) {
    const comp = components.find(c => c.id === node.id);
    positions[node.id] = {
      x:      node.x,
      y:      node.y,
      width:  getComponentWidth(comp),
      height: getComponentHeight(comp),
    };
  }

  const edgeById = {};
  for (const edge of result.edges || []) edgeById[edge.id] = edge;

  const edges = wires.map((wire, i) => ({
    wire,
    sections: (edgeById[`e${i}`] || {}).sections || [],
  }));

  // Snap conduit positions to reflect their physical wall placement
  if (casing?.conduits) {
    snapConduitPositions(casing.conduits, positions, edges);
  }

  return { positions, edges };
}

/**
 * After ELK runs, override conduit y-positions to match their casing wall:
 *   top    → align with topmost component in the diagram
 *   bottom → align with bottommost component
 *   left/right/back → interpolate by position fraction between top and bottom
 *
 * Also patches the first/last bend-point of every edge touching a moved conduit
 * so that orthogonal wire paths stay valid after the shift.
 */
function snapConduitPositions(casingConduits, positions, edges) {
  const allYs = Object.values(positions).flatMap(p => [p.y, p.y + p.height]);
  const yMin  = Math.min(...allYs);
  const yMax  = Math.max(...allYs);

  const FRAC = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 };

  for (const [id, def] of Object.entries(casingConduits)) {
    const pos = positions[id];
    if (!pos) continue;

    const wall     = def.wall     || 'back';
    const position = def.position || 'center';

    let targetY;
    if (wall === 'top') {
      targetY = yMin;
    } else if (wall === 'bottom') {
      targetY = yMax - pos.height;
    } else {
      const f = FRAC[position] ?? 0.5;
      targetY = yMin + (yMax - yMin - pos.height) * f;
    }

    const dy = targetY - pos.y;
    if (Math.abs(dy) < 0.5) continue;

    pos.y = targetY;

    for (const { wire, sections } of edges) {
      if (!sections.length) continue;
      for (const section of sections) {
        if (wire.from.id === id) {
          section.startPoint.y += dy;
          if (section.bendPoints?.length) section.bendPoints[0].y += dy;
        }
        if (wire.to.id === id) {
          section.endPoint.y += dy;
          if (section.bendPoints?.length) {
            section.bendPoints[section.bendPoints.length - 1].y += dy;
          }
        }
      }
    }
  }
}

module.exports = { layout };
