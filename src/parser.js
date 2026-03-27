'use strict';

const yaml = require('js-yaml');

/**
 * Parse a WiringML YAML source string into a graph.
 * Returns { components: [...], wires: [...] }
 *
 * Schema:
 *   components:
 *     <id>:
 *       type: <type>
 *       [prop]: value        # component-specific props (e.g. ports: 4)
 *
 *   wires:
 *     - color: <color>
 *       from: <id>[.<port>]
 *       to:   <id>[.<port>]
 */
function parse(source) {
  const doc = yaml.load(source);

  const components = Object.entries(doc.components || {}).map(([id, def]) => {
    const { type, ...props } = def;
    return { id, type, props };
  });

  const wires = (doc.wires || []).map(wire => ({
    color: wire.color,
    from:  parseEndpoint(String(wire.from)),
    to:    parseEndpoint(String(wire.to)),
  }));

  const overviews = doc.overviews || null;

  return { components, wires, overviews };
}

function parseEndpoint(str) {
  const dot = str.indexOf('.');
  if (dot === -1) return { id: str, port: null };
  return { id: str.slice(0, dot), port: str.slice(dot + 1) };
}

module.exports = { parse };
