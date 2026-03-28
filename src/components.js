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
    // 3 decorative pin holes on the horizontal centre axis (left, centre=ground, right).
    // Each pin has a connection point on both the top and bottom edge.
    // Ports: left.top/bottom, gnd.top/bottom, right.top/bottom  (top and bottom — electrically equivalent pairs).
    width: 90,
    height: 40,
    ports() {
      return {
        'left.top':    { x: 22, y: 0  },
        'left.bottom': { x: 22, y: 40 },
        'gnd.top':     { x: 45, y: 0  },
        'gnd.bottom':  { x: 45, y: 40 },
        'right.top':   { x: 68, y: 0  },
        'right.bottom':{ x: 68, y: 40 },
        center:        { x: 45, y: 20 },
      };
    },
    svg(x, y, _props, id) {
      const pinXs = [22, 45, 68];

      const holes = pinXs.map(ox =>
        `  <circle cx="${x + ox}" cy="${y + 20}" r="6" fill="#444" stroke="#222" stroke-width="1"/>`
      ).join('\n');

      const topPins = pinXs.map(ox =>
        `  <circle cx="${x + ox}" cy="${y}"      r="3" fill="#888" stroke="#555" stroke-width="1"/>`
      ).join('\n');
      const botPins = pinXs.map(ox =>
        `  <circle cx="${x + ox}" cy="${y + 40}" r="3" fill="#888" stroke="#555" stroke-width="1"/>`
      ).join('\n');

      return [
        `<g class="component tipo_l">`,
        `  <rect x="${x}" y="${y}" width="90" height="40" fill="#F0EDE8" stroke="#444" stroke-width="1.5" rx="3"/>`,
        holes,
        topPins,
        botPins,
        `  <text x="${x + 45}" y="${y + 34}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#888">${id}</text>`,
        `</g>`,
      ].join('\n');
    },
  },

  'switch-1p': {
    // Single-pole switch. Ports: left and right on the horizontal centre axis.
    // Temporary symbol: rectangle with terminal dots and an angled blade line.
    width: 60,
    height: 30,
    ports() {
      return {
        left:   { x: 0,  y: 15 },
        right:  { x: 60, y: 15 },
        center: { x: 30, y: 15 },
      };
    },
    svg(x, y, _props, id) {
      return [
        `<g class="component switch-1p">`,
        `  <rect x="${x}" y="${y}" width="60" height="30" fill="#FFF9E6" stroke="#888" stroke-width="1.5" rx="3"/>`,
        // Terminal dots
        `  <circle cx="${x}" cy="${y + 15}" r="3" fill="#555"/>`,
        `  <circle cx="${x + 60}" cy="${y + 15}" r="3" fill="#555"/>`,
        // Blade (angled line suggesting open switch contact)
        `  <line x1="${x + 8}" y1="${y + 15}" x2="${x + 48}" y2="${y + 9}" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>`,
        `  <text x="${x + 30}" y="${y + 26}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#888">${id}</text>`,
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

  '2-chan': {
    // 2 independent channels (A and B) accepting N wires
    // Ports: a on the top edge of channel A, b on the top edge of channel B.
    width: 160,
    height: 30,
    ports() {
      // Channel A: left half (0–80), channel B: right half (80–160).
      // spreadZone confines auto-spreading to the strip area of each channel.
      const GAP = 6;
      return {
        a:          { x: 40,  y: 0,  spreadZone: { start: GAP,      end: 80 - GAP  } },
        b:          { x: 120, y: 0,  spreadZone: { start: 80 + GAP, end: 160 - GAP } },
        'a.bottom': { x: 40,  y: 30, spreadZone: { start: GAP,      end: 80 - GAP  } },
        'b.bottom': { x: 120, y: 30, spreadZone: { start: 80 + GAP, end: 160 - GAP } },
        center:     { x: 80,  y: 15 },
      };
    },
    svg(x, y, _props, id) {
      const H       = 30;
      const GAP     = 6;
      const STRIP_H = 10;
      const STRIP_W = 80 - GAP * 2;
      const STRIP_Y = y + (H - STRIP_H) / 2;  // vertically centred
      return [
        `<g class="component 2-chan">`,
        `  <rect x="${x}" y="${y}" width="160" height="${H}" fill="#ECEFF1" stroke="#444" stroke-width="1.5" rx="2"/>`,
        `  <line x1="${x + 80}" y1="${y}" x2="${x + 80}" y2="${y + H}" stroke="#AAA" stroke-width="1" stroke-dasharray="3,2"/>`,
        `  <rect x="${x + GAP}" y="${STRIP_Y}" width="${STRIP_W}" height="${STRIP_H}" fill="#AAA" stroke="#555" stroke-width="1" rx="2"/>`,
        `  <rect x="${x + 80 + GAP}" y="${STRIP_Y}" width="${STRIP_W}" height="${STRIP_H}" fill="#AAA" stroke="#555" stroke-width="1" rx="2"/>`,
        `  <text x="${x + 40}" y="${y + H - 4}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#666">A</text>`,
        `  <text x="${x + 120}" y="${y + H - 4}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#666">B</text>`,
        `  <text x="${x + 80}" y="${y + H - 4}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#888">${id}</text>`,
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
