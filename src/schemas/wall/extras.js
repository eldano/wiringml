'use strict';

// Registry of fixed-render extras.
// extra  — the full parsed extra object (type, width, height, position, + type-specific fields)
// x,y,w,h — pixel bounding box of the extra's declared width/height
// ctx    — wall geometry context: { x0, x1, y3, y2 } (wall corners, top-left and top-right)
// scale  — meters-to-pixels scale factor

function renderExtra(extra, x, y, w, h, ctx, scale) {
  switch (extra.type) {
    case 'ac_split': return renderAcSplit(x, y, w, h);
    case 'stove':    return renderStove(extra, x, y, w, h, ctx, scale);
    default: return `<!-- unknown extra type: ${extra.type} -->`;
  }
}

// Wall-mounted AC split indoor unit — front elevation schematic.
function renderAcSplit(x, y, w, h) {
  const r      = 4;
  const sw     = 1.5;
  const stroke = '#3C4E58';

  const grillBot = y + h * 0.36;
  const grillTop = y + h * 0.09;
  const padX     = w * 0.04;
  const numLines = 4;
  const lineStep = (grillBot - grillTop - h * 0.05) / (numLines - 1);

  const grillLines = Array.from({ length: numLines }, (_, i) => {
    const ly = grillTop + lineStep * i;
    return `<line x1="${p(x + padX)}" y1="${p(ly)}" x2="${p(x + w - padX)}" y2="${p(ly)}" stroke="${stroke}" stroke-width="1.2"/>`;
  });

  const vaneY = y + h * 0.77;
  const vaneH = h * 0.16;

  return [
    `<rect x="${p(x)}" y="${p(y)}" width="${p(w)}" height="${p(h)}" rx="4" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`,
    ...grillLines,
    `<line x1="${p(x)}" y1="${p(grillBot)}" x2="${p(x + w)}" y2="${p(grillBot)}" stroke="${stroke}" stroke-width="0.8"/>`,
    `<rect x="${p(x + padX)}" y="${p(vaneY)}" width="${p(w - padX * 2)}" height="${p(vaneH)}" rx="2" fill="none" stroke="${stroke}" stroke-width="1"/>`,
  ].join('\n  ');
}

// Wood-burning cast-iron stove — front elevation schematic.
// Body is split into two sections: upper firebox (with glass door) and lower
// log storage. A narrow chimney rises from the body roof to the wall ceiling.
function renderStove(extra, x, y, w, h, ctx, scale) {
  const stroke   = '#3C4E58';
  const sw       = 1.5;

  // Body section heights from declared meters
  const totalBodyM  = (extra.lower_height || 0.40) + ((extra.height || 0.92) - (extra.lower_height || 0.40));
  const lowerFrac   = (extra.lower_height || 0.40) / (extra.height || 0.92);
  const upperH      = p(h * (1 - lowerFrac));
  const lowerH      = p(h * lowerFrac);
  const divY        = y + upperH;           // divider between firebox and log section

  // Chimney: centered on body, extends from body roof to ceiling
  const chimneyWm   = extra.chimney_width || 0.19;
  const chimneyW    = Math.round(chimneyWm * scale);
  const chimneyX    = x + (w - chimneyW) / 2;
  const ceilingY    = ceilingAtX(chimneyX + chimneyW / 2, ctx);
  const chimneyH    = y - ceilingY;

  // Firebox viewing window: inset inside upper body
  const fwPadX = w * 0.08;
  const fwPadY = upperH * 0.12;
  const fwX    = x + fwPadX;
  const fwY    = y + fwPadY;
  const fwW    = w - fwPadX * 2;
  const fwH    = upperH - fwPadY * 2;

  // Log storage lines: 3 horizontal lines suggesting stacked logs
  const logPadX  = w * 0.10;
  const logLines = [0.28, 0.52, 0.76].map(frac => {
    const ly = divY + lowerH * frac;
    return `<line x1="${p(x + logPadX)}" y1="${p(ly)}" x2="${p(x + w - logPadX)}" y2="${p(ly)}" stroke="${stroke}" stroke-width="1"/>`;
  });

  return [
    // Chimney pipe
    `<rect x="${p(chimneyX)}" y="${p(ceilingY)}" width="${p(chimneyW)}" height="${p(chimneyH)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`,
    // Body outer rect
    `<rect x="${p(x)}" y="${p(y)}" width="${p(w)}" height="${p(h)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`,
    // Divider: firebox / log storage
    `<line x1="${p(x)}" y1="${p(divY)}" x2="${p(x + w)}" y2="${p(divY)}" stroke="${stroke}" stroke-width="1"/>`,
    // Firebox glass door
    `<rect x="${p(fwX)}" y="${p(fwY)}" width="${p(fwW)}" height="${p(fwH)}" fill="none" stroke="${stroke}" stroke-width="1"/>`,
    // Log section
    ...logLines,
  ].join('\n  ');
}

// Linearly interpolate wall ceiling Y at a given x position.
function ceilingAtX(cx, { x0, x1, y3, y2 }) {
  const t = (cx - x0) / (x1 - x0);
  return y3 + (y2 - y3) * t;
}

function p(n) { return Math.round(n * 10) / 10; }

module.exports = { renderExtra };
