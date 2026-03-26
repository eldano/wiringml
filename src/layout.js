'use strict';

const ELK = require('elkjs/lib/elk.bundled.js');
const { getComponentDef, getComponentWidth, getComponentHeight } = require('./components');

const elk = new ELK();

/**
 * Lay out the graph using elkjs.
 * Returns { positions: { [id]: { x, y, width, height } }, edges: [{ wire, sections }] }
 * where sections are ELK edge route sections with absolute coordinates.
 */
async function layout(graph) {
  const { components, wires } = graph;
  if (components.length === 0) return { positions: {}, edges: [] };

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
      const def   = getComponentDef(comp.type);
      const w     = getComponentWidth(comp);
      const h     = getComponentHeight(comp);
      const portDefs = def.ports(comp.props);

      // Expose all named ports to ELK except 'center' (interior — not a boundary port)
      const ports = Object.entries(portDefs)
        .filter(([name]) => name !== 'center')
        .map(([name, pos]) => ({
          id:     `${comp.id}.${name}`,
          x:      pos.x,
          y:      pos.y,
          width:  1,
          height: 1,
        }));

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
    edges: wires.map((wire, i) => ({
      id:      `e${i}`,
      sources: [wire.from.port ? `${wire.from.id}.${wire.from.port}` : wire.from.id],
      targets: [wire.to.port   ? `${wire.to.id}.${wire.to.port}`     : wire.to.id],
    })),
  };

  const result = await elk.layout(elkGraph);

  // Node positions (ELK returns absolute x/y)
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

  // Edge routes — map back to original wires by id
  const edgeById = {};
  for (const edge of result.edges || []) edgeById[edge.id] = edge;

  const edges = wires.map((wire, i) => ({
    wire,
    sections: (edgeById[`e${i}`] || {}).sections || [],
  }));

  return { positions, edges };
}

module.exports = { layout };
