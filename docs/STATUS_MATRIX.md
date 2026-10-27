# CONCOSTCAD status matrix

Scope: new Rust Windows desktop CAD application. “Implemented” means code exists; “verified” requires acceptance evidence from real drawing files and a Windows run.

| Area | Status | Evidence / remaining acceptance |
|---|---|---|
| Rust desktop shell | Implemented, compile checked | Tauri 2 + WebView2 shell, custom title bar, Vite frontend, Windows icon. Interactive DPI/resizing review remains. |
| Ribbon and panels | Implemented, early | Home/Draw/Annotate/View ribbon, Properties and Layers panels, command input and status bar are styled. Several controls are visual scaffolding while migration continues. |
| Grid, zoom, pan, coordinates | Implemented, early | Canvas grid, wheel zoom, panning, pointer-coordinate readout and Zoom Extents are wired. Object snap, Ortho and complete command-line coordinates are not yet migrated. |
| Create LINE | Implemented | Canvas clicks create model-space LINE with preview. |
| Create ARC | Implemented, early | Three canvas points create a circular ARC through the selected points. Sweep/orientation still needs drawing-corpus validation. |
| Create Polyline | Implemented, early | Canvas clicks create straight-segment LWPOLYLINE. Typed bulge entry is partial; curved-segment rendering is not yet migrated. |
| Open DWG/DXF | Integrated, unverified | Tauri file picker and `acadrust` reader are wired. Needs representative customer files, malformed-file review and round-trip checks. |
| Save DWG/DXF | Integrated, unverified | Tauri save dialog and existing `DrawingDocument` save safeguards are wired. External CAD round-trip is still required; cross-format Save As is refused. |
| Render imported entities | Partial | LINE, ARC, and straight LWPOLYLINE segments are rendered. Bulge tessellation and other CAD entity types are not connected to the Tauri canvas. |
| Select / Erase / Move / Properties edit | Not yet migrated | The current Tauri panels and buttons are visual scaffolding. The earlier egui implementation has these workflows, which need porting. |
| Undo / Redo | Partial | Undo is connected to toolbar and command `UNDO`; Redo is not connected to Tauri UI. |
| Layers and properties | Not yet migrated | Current panels display drawing metadata and layers. Layer and entity-property editing remain to be implemented in Tauri. |
| Build check | Verified | `cargo check` and `npm run build` succeed on the current Windows toolchain. No tests have been added or run. |

DWG open/edit/save support is not accepted as production-compatible until representative customer files are opened, edited, saved and reopened in both CONCOSTCAD and a reference CAD application. The engine currently used is [`acadrust`](https://github.com/hakanaktt/acadrust); its support does not establish CONCOSTCAD-level compatibility by itself. Upstream reports have documented silent loss in particular conversion paths and format metadata; review [issue #132](https://github.com/hakanaktt/acadrust/issues/132) and [issue #127](https://github.com/hakanaktt/acadrust/issues/127) when setting the compatibility matrix.
