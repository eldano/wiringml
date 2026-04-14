# WiringML Architecture

## Summary

WiringML is a CLI-first, declarative diagramming tool that converts YAML specifications into SVG diagrams for documenting electrical installations. A single `process(source)` function drives everything: it reads a YAML file, detects its `schema` field, and routes the source through a three-stage pipeline — **parse → layout → render** — returning an SVG string.

The project currently supports three diagram types: wiring schematics (`wiring`), wall elevations (`wall`), and room floor plans (`room`). Each type has its own self-contained module folder under `src/schemas/`, meaning the core pipeline never needs to know about the internals of any schema. Adding a new diagram type requires only a new folder with three files.

---

## Module Breakdown

### `cli.js` — Command-Line Entry Point

Thin wrapper that reads a YAML file from `argv`, calls `process()`, and writes an HTML page containing the resulting SVG to stdout. No logic lives here beyond I/O and HTML boilerplate.

### `server.js` — Development Example Browser

Express-style HTTP server (port 3050) that renders all files in `examples/` as a clickable sidebar. Clicking an example loads its SVG into the main area via hash-based routing (no page reload). Also exposes a `/status/<name>` JSON endpoint for checking diagram completion state. This file exists purely for developer ergonomics and is not part of the production pipeline.

### `src/index.js` — Core Pipeline Orchestrator

Owns the single public `process(source)` function. Responsibilities:

1. Parse the raw YAML string with `js-yaml`
2. Read the `schema` field and dispatch to the matching schema module
3. Call `parse → layout → render` in sequence
4. Return the SVG string

This is the only file that knows all three schemas exist. Everything else is schema-local.

### `src/schemas/wiring/` — Electrical Wiring Diagrams

The most complex schema. Represents circuits as a graph of typed components (switches, conduits, terminal blocks, etc.) connected by colored wires.

**`parser.js`** — Transforms YAML into a graph: a list of components (each with an `id`, `type`, and `props`) and a list of wires (each with `from`, `to`, and `color`). Also extracts optional panel `overviews` and diagram `notes`.

**`components.js`** — Component registry. Defines every supported component type with its physical dimensions, named port positions, and an SVG rendering function. This is the single source of truth for what a `switch-1p` looks like and how wide a `terminal_block` with N ports should be.

**`layout.js`** — The algorithmic core of the project. Resolves each component's absolute position, then routes every wire through an orthogonal path algorithm:
- Resolves port coordinates from component-local space to global space
- Spreads multiple wires sharing a port 10 px apart to prevent overlap
- Emits a straight stub from each port in its natural exit direction
- Detects obstacles (component bounding boxes + routed wires) and extends the stub length until a clear path is found (up to 24 iterations)
- Computes L-shaped or Z-shaped bend points as needed

**`renderer.js`** — Walks the graph and layout result and emits SVG. Draws wires as `<path>` elements with the computed bend points, then draws each component by calling its rendering function from `components.js`. Optionally renders a panel casing diagram and a cover module overview if the YAML defines `overviews`.

### `src/schemas/wall/` — Wall Elevation Diagrams

Represents a single wall face: its dimensions, door/window openings, and electrical fixture placements.

**`parser.js`** — Extracts wall dimensions (`width`, `left_height`, `right_height` for sloped walls), a list of openings (doors, windows, archways) with positions and dimensions, and a list of fixtures with their type, wall position, and optional tooltip notes.

**`layout.js`** — Passthrough. Returns an empty object. Wall geometry is fully determined by the parsed dimensions; no algorithmic layout is needed.

**`renderer.js`** — Scales the wall to a target pixel width (800 px) and draws: a trapezoidal outline (supporting sloped ceilings), opening frames with door-swing arcs or window pane lines, and cream-colored fixture rectangles. Fixtures with `notes` render an SVG tooltip on hover.

### `src/schemas/room/` — Room Floor Plans

Represents a rectangular room's floor plan with four configurable walls and their openings.

**`parser.js`** — Reads each wall (north/south/east/west) with its length and a list of openings. Missing walls yield `null`, creating open sides.

**`layout.js`** — Passthrough. Returns an empty object.

