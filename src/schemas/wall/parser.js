'use strict';

const yaml = require('js-yaml');

function parse(source) {
  const doc = yaml.load(source);
  const { width, left_height, right_height } = doc.dims || {};
  if (!width || !left_height || !right_height) {
    throw new Error('wall schema requires dims.width, dims.left_height, dims.right_height');
  }

  const openings = (doc.openings || []).map(o => ({
    type:     o.type,
    width:    o.width,
    height:   o.height,
    position: o.position,
  }));

  const fixtures = (doc.fixtures || []).map(f => {
    const id = Object.keys(f).find(k => f[k] === null) || null;
    return { id, type: f.type, link: f.link || null, notes: f.notes || null, position: f.position };
  });

  const extras = (doc.extras || []).map(e => ({
    type:     e.type,
    width:    e.width,
    height:   e.height,
    position: e.position,
  }));

  return { width, left_height, right_height, openings, fixtures, extras };
}

module.exports = { parse };
