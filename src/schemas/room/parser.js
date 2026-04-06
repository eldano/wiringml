'use strict';

const yaml = require('js-yaml');

const WALL_KEYS = ['north', 'south', 'east', 'west'];

function parse(source) {
  const doc = yaml.load(source);

  if (typeof doc.width  !== 'number') throw new Error('room: missing required field "width"');
  if (typeof doc.depth  !== 'number') throw new Error('room: missing required field "depth"');

  const rawWalls = doc.walls || {};
  const walls = {};

  for (const side of WALL_KEYS) {
    const raw = rawWalls[side];
    const openings = (raw && raw.openings) ? raw.openings.map(o => {
      if (!o.type)    throw new Error(`room: opening on ${side} wall missing "type"`);
      if (!o.position || !o.position.from || typeof o.position.offset !== 'number')
        throw new Error(`room: opening on ${side} wall missing "position" (needs "from" and "offset")`);
      if (typeof o.width !== 'number') throw new Error(`room: opening on ${side} wall missing "width"`);
      const swing = o.swing
        ? { pivot: o.swing.pivot, direction: o.swing.direction }
        : null;
      return { type: o.type, position: { from: o.position.from, offset: o.position.offset }, width: o.width, swing };
    }) : [];
    walls[side] = { openings };
  }

  return {
    title: doc.title || null,
    width: doc.width,
    depth: doc.depth,
    walls,
  };
}

module.exports = { parse };
