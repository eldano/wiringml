'use strict';

const WIRE_COLORS = {
  blue:   '#1565C0',
  white:  '#BDBDBD',
  green:  '#2E7D32',
  red:    '#C62828',
  black:  '#212121',
  yellow: '#F9A825',
  orange: '#E65100',
  brown:  '#4E342E',
  gray:   '#757575',
  grey:   '#757575',
};

// Each component definition has:
//   width  — number or function(props) → number
//   height — number or function(props) → number
//   ports(props) → { portName: { x, y } }  (coordinates relative to component top-left)
//   svg(x, y, props, id) → SVG string

const COMPONENTS = {

  conduit: {
    width: 60,
    height: 40,
    ports() {
      return {
        center: { x: 30, y: 20 },
        left:   { x: 0,  y: 20 },
        right:  { x: 60, y: 20 },
        top:    { x: 30, y: 0  },
        bottom: { x: 30, y: 40 },
      };
    },
    svg(x, y, _props, id) {
      return [
        `<g class="component conduit">`,
        `  <rect x="${x}" y="${y}" width="60" height="40" fill="#FF8C00" stroke="#444" stroke-width="1.5" rx="3"/>`,
        `  <text x="${x + 30}" y="${y + 25}" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#222">${id}</text>`,
        `</g>`,
      ].join('\n');
    },
  },

  terminal_block: {
    width(props) { return Math.max(80, (props.ports || 2) * 25); },
    height: 50,
    ports(props) {
      const n = props.ports || 2;
      const w = Math.max(80, n * 25);
      const step = w / (n + 1);
      const result = {};
      for (let i = 1; i <= n; i++) {
        result[`top_${i}`] = { x: Math.round(step * i), y: 0  };
        result[`bot_${i}`] = { x: Math.round(step * i), y: 50 };
      }
      // Named aliases for first and last
      result.top_left  = result['top_1'];
      result.top_right = result[`top_${n}`];
      result.bot_left  = result['bot_1'];
      result.bot_right = result[`bot_${n}`];
      result.center    = { x: Math.round(w / 2), y: 25 };
      return result;
    },
    svg(x, y, props, id) {
      const n = props.ports || 2;
      const w = Math.max(80, n * 25);
      const step = w / (n + 1);
      const pins = Array.from({ length: n }, (_, i) => {
        const px = x + step * (i + 1);
        return `  <rect x="${px - 4}" y="${y + 12}" width="8" height="26" fill="#888" stroke="#555" stroke-width="1" rx="1"/>`;
      }).join('\n');
      return [
        `<g class="component terminal_block">`,
        `  <rect x="${x}" y="${y}" width="${w}" height="50" fill="#ECEFF1" stroke="#444" stroke-width="1.5" rx="2"/>`,
        pins,
        `  <text x="${x + w / 2}" y="${y + 46}" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#444">${id}</text>`,
        `</g>`,
      ].join('\n');
    },
  },

  tipo_l: {
    // Rectangular plug face: 3:2 ratio (90×60).
    // 3 decorative pin holes on the horizontal centre axis (left=live, centre=ground, right=neutral).
    // Each pin has a connection point on both the top and bottom edge.
    // Ports: live.t/b, ground.t/b, neutral.t/b  (t=top, b=bottom — electrically equivalent pairs).
    width: 90,
    height: 60,
    ports() {
      return {
        'live.t':    { x: 22, y: 0  },
        'live.b':    { x: 22, y: 60 },
        'ground.t':  { x: 45, y: 0  },
        'ground.b':  { x: 45, y: 60 },
        'neutral.t': { x: 68, y: 0  },
        'neutral.b': { x: 68, y: 60 },
        center:      { x: 45, y: 30 },
      };
    },
    svg(x, y, _props, id) {
      const pinXs = [22, 45, 68];

      const holes = pinXs.map(ox =>
        `  <circle cx="${x + ox}" cy="${y + 30}" r="7" fill="#444" stroke="#222" stroke-width="1"/>`
      ).join('\n');

      // Small terminal markers on top and bottom edges
      const topPins = pinXs.map(ox =>
        `  <circle cx="${x + ox}" cy="${y}"      r="3" fill="#888" stroke="#555" stroke-width="1"/>`
      ).join('\n');
      const botPins = pinXs.map(ox =>
        `  <circle cx="${x + ox}" cy="${y + 60}" r="3" fill="#888" stroke="#555" stroke-width="1"/>`
      ).join('\n');

      return [
        `<g class="component tipo_l">`,
        `  <rect x="${x}" y="${y}" width="90" height="60" fill="#F0EDE8" stroke="#444" stroke-width="1.5" rx="3"/>`,
        holes,
        topPins,
        botPins,
        `  <text x="${x + 45}" y="${y + 74}" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#444">${id}</text>`,
        `</g>`,
      ].join('\n');
    },
  },

  enclosure: {
    width: 160,
    height: 110,
    ports() {
      return {
        center: { x: 80,  y: 55  },
        left:   { x: 0,   y: 55  },
        right:  { x: 160, y: 55  },
        top:    { x: 80,  y: 0   },
        bottom: { x: 80,  y: 110 },
      };
    },
    svg(x, y, _props, id) {
      return [
        `<g class="component enclosure">`,
        `  <rect x="${x}" y="${y}" width="160" height="110" fill="none" stroke="#777" stroke-width="1.5" stroke-dasharray="8,4" rx="5"/>`,
        `  <text x="${x + 10}" y="${y + 16}" font-family="sans-serif" font-size="10" fill="#777">${id}</text>`,
        `</g>`,
      ].join('\n');
    },
  },

  '2x3': {
    // 2 independent channels (A and B), each accepting up to 3 wires.
    // Ports: a1-a3 on the top edge of channel A, b1-b3 on the top edge of channel B.
    width: 160,
    height: 55,
    ports() {
      // Channel A occupies left half (0–80), channel B right half (80–160).
      // 3 ports per channel, evenly spaced within each half.
      return {
        a1: { x: 18, y: 0 }, a2: { x: 40, y: 0 }, a3: { x: 62, y: 0 },
        b1: { x: 98, y: 0 }, b2: { x: 120, y: 0 }, b3: { x: 142, y: 0 },
        center: { x: 80, y: 27 },
      };
    },
    svg(x, y, _props, id) {
      const screws = (offsets) => offsets.map(ox =>
        `<circle cx="${x + ox}" cy="${y + 14}" r="5" fill="#AAA" stroke="#555" stroke-width="1"/>` +
        `<line x1="${x + ox - 3}" y1="${y + 14}" x2="${x + ox + 3}" y2="${y + 14}" stroke="#555" stroke-width="1"/>`
      ).join('\n');
      return [
        `<g class="component 2x3">`,
        `  <rect x="${x}" y="${y}" width="160" height="55" fill="#ECEFF1" stroke="#444" stroke-width="1.5" rx="2"/>`,
        `  <line x1="${x + 80}" y1="${y}" x2="${x + 80}" y2="${y + 55}" stroke="#AAA" stroke-width="1" stroke-dasharray="3,2"/>`,
        `  <text x="${x + 40}" y="${y + 48}" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#666">A</text>`,
        `  <text x="${x + 120}" y="${y + 48}" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#666">B</text>`,
        screws([18, 40, 62]),
        screws([98, 120, 142]),
        `  <text x="${x + 80}" y="${y + 48}" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#888">${id}</text>`,
        `</g>`,
      ].join('\n');
    },
  },

  _unknown: {
    width: 60,
    height: 40,
    ports() { return { center: { x: 30, y: 20 } }; },
    svg(x, y, _props, id) {
      return [
        `<g class="component unknown">`,
        `  <rect x="${x}" y="${y}" width="60" height="40" fill="#EEE" stroke="#999" stroke-width="1" rx="3"/>`,
        `  <text x="${x + 30}" y="${y + 25}" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#666">${id}</text>`,
        `</g>`,
      ].join('\n');
    },
  },

};

function getComponentDef(type) {
  return COMPONENTS[type] || COMPONENTS._unknown;
}

function getComponentWidth(comp) {
  const def = getComponentDef(comp.type);
  return typeof def.width === 'function' ? def.width(comp.props) : def.width;
}

function getComponentHeight(comp) {
  const def = getComponentDef(comp.type);
  return typeof def.height === 'function' ? def.height(comp.props) : def.height;
}

module.exports = { WIRE_COLORS, getComponentDef, getComponentWidth, getComponentHeight };
