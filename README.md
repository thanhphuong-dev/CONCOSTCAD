# CONCOSTCAD

Windows desktop CAD built with a Rust drawing core and a Tauri 2 interface. The current Tauri shell has an AutoCAD-inspired ribbon, canvas, Layers and Properties panels, and a command bar.

## Run

```powershell
npm install
npm run tauri dev
```

## Current Tauri build

The app can create a new drawing, open and save DWG/DXF through `acadrust`, draw LINE, three-point ARC, and LWPOLYLINE by clicking the canvas, and undo. The canvas supports wheel zoom and panning. The frontend is in `src-ui/`; Tauri commands and the reusable drawing model are in `src/main.rs` and `src/document.rs`.

The earlier egui interface contains more CAD workflows than are currently connected to the new Tauri UI. Selection, Move, Erase, editable Properties, layer controls, bulge-arc rendering, and full command-line point input still need migration. DWG/DXF interoperability has not been accepted against a real customer drawing corpus or a reference CAD application.

Build checks: `npm run build` and `cargo check`. See [the status matrix](docs/STATUS_MATRIX.md) and [the Rust development plan](docs/RUST_DEVELOPMENT_PLAN.md).
