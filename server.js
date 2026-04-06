#!/usr/bin/env node
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const { process: processDiagram } = require('./src/index');

const PORT         = 3050;
const EXAMPLES_DIR = path.join(__dirname, 'examples');

function compareNames(a, b) {
  const partsA = a.split('.');
  const partsB = b.split('.');
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const pa = partsA[i] ?? '';
    const pb = partsB[i] ?? '';
    if (pa === pb) continue;
    // Third segment (index 2) uses special ordering: C first, then numeric ascending
    if (i === 2) {
      if (pa === 'C') return -1;
      if (pb === 'C') return  1;
      const na = Number(pa), nb = Number(pb);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
    }
    // First and second segments: alphabetical
    return pa < pb ? -1 : 1;
  }
  return 0;
}

function readStatus(name) {
  const filePath = path.join(EXAMPLES_DIR, `${name}.yaml`);
  try {
    const source = fs.readFileSync(filePath, 'utf8');
    const doc    = yaml.load(source);
    if (!doc || !doc.status) return null;
    return {
      complete: doc.status.complete === true,
      missing:  Array.isArray(doc.status.missing) ? doc.status.missing : [],
    };
  } catch {
    return null;
  }
}

function listExamples() {
  return fs.readdirSync(EXAMPLES_DIR)
    .filter(f => f.endsWith('.yaml'))
    .map(f => f.slice(0, -5))
    .sort(compareNames)
    .map(name => ({ name, status: readStatus(name) }));
}

const SHELL = (examples) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WiringML</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      height: 100%;
      font-family: sans-serif;
      background: #E8E8E8;
    }

    #layout {
      display: flex;
      height: 100%;
    }

    #sidebar {
      width: 220px;
      flex-shrink: 0;
      background: #fff;
      border-right: 1px solid #ddd;
      padding: 1.5rem 1rem;
      overflow-y: auto;
    }

    #sidebar h2 {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #999;
      margin-bottom: 1rem;
    }

    #sidebar ul {
      list-style: none;
    }

    #sidebar li a {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.4rem 0.5rem;
      border-radius: 4px;
      color: #1565C0;
      text-decoration: none;
      font-size: 0.95rem;
    }

    #sidebar li a:hover  { background: #f0f4ff; }
    #sidebar li a.active { background: #E3ECFF; font-weight: 600; }

    .status-dot {
      flex-shrink: 0;
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .status-dot.complete   { background: #43A047; }
    .status-dot.incomplete { background: #FB8C00; }
    .status-dot.none       { background: #BDBDBD; }

    #main {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 1.5rem;
      gap: 0.75rem;
      overflow: hidden;
    }

    #placeholder {
      margin: auto;
      color: #aaa;
      font-size: 1.1rem;
    }

    #diagram {
      flex: 1;
      min-height: 0;
      position: relative;
      display: none;
    }

    #diagram svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    #missing {
      flex-shrink: 0;
      background: #FFF8E1;
      border: 1px solid #FFE082;
      border-radius: 6px;
      padding: 0.6rem 0.9rem;
      font-size: 0.85rem;
      color: #5D4037;
      display: none;
    }

    #missing strong {
      display: block;
      margin-bottom: 0.3rem;
      color: #E65100;
    }

    #missing ul {
      list-style: disc;
      padding-left: 1.2rem;
    }

    #error {
      color: #c62828;
      font-size: 0.9rem;
      margin: auto;
      display: none;
    }
  </style>
</head>
<body>
  <div id="layout">
    <nav id="sidebar">
      <h2>Examples</h2>
      <ul>
        ${examples.map(({ name, status }) => {
          const parts = name.split('.').length;
          const indent = parts === 2 ? ' style="padding-left:1rem"' : parts >= 3 ? ' style="padding-left:2rem"' : '';
          const dotClass = !status ? 'none' : status.complete ? 'complete' : 'incomplete';
          return `<li><a href="#${name}" data-name="${name}"${indent}><span class="status-dot ${dotClass}"></span>${name}</a></li>`;
        }).join('\n        ')}
      </ul>
    </nav>
    <main id="main">
      <p id="placeholder">Select an example</p>
      <div id="diagram"></div>
      <div id="missing"><strong>Missing</strong><ul></ul></div>
      <p id="error"></p>
    </main>
  </div>
  <script>
    const diagram     = document.getElementById('diagram');
    const placeholder = document.getElementById('placeholder');
    const missingEl   = document.getElementById('missing');
    const errorEl     = document.getElementById('error');

    async function load(name) {
      document.querySelectorAll('#sidebar a').forEach(a => a.classList.toggle('active', a.dataset.name === name));
      missingEl.style.display = 'none';
      try {
        const [svgRes, statusRes] = await Promise.all([
          fetch('/examples/' + name),
          fetch('/status/'  + name),
        ]);
        if (!svgRes.ok) throw new Error(await svgRes.text());
        const svg = await svgRes.text();
        diagram.innerHTML         = svg;
        diagram.style.display     = 'block';
        placeholder.style.display = 'none';
        errorEl.style.display     = 'none';

        if (statusRes.ok) {
          const st = await statusRes.json();
          if (!st.complete && st.missing && st.missing.length > 0) {
            missingEl.querySelector('ul').innerHTML = st.missing.map(m => \`<li>\${m}</li>\`).join('');
            missingEl.style.display = 'block';
          }
        }
      } catch (err) {
        errorEl.textContent       = 'Error: ' + err.message;
        errorEl.style.display     = 'block';
        diagram.style.display     = 'none';
        placeholder.style.display = 'none';
      }
    }

    document.getElementById('sidebar').addEventListener('click', e => {
      const a = e.target.closest('a[data-name]');
      if (!a) return;
      e.preventDefault();
      history.pushState({}, '', a.href);
      load(a.dataset.name);
    });

    // Load from URL hash on first visit and on hash changes
    const initial = location.hash.slice(1);
    if (initial) load(initial);

    window.addEventListener('hashchange', () => {
      const name = location.hash.slice(1);
      if (name) load(name);
    });
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // Shell page
  if (url === '/' || url === '/examples' || url === '/examples/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(SHELL(listExamples()));
    return;
  }

  // Status JSON for a named diagram
  const statusMatch = url.match(/^\/status\/([^/?#]+)\/?$/);
  if (statusMatch) {
    const name   = statusMatch[1];
    const status = readStatus(name);
    if (!status) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No status defined' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    }
    return;
  }

  // SVG fragment for a named diagram
  const match = url.match(/^\/examples\/([^/?#]+)\/?$/);
  if (!match) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
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
    const source = fs.readFileSync(filePath, 'utf8');
    const svg    = await processDiagram(source);
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8' });
    res.end(svg);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(err.message);
  }
});

server.listen(PORT, () => {
  console.log(`WiringML server running at http://localhost:${PORT}`);
});
