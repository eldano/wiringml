#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const { process: processDiagram } = require('./src/index');

const [,, inputFile] = process.argv;

if (!inputFile) {
  process.stderr.write('Usage: node cli.js <file.yaml>\n');
  process.exit(1);
}

async function main() {
  const source = fs.readFileSync(path.resolve(inputFile), 'utf8');
  const svg    = await processDiagram(source);
  const title  = path.basename(inputFile, path.extname(inputFile));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    html, body {
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      background: #E8E8E8;
      overflow: hidden;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  ${svg}
</body>
</html>`;

  process.stdout.write(html + '\n');
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
