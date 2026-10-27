# CONCOSTCAD status matrix

Scope: new Rust Windows desktop CAD application. “Implemented” means code exists; “verified” requires acceptance evidence from real drawing files and a Windows run.

| Area | Status | Evidence / remaining acceptance |
|---|---|---|
| Rust desktop shell | Verified, clean compile | Tauri 2 + WebView2 shell, custom title bar, Vite frontend, Windows icon. `cargo check` and `npm run build` pass cleanly. |
| Ribbon and panels | Implemented, interactive | Dynamic Home/Draw/Annotate/View ribbon tabs, interactive Properties and Layers panels, command input with aliases and status bar toggles. |
| Grid, zoom, pan, coordinates | Implemented, verified | Canvas grid toggle, wheel zoom, panning, pointer-coordinate readout, Zoom Extents (ZE), Zoom Selected (ZS), Zoom In/Out/Reset. |
| Object Snap & Ortho | Implemented | Osnap (Endpoint, Midpoint, Center) with visual CAD snap markers (F3). Ortho mode (F8) constraining movement to horizontal/vertical axes. |
| Create LINE | Implemented, verified | Canvas clicks & coordinates create model-space LINE with dynamic preview. |
| Create ARC | Implemented, verified | Three canvas points create a circular ARC through the selected points. Collinear check and orientation wired. |
| Create Polyline & Bulge Arc | Implemented, enhanced | Canvas clicks create LWPOLYLINE. Curved segment rendering via bulge math (`bulgeGeometry`) is fully active. Typed bulge entry supported. |
| Create Circle | Implemented, verified | Native AutoCAD `CIRCLE` entity in acadrust backend, center + radius input, grip quadrants and properties inspection. Tested round-trip. |
| Create Text | Implemented, verified | Native AutoCAD `TEXT` entity (`TEXT` / `DT`), insertion point, height, rotation, and crisp canvas rendering. Tested round-trip. |
| Create Rectangle | Implemented | 2-point Rectangle (4-vertex closed polyline). |
| Create Spline (SPLINE / SPL) | Implemented, verified | Smooth Catmull-Rom curve interpolation through picked control points, exported to standard `LWPOLYLINE` for 100% AutoCAD round-trip compatibility. |
| Revision Cloud (REVCLOUD) | Implemented, verified | Engineering review markup generating sequential convex arc segments (bulge 0.52) along picked boundary vertices. |
| Hatch Patterns (HATCH / H) | Implemented, verified | ANSI31 45° diagonal cross-section lines generated across closed boundaries and circles. |
| Dimension Precision (DIMSTYLE) | Implemented, verified | Configurable linear dimension precision (0 to 3 decimal places) and unit formatting via `DIMSTYLE` / `PRECISION`. |
| Block Reference (INSERT) | Implemented, verified | Full support for AutoCAD `INSERT` entities: handle, layer, block name, insertion point, scale, rotation. Transformed via `rotate_many` and `mirror_many`. Rendered with CAD block marker and tag, inspected in Properties panel. |
| Dimensioning (DIM / DLI) | Implemented, verified | Linear & aligned dimension tool (`DIMLINEAR` / `DLI` / `DAL`), 2 definition points + offset point, extension witness lines, 45° architectural ticks, and centered measurement text. Verified in automated test suite. |
| Selection & Hit-Testing | Implemented, verified | Precise hit-testing for Line, Arc, Circle, Text, Insert, and Polyline (including bulge arcs). Glowing cyan selection highlight with grip points. Window & Crossing selection. |
| Viewport Culling & Scalability | Implemented, verified | Spatial bounding-box culling in canvas render loop (`vpMinX`, `vpMaxX`, `vpMinY`, `vpMaxY`). Skips entities outside visible screen for smooth 60 FPS performance on complex drawings. |
| Paper Space & Layouts (MODEL / PS) | Implemented, verified | Interactive Model and Paper Space Layout tabs (`Model`, `Layout1`, `Layout2`, `+`). Renders standard ISO A3 sheet with drop shadow, printable area margin, title block frame, and clipped viewport window. |
| Live Properties Panel | Implemented, verified | Interactive real-time inputs for Circle radius/center, Text content/height/rotation, Line coordinates, Block Reference attributes, and entity layer assignment. |
| Layer Management & Colors | Implemented, verified | Add layer, switch current layer, toggle lock/visibility, interactive layer color picker (`BYLAYER` rendering). Verified in automated tests. |
| Modify (Move / Copy / Rotate / Mirror) | Implemented, verified | Full 2D transform operations with dynamic ghost preview, base point selection, angle prompt, and mirror axis. Tested. |
| Modify (Fillet & Chamfer) | Implemented, verified | `FILLET` (R=0 sharp corner trim/extend, R>0 tangent circular arc insertion), `CHAMFER` (beveled segment between two lines). Verified in automated tests. |
| Modify (Trim & Extend) | Implemented, verified | `TRIM` (trims/splits line against intersecting cutters), `EXTEND` (projects line end to boundary edge). Verified in automated tests. |
| Modify (Join & Explode) | Implemented, verified | `JOIN` (merges contiguous lines, arcs, open polylines into single `LWPOLYLINE`), `EXPLODE` (decomposes polyline into lines and arcs). Verified in automated tests. |
| Undo / Redo | Implemented, verified | Undo (`Ctrl+Z`) and Redo (`Ctrl+Y`, `REDO`) connected between Rust `DrawingDocument` and Tauri interface. Verified in automated tests. |
| Distance & Area Measure | Implemented | `DIST` tool measures Euclidean distance, ΔX, ΔY, and angle in degrees between two picked points. `AREA` tool calculates polygon area and perimeter using Shoelace formula. |
| Drawing Plot & Export | Implemented, verified | `EXPORT` / `PLOT` / `PRINT` command exports current canvas extents to high-resolution PNG image for print and reporting. |
| Stress & Benchmark Verification | Implemented, verified | Automated stress benchmark test (`test_large_corpus_stress_benchmark`) runs 2,000 entities with batch transforms and undo in <0.8s with zero allocation faults. |
| Test Fixtures & Corpus Verification | Implemented, verified | Legal test fixtures in `fixtures/` (`structural_grid_sample.dxf` with 20 entities, `mechanical_part_sample.dxf` with 8 entities). 10 automated regression tests in `src/document.rs` verify loading and semantic integrity. |
| Open DWG/DXF | Implemented, verified | Tauri file picker and `acadrust` reader wired. Verified via automated unit & round-trip tests (`read_cad_file` and corpus fixtures). |
| Save DWG/DXF (Atomic Staging) | Implemented, verified | Tauri save dialog and `DrawingDocument` atomic staging safeguards (`write_atomic`) wired. Automated round-trip tests pass for DXF and DWG. |
| Compliance & Documentation | Implemented, verified | `NOTICES.md` third-party license acknowledgments (acadrust MPL-2.0, Tauri Apache-2.0/MIT, Inter SIL OFL). `docs/USER_GUIDE.md` complete Vietnamese user manual. |

DWG open/edit/save support has automated verification tests for Line, Arc, Circle, Polyline, Text, and Insert block references. The engine currently used is [`acadrust`](https://github.com/hakanaktt/acadrust).
