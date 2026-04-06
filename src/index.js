'use strict';

const yaml = require('js-yaml');

const SCHEMAS = {
  wiring: require('./schemas/wiring/parser'),
  wall:   require('./schemas/wall/parser'),
  room:   require('./schemas/room/parser'),
};

const LAYOUTS = {
  wiring: require('./schemas/wiring/layout'),
  wall:   require('./schemas/wall/layout'),
  room:   require('./schemas/room/layout'),
};

const RENDERERS = {
  wiring: require('./schemas/wiring/renderer'),
  wall:   require('./schemas/wall/renderer'),
  room:   require('./schemas/room/renderer'),
};

/**
 * Parse, lay out, and render a YAML source string to SVG.
 * Dispatches to the correct pipeline based on the top-level `schema` field.
 */
async function process(source) {
  const doc    = yaml.load(source);
  const schema = doc.schema;

  if (!schema) throw new Error('Missing top-level "schema" field in YAML.');
  if (!SCHEMAS[schema]) throw new Error(`Unknown schema: "${schema}". Known schemas: ${Object.keys(SCHEMAS).join(', ')}`);

  const graph        = SCHEMAS[schema].parse(source);
  const layoutResult = await LAYOUTS[schema].layout(graph);
  const svg          = RENDERERS[schema].render(graph, layoutResult);
  return svg;
}

module.exports = { process };