**`renderer.js`** — Scales to target width and draws: wall outlines at 15 cm thickness, gaps for openings, door-swing arcs (CW/CCW × in/out), window symbols, and meter-labeled dimension lines.

### `examples/` — YAML Source Files

27+ example diagrams (wiring, wall, and room) representing real electrical installation documentation. Serve as both the primary test suite and the development browser's content.

---

## Why This Separation Is Useful

**Schema isolation** is the biggest architectural win. Each schema is a closed module: it owns its parser, its layout logic, and its renderer. Changing how door-swing arcs are drawn in `wall/renderer.js` is impossible to break `wiring/layout.js`. New diagram types can be added without touching any existing code — only `src/index.js` gets a one-line addition to its dispatch table.

**Parse → Layout → Render** stages mirror a classic compiler pipeline and give clean seams for testing and future extension. You can unit-test a parser by asserting on its graph output without running layout. You can swap in an alternative layout algorithm (e.g., ELK-based auto-placement) without touching the renderer.

**The component registry** in `wiring/components.js` keeps every dimension and port definition in one place. The layout and renderer never hardcode sizes; they always query the registry. This means resizing a component type automatically propagates to routing decisions and SVG output.

**The passthrough layout** for `wall` and `room` is an honest design choice: those schemas carry enough geometry in the YAML itself that a layout phase adds no value. Keeping the phase in the pipeline preserves the uniform interface without forcing unnecessary complexity.

---

## Possible Improvements and Future Work

### Correctness and Robustness

- **Wire routing failures are silent.** When the obstacle-avoidance loop exhausts its 24 attempts, the wire falls back to whatever path it last computed, which may overlap a component. A warning to stderr and a visual marker on the diagram would help.
- **Port validation.** If a wire references `conduit_1.nonexistent`, the parser currently produces `undefined` coordinates silently. Adding a validation pass between parse and layout would surface authoring errors early.
- **Sloped east/west walls in room diagrams.** The room renderer assumes rectangular rooms; east and west walls are implicitly the same height. Supporting asymmetric wall lengths (as `wall` does with `left_height`/`right_height`) would allow L-shaped or sloped rooms.

### Developer Experience

- **Watch mode with live SVG preview.** The server refreshes on file change via nodemon, but there is no hot-reload in the browser. A WebSocket push (or SSE) from the server would give instant visual feedback.
- **Error display in the browser.** Currently a render failure returns HTTP 500 with a plain error string. Showing the error inline next to the diagram (with a diff from the last successful render) would speed up iteration.
- **Schema validation with JSON Schema or Zod.** Authoring errors in YAML (wrong field name, missing required field) produce cryptic JS stack traces. Declarative schema validation would produce actionable messages.

### Features

- **ELK-based auto-layout for wiring.** `elkjs` is already a dependency but unused. Integrating it as an optional layout mode (when components have no explicit `x`/`y`) would make initial diagram authoring much faster.
- **Multi-page / project-level linking.** Wall diagrams reference wiring diagrams by `link` ID, and the server renders them individually. A project manifest (`project.yaml`) could define cross-diagram navigation and generate a linked HTML report.
- **Export formats beyond SVG.** The pipeline returns an SVG string; wrapping it in a PDF via headless Chrome or a canvas-based PNG export would make the output more portable for sharing.
- **Dimensions and annotations on wiring diagrams.** Wall and room diagrams render physical measurements; wiring diagrams currently have no built-in dimension or label system beyond the `notes` array.
- **Interactive fixture linking.** In the browser, clicking a wall fixture's `link` could load the referenced wiring diagram in a split view, enabling navigation between physical placement and circuit documentation.

### Code Quality

- **Shared rendering utilities.** Door-swing arc math is duplicated between `wall/renderer.js` and `room/renderer.js`. Extracting a `src/lib/drawing.js` with shared geometry helpers (arcs, scaling, grid snap) would reduce drift between the two implementations.
- **Typed interfaces.** The intermediate graph objects are plain JS with no enforced shape. Adding JSDoc typedefs (or migrating to TypeScript) would make the parser → layout → renderer contract explicit and IDE-navigable.
