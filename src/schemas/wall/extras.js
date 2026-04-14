'use strict';

// Registry of fixed-render extras. Each function receives absolute pixel
// coordinates (x, y, w, h) and returns an SVG fragment string.

function renderExtra(type, x, y, w, h) {
  switch (type) {
    case 'ac_split': return renderAcSplit(x, y, w, h);
    default: return `<!-- unknown extra type: ${type} -->`;
  }
}

// Wall-mounted AC split indoor unit — front elevation schematic.
// Features: body housing, horizontal intake grill, separation groove, air
// direction vane, and a status indicator dot.
function renderAcSplit(x, y, w, h) {
  const r      = 4;
  const sw     = 1.5;
  const stroke = '#3C4E58';

  // Intake grill: top 36 % of height, 4 horizontal lines
  const grillBot = y + h * 0.36;
  const grillTop = y + h * 0.09;
  const padX     = w * 0.04;
  const numLines = 4;
  const lineStep = (grillBot - grillTop - h * 0.05) / (numLines - 1);

  const grillLines = Array.from({ length: numLines }, (_, i) => {
    const ly = grillTop + lineStep * i;
    return `<line x1="${p(x + padX)}" y1="${p(ly)}" x2="${p(x + w - padX)}" y2="${p(ly)}" stroke="${stroke}" stroke-width="1.2"/>`;
  });

  // Air direction vane: inset rect near bottom
  const vaneY = y + h * 0.77;
  const vaneH = h * 0.16;

  return [
    // Outer housing
    `<rect x="${p(x)}" y="${p(y)}" width="${p(w)}" height="${p(h)}" rx="${r}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`,
    // Intake grill lines
    ...grillLines,
    // Horizontal groove separating grill from body face
    `<line x1="${p(x)}" y1="${p(grillBot)}" x2="${p(x + w)}" y2="${p(grillBot)}" stroke="${stroke}" stroke-width="0.8"/>`,
    // Air direction vane
    `<rect x="${p(x + padX)}" y="${p(vaneY)}" width="${p(w - padX * 2)}" height="${p(vaneH)}" rx="2" fill="none" stroke="${stroke}" stroke-width="1"/>`,
  ].join('\n  ');
}

function p(n) { return Math.round(n * 10) / 10; }

module.exports = { renderExtra };
