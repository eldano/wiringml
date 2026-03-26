#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const { parse }  = require('./src/parser');
const { layout } = require('./src/layout');
const { render } = require('./src/renderer');

const [,, inputFile] = process.argv;

if (!inputFile) {
  process.stderr.write('Usage: node cli.js <file.yaml>\n');
  process.exit(1);
}

async function main() {
  const source       = fs.readFileSync(path.resolve(inputFile), 'utf8');
  const graph        = parse(source);
  const layoutResult = await layout(graph);
  const svg          = render(graph, layoutResult);
  process.stdout.write(svg + '\n');
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
