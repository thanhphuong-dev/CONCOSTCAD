# CONCOSTCAD status matrix

Scope: new Rust Windows desktop CAD application. “Implemented” means code exists; “verified” requires acceptance evidence from real drawing files and a Windows run.

| Area | Status | Evidence / remaining acceptance |
|---|---|---|
| Rust desktop shell | Implemented, compile checked | `eframe`/`egui` shell; still needs interactive Windows DPI/resizing review. |
| Ribbon, dockable panes, command line | Implemented, early | Home/Draw/Annotate/View; Drawing/Properties/Layers panes. Annotation tools remain placeholders; layer controls are in early working state. |
| Grid, zoom, pan, coordinates, object snap, Ortho | Implemented, early | Adaptive world grid, wheel zoom, middle-button pan, F3 snap toggle, F8 Ortho and command-line absolute `x,y`, relative `@dx,dy`, polar `@distance<angle` point input. Snaps cover endpoint/midpoint/center/LINE-line intersection on visible LINE/ARC/LWPOLYLINE. Candidate list is cached per document revision and x-sorted. Large-coordinate/numeric and dense-intersection performance review remains. |
| Create LINE | Implemented | Canvas or typed coordinate points create a model-space LINE; Ortho and snap apply to pointer input. Live segment preview before confirmation. |
| Create ARC | Implemented, early | Three-point arc creation, stored as circular DXF-style CCW ARC, with live preview after point two. ARC angles normalize to `[0, 2π)` and equal start/end angles are rejected (use CIRCLE for a full circle); sweep/orientation still needs drawing-corpus validation. |
| Create Polyline | Implemented, early | LWPOLYLINE with straight and bulged segments; type `x,y,b=value` for a bulge on the segment from the prior vertex to this point (interactive magnitude capped at 1000000). Preview draws pending bulged segments. Enter finishes, `CLOSE` closes; closing segment is straight. |
| Open DWG/DXF | Integrated, unverified | File picker and `acadrust` reader wired; parsing runs on a worker thread and asks before discarding dirty drawings. Needs real DWG/DXF corpus, malformed-file and round-trip review. |
| Save DWG/DXF | Integrated, unverified | Save runs from a document snapshot on a worker thread; newer edits remain dirty. Same-format output goes through a staging file, is reopened and entity-type counts compared before target replacement. On Windows, existing targets are replaced with `ReplaceFileW`, and new targets are moved into place with `MoveFileExW` write-through. Save is refused if Unknown entities lack raw output-format data. These checks do not prove geometry/metadata fidelity; external CAD round-trip still required. Cross-format Save As is refused. |
| Render imported entities | Partial | LINE, ARC, LWPOLYLINE (including bulges) shown; other CAD entity types are retained by document model but not rendered. |
| Select / Erase / Move / Properties edit | Early | Point select plus left-to-right window selection and right-to-left crossing selection for sampled LINE/ARC/LWPOLYLINE geometry. Multi-selection Move and Erase normalize duplicate handles, prevalidate layers and finite target geometry, then commit as one undo step. Properties editing remains single-selection; Polyline vertices can be appended, removed, or inserted halfway along a segment while preserving its bulged arc. Other entity types remain non-editable in UI. |
| Undo / Redo | Integrated, unverified | Document snapshot history wired to toolbar command line; needs interactive workflow review. |
| Layers and properties | Early | Layers pane lists document layers, creates and renames a layer using the model's reference-updating operation, makes layers current, and supports frozen/off/locked state, canvas visibility, new-entity assignment and changing selected entity layer. Properties editor covers LINE/ARC/LWPOLYLINE geometry. Delete and layer color/linetype editing are not implemented; full layer-reference validation remains. |
| Build check | Verified | `cargo check` succeeds for the current Windows toolchain. No tests have been added or run. |

DWG open/edit/save support is not accepted as production-compatible until representative customer files are opened, edited, saved and reopened in both CONCOSTCAD and a reference CAD application. The engine currently used is [`acadrust`](https://github.com/hakanaktt/acadrust); its support does not establish CONCOSTCAD-level compatibility by itself. Upstream reports have documented silent loss in particular conversion paths and format metadata; review [issue #132](https://github.com/hakanaktt/acadrust/issues/132) and [issue #127](https://github.com/hakanaktt/acadrust/issues/127) when setting the compatibility matrix.



