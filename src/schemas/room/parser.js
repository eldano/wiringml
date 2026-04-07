'use strict';

const yaml = require('js-yaml');

const WALL_KEYS = ['north', 'south', 'east', 'west'];

function parse(source) {
  const doc = yaml.load(source);

  const rawWalls = doc.walls || {};
  const walls = {};

  for (const side of WALL_KEYS) {
    const raw = rawWalls[side];
    if (!raw) { walls[side] = null; continue; }
    if (typeof raw.length !== 'number')
      throw new Error(`room: wall "${side}" missing required field "length"`);
    const openings = raw.openings ? raw.openings.map(o => {
      if (!o.type)    throw new Error(`room: opening on ${side} wall missing "type"`);
      if (!o.position || !o.position.from || typeof o.position.offset !== 'number')
        throw new Error(`room: opening on ${side} wall missing "position" (needs "from" and "offset")`);
      if (typeof o.width !== 'number') throw new Error(`room: opening on ${side} wall missing "width"`);
      const swing = o.swing
        ? { direction: o.swing.direction, opens: o.swing.opens }
        : null;
      return { type: o.type, position: { from: o.position.from, offset: o.position.offset }, width: o.width, swing };
    }) : [];
    walls[side] = { length: raw.length, openings };
  }

  return {
    title: doc.title || null,
    walls,
  };
}

module.exports = { parse };
