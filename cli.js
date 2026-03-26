#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const { parse }  = require('./src/parser');
const { layout } = require('./src/layout');
const { render } = require('./src/renderer');

const [,, inputFile] = process.argv;

if (!inputFile) {
  process.stderr.write('Usage: node cli.js <file.wml>\n');
  process.exit(1);
}

const source    = fs.readFileSync(path.resolve(inputFile), 'utf8');
const graph     = parse(source);
const positions = layout(graph);
const svg       = render(graph, positions);

process.stdout.write(svg + '\n');
