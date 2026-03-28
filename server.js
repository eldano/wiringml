#!/usr/bin/env node
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const { parse }  = require('./src/parser');
const { layout } = require('./src/layout');
const { render } = require('./src/renderer');

const PORT         = 3050;
const EXAMPLES_DIR = path.join(__dirname, 'examples');

const server = http.createServer(async (req, res) => {
  if (req.url === '/examples' || req.url === '/examples/') {
    const names = fs.readdirSync(EXAMPLES_DIR)
      .filter(f => f.endsWith('.yaml'))
      .map(f => f.slice(0, -5));

    const links = names
      .map(n => `  <li><a href="/examples/${n}">${n}</a></li>`)
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WiringML Examples</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f5f5f5; }
    a { color: #1565C0; text-decoration: none; }
    a:hover { text-decoration: underline; }
    li { margin: 0.4rem 0; font-size: 1.1rem; }
  </style>
</head>
<body>
  <h2>Examples</h2>
  <ul>
${links}
  </ul>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  const match = req.url.match(/^\/examples\/([^/?#]+)\/?$/);

  if (!match) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found. Try /examples');
    return;
  }

  const name     = match[1];
  const filePath = path.join(EXAMPLES_DIR, `${name}.yaml`);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`Diagram not found: ${name}.yaml`);
    return;
  }

  try {
    const source      = fs.readFileSync(filePath, 'utf8');
    const graph       = parse(source);
    const layoutResult = await layout(graph);
    const svg         = render(graph, layoutResult);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <style>
    html, body {
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      background: #E8E8E8;
    }
    #back {
      display: inline-block;
      margin-bottom: 12px;
      font-family: sans-serif;
      font-size: 1.15rem;
      color: #1565C0;
      text-decoration: none;
    }
    #back:hover { text-decoration: underline; }
    svg {
      display: block;
      width: 100%;
      height: calc(100% - 32px);
    }
  </style>
</head>
<body>
  <a id="back" href="/examples">← Examples</a>
  ${svg}
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Error rendering diagram: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`WiringML server running at http://localhost:${PORT}`);
  console.log(`Example: http://localhost:${PORT}/examples/liv.s.135`);
});
