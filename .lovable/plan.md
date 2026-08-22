# One Canonical Masking Engine For The Canvas

Today the Canvas has three near-identical selection implementations (Object Edit, Materials, Declutter), each with its own brush painter, undo stack, preview canvas and overlay rasterizer, plus a partial shared `selection-mask` model that only stores round dabs. Privacy Blur, Window Balance, Sky, Lawn and Redesign Keep/Replace/Remove have no real selection at all — they run on the whole frame.

This replaces all of that with one engine every targeted operation uses.

## What Gets Built

### 1. The engine (new `src/lib/mask-engine.ts`)

The normalized state model exactly as specified: `NormalizedPoint`, `BrushStroke` (polyline with `mode: add | erase | protect`, `size`, `feather`), `DetectedRegion` (label, confidence, optional polygon or SVG mask path), `MaskState` (source asset + version id, strokes, selected/protected regions, inverted, visible, opacity).

The engine owns, once:

- State transitions: begin/extend/commit stroke, undo, redo, clear, toggle region select, toggle region protect, invert, grow/shrink, feather, opacity, visibility.
- Geometry: polyline-to-coverage rasterization, polygon and mask-path filling, bounding boxes, coverage percentage, empty/over-broad checks.
- Rendering: one painter that draws a mask into any 2D context at three fidelities — editor overlay (translucent magenta target, green protection), binary mask (white target on black, feathered edges) and review composite (mask burnt over the source photo).
- Serialization: version-tagged JSON that persists with a saved version and rehydrates only when the source asset and version still match; stale masks are flagged rather than silently reused.
- Prompt text: the region and stroke sentences the briefs already send to the model.

Because strokes are polylines rather than dabs, brush paths stay smooth at any zoom and export cleanly to a real mask channel later.

### 2. The shared surface (new `src/lib/mask-surface.ts`)

One mountable DOM controller: preview canvas over the source image, pointer painting with pressure-independent smoothing, brush size and feather controls, add / erase / protect modes, undo and redo buttons, invert, show/hide, opacity, keyboard shortcuts, and the detected-region chip list. Tools pass in their labels, their detections and a change callback — nothing else.

### 3. Migration of existing tools

- `selection-mask.ts` becomes a thin adapter over the engine so existing briefs and tests keep working; dab-shaped saved masks upgrade to polylines on load.
- Object Edit, Materials and Declutter drop their private painters, undo stacks and overlay builders and mount the shared surface. Their exported helper names stay so the app script does not change.

### 4. Tools that gain masking for the first time

- Privacy Blur, Window Balance, Sky Enhancement, Lawn Enhancement and Object Removal get an optional "Limit To A Selection" step in Edit Photo that mounts the same surface.
- Redesign Keep / Replace / Remove gets the region model behind its existing text entry, so an element can be marked on the photo rather than only described.
- The photo-edit server function accepts the mask overlay and region sentences and instructs the model to change only inside the target while leaving protected areas untouched; unmasked calls behave exactly as they do today.

## Guarantees

- The permanent shared Canvas stays mounted — this changes what paints inside the stage, not the page shell.
- No tool keeps a private mask implementation afterwards; a repository check for stray brush canvases is part of the work.
- Masks persist with the version they were drawn on and are refused when the underlying image changed.
- New tests cover stroke geometry, undo/redo, protection precedence, inversion, coverage maths, serialization round-trips and stale-source rejection, alongside the existing suite.
