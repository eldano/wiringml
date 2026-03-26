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
  const title        = path.basename(inputFile, path.extname(inputFile));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      background: #E8E8E8;
      font-family: sans-serif;
    }
    h1 {
      margin: 0 0 16px;
      font-size: 14px;
      color: #555;
      font-weight: normal;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .diagram {
      display: inline-block;
      background: #F5F5F5;
      border: 1px solid #CCC;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      padding: 16px;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="diagram">
    ${svg}
  </div>
</body>
</html>`;

  process.stdout.write(html + '\n');
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
