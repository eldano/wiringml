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

  tipo_f: {
    // Square plug face (80×80). A circle (~90% of side) is centred inside,
    // with 3 pin holes arranged horizontally across the circle centre.
    // Ports: left/gnd/right on both top and bottom edges — same names as tipo_l.
    width: 80,
    height: 80,
    ports() {
      return {
        'left.top':    { x: 20, y: 0  },
        'left.bottom': { x: 20, y: 80 },
        'gnd.top':     { x: 40, y: 0  },
        'gnd.bottom':  { x: 40, y: 80 },
        'right.top':   { x: 60, y: 0  },
        'right.bottom':{ x: 60, y: 80 },
        center:        { x: 40, y: 40 },
      };
    },
    svg(x, y, _props, id) {
      const cx   = x + 40;
      const cy   = y + 40;
      const r    = 36; // ~90% of half-side (80*0.9/2)
      const pinXs = [20, 40, 60];

      const holes = pinXs.map(ox =>
        `  <circle cx="${x + ox}" cy="${cy}" r="5" fill="#444" stroke="#222" stroke-width="1"/>`
      ).join('\n');

      const topPins = pinXs.map(ox =>
        `  <circle cx="${x + ox}" cy="${y}"      r="3" fill="#888" stroke="#555" stroke-width="1"/>`
      ).join('\n');
      const botPins = pinXs.map(ox =>
        `  <circle cx="${x + ox}" cy="${y + 80}" r="3" fill="#888" stroke="#555" stroke-width="1"/>`
      ).join('\n');

      return [
        `<g class="component tipo_f">`,
        `  <rect x="${x}" y="${y}" width="80" height="80" fill="#F0EDE8" stroke="#444" stroke-width="1.5" rx="3"/>`,
        `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#444" stroke-width="1.5"/>`,
        holes,
        topPins,
        botPins,
        `  <text x="${cx}" y="${y + 74}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#888">${id}</text>`,
        `</g>`,
      ].join('\n');
    },
  },

  'switch-1p': {
    // Single-pole switch. Ports: left and right on the horizontal centre axis.
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
        // Port connection dots
        `  <circle cx="${x}" cy="${y + 15}" r="3" fill="#555"/>`,
        `  <circle cx="${x + 60}" cy="${y + 15}" r="3" fill="#555"/>`,
        // Left stub and pivot contact
        `  <line x1="${x + 2}" y1="${y + 15}" x2="${x + 17}" y2="${y + 15}" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>`,
        `  <circle cx="${x + 17}" cy="${y + 15}" r="2.5" fill="#555"/>`,
        // Blade (angled open position)
        `  <line x1="${x + 17}" y1="${y + 15}" x2="${x + 43}" y2="${y + 8}" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>`,
        // Right contact and stub
        `  <circle cx="${x + 43}" cy="${y + 15}" r="2.5" fill="#555"/>`,
        `  <line x1="${x + 43}" y1="${y + 15}" x2="${x + 58}" y2="${y + 15}" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>`,
        `  <text x="${x + 30}" y="${y + 27}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#888">${id}</text>`,
        `</g>`,
      ].join('\n');
    },
  },

  'switch-1p3w': {
    // 3-way single-pole switch. Like switch-1p but with an extra pin at top center.
    width: 60,
    height: 40,
    ports() {
      return {
        left:   { x: 0,  y: 25 },
        right:  { x: 60, y: 25 },
        center: { x: 30, y: 0  },
      };
    },
    svg(x, y, _props, id) {
      return [
        `<g class="component switch-1p3w">`,
        `  <rect x="${x}" y="${y}" width="60" height="40" fill="#FFF9E6" stroke="#888" stroke-width="1.5" rx="3"/>`,
        // Port connection dots
        `  <circle cx="${x}" cy="${y + 25}" r="3" fill="#555"/>`,
        `  <circle cx="${x + 60}" cy="${y + 25}" r="3" fill="#555"/>`,
        `  <circle cx="${x + 30}" cy="${y}" r="3" fill="#555"/>`,
        // Center (top) port stub
        `  <line x1="${x + 30}" y1="${y + 2}" x2="${x + 30}" y2="${y + 11}" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>`,
        `  <circle cx="${x + 30}" cy="${y + 11}" r="2.5" fill="#555"/>`,
        // Left stub and pivot contact
        `  <line x1="${x + 2}" y1="${y + 25}" x2="${x + 17}" y2="${y + 25}" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>`,
        `  <circle cx="${x + 17}" cy="${y + 25}" r="2.5" fill="#555"/>`,
        // Blade (angled open position, pointing toward center contact)
        `  <line x1="${x + 17}" y1="${y + 25}" x2="${x + 43}" y2="${y + 18}" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>`,
        // Right contact and stub
        `  <circle cx="${x + 43}" cy="${y + 25}" r="2.5" fill="#555"/>`,
        `  <line x1="${x + 43}" y1="${y + 25}" x2="${x + 58}" y2="${y + 25}" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>`,
        `  <text x="${x + 30}" y="${y + 37}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#888">${id}</text>`,
        `</g>`,
      ].join('\n');
    },
  },

  'switch-2p': {
    // Two-pole switch. Each pole has left/right ports, stacked vertically.
    width: 60,
    height: 60,
    ports() {
      return {
        'left.top':    { x: 0,  y: 15 },
        'right.top':   { x: 60, y: 15 },
        'left.bottom': { x: 0,  y: 45 },
        'right.bottom':{ x: 60, y: 45 },
        center:        { x: 30, y: 30 },
      };
    },
    svg(x, y, _props, id) {
      return [
        `<g class="component switch-2p">`,
        `  <rect x="${x}" y="${y}" width="60" height="60" fill="#FFF9E6" stroke="#888" stroke-width="1.5" rx="3"/>`,
        `  <line x1="${x}" y1="${y + 30}" x2="${x + 60}" y2="${y + 30}" stroke="#CCC" stroke-width="1" stroke-dasharray="3,2"/>`,
        // Mechanical link between blades (ganged)
        `  <line x1="${x + 30}" y1="${y + 12}" x2="${x + 30}" y2="${y + 42}" stroke="#AAA" stroke-width="1" stroke-dasharray="2,2"/>`,
        // Pole 1: port dots, stub, pivot, blade, contact, stub
        `  <circle cx="${x}" cy="${y + 15}" r="3" fill="#555"/>`,
        `  <circle cx="${x + 60}" cy="${y + 15}" r="3" fill="#555"/>`,
        `  <line x1="${x + 2}" y1="${y + 15}" x2="${x + 17}" y2="${y + 15}" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>`,
        `  <circle cx="${x + 17}" cy="${y + 15}" r="2.5" fill="#555"/>`,
        `  <line x1="${x + 17}" y1="${y + 15}" x2="${x + 43}" y2="${y + 8}" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>`,
        `  <circle cx="${x + 43}" cy="${y + 15}" r="2.5" fill="#555"/>`,
        `  <line x1="${x + 43}" y1="${y + 15}" x2="${x + 58}" y2="${y + 15}" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>`,
        // Pole 2: port dots, stub, pivot, blade, contact, stub
        `  <circle cx="${x}" cy="${y + 45}" r="3" fill="#555"/>`,
        `  <circle cx="${x + 60}" cy="${y + 45}" r="3" fill="#555"/>`,
        `  <line x1="${x + 2}" y1="${y + 45}" x2="${x + 17}" y2="${y + 45}" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>`,
        `  <circle cx="${x + 17}" cy="${y + 45}" r="2.5" fill="#555"/>`,
        `  <line x1="${x + 17}" y1="${y + 45}" x2="${x + 43}" y2="${y + 38}" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>`,
        `  <circle cx="${x + 43}" cy="${y + 45}" r="2.5" fill="#555"/>`,
        `  <line x1="${x + 43}" y1="${y + 45}" x2="${x + 58}" y2="${y + 45}" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>`,
        `  <text x="${x + 30}" y="${y + 56}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#888">${id}</text>`,
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

  '1-chan': {
    // Single channel (A) accepting multiple wires.
    // Ports: a on the top edge, a.bottom on the bottom edge.
    width: 80,
    height: 30,
    ports() {
      const GAP = 6;
      return {
        a:          { x: 40, y: 0,  spreadZone: { start: GAP, end: 80 - GAP } },
        'a.bottom': { x: 40, y: 30, spreadZone: { start: GAP, end: 80 - GAP } },
        center:     { x: 40, y: 15 },
      };
    },
    svg(x, y, _props, id) {
      const H       = 30;
      const GAP     = 6;
      const STRIP_H = 10;
      const STRIP_W = 80 - GAP * 2;
      const STRIP_Y = y + (H - STRIP_H) / 2;
      return [
        `<g class="component 1-chan">`,
        `  <rect x="${x}" y="${y}" width="80" height="${H}" fill="#ECEFF1" stroke="#444" stroke-width="1.5" rx="2"/>`,
        `  <rect x="${x + GAP}" y="${STRIP_Y}" width="${STRIP_W}" height="${STRIP_H}" fill="#AAA" stroke="#555" stroke-width="1" rx="2"/>`,
        `  <text x="${x + 40}" y="${y + H - 4}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#666">A</text>`,
        `  <text x="${x + 40}" y="${y + 8}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#888">${id}</text>`,
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

  '3-chan': {
    // 3 independent channels (A, B, C) — same overall width as 2-chan, split into thirds.
    width: 160,
    height: 30,
    ports() {
      const GAP = 6;
      const W   = 160;
      const CW  = Math.round(W / 3); // ~53px per channel
      return {
        a:          { x: Math.round(CW * 0.5),       y: 0,  spreadZone: { start: GAP,           end: CW - GAP          } },
        b:          { x: Math.round(CW * 1.5),       y: 0,  spreadZone: { start: CW + GAP,       end: CW * 2 - GAP      } },
        c:          { x: Math.round(CW * 2.5),       y: 0,  spreadZone: { start: CW * 2 + GAP,   end: W - GAP           } },
        'a.bottom': { x: Math.round(CW * 0.5),       y: 30, spreadZone: { start: GAP,           end: CW - GAP          } },
        'b.bottom': { x: Math.round(CW * 1.5),       y: 30, spreadZone: { start: CW + GAP,       end: CW * 2 - GAP      } },
        'c.bottom': { x: Math.round(CW * 2.5),       y: 30, spreadZone: { start: CW * 2 + GAP,   end: W - GAP           } },
        center:     { x: 80,                          y: 15 },
      };
    },
    svg(x, y, _props, id) {
      const H       = 30;
      const GAP     = 6;
      const W       = 160;
      const CW      = Math.round(W / 3);
      const STRIP_H = 10;
      const STRIP_Y = y + (H - STRIP_H) / 2;
      return [
        `<g class="component 3-chan">`,
        `  <rect x="${x}" y="${y}" width="${W}" height="${H}" fill="#ECEFF1" stroke="#444" stroke-width="1.5" rx="2"/>`,
        `  <line x1="${x + CW}" y1="${y}" x2="${x + CW}" y2="${y + H}" stroke="#AAA" stroke-width="1" stroke-dasharray="3,2"/>`,
        `  <line x1="${x + CW * 2}" y1="${y}" x2="${x + CW * 2}" y2="${y + H}" stroke="#AAA" stroke-width="1" stroke-dasharray="3,2"/>`,
        `  <rect x="${x + GAP}" y="${STRIP_Y}" width="${CW - GAP * 2}" height="${STRIP_H}" fill="#AAA" stroke="#555" stroke-width="1" rx="2"/>`,
        `  <rect x="${x + CW + GAP}" y="${STRIP_Y}" width="${CW - GAP * 2}" height="${STRIP_H}" fill="#AAA" stroke="#555" stroke-width="1" rx="2"/>`,
        `  <rect x="${x + CW * 2 + GAP}" y="${STRIP_Y}" width="${W - CW * 2 - GAP * 2}" height="${STRIP_H}" fill="#AAA" stroke="#555" stroke-width="1" rx="2"/>`,
        `  <text x="${x + CW * 0.5}" y="${y + H - 4}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#666">A</text>`,
        `  <text x="${x + CW * 1.5}" y="${y + H - 4}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#666">B</text>`,
        `  <text x="${x + CW * 2.5}" y="${y + H - 4}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#666">C</text>`,
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
