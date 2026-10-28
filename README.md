# CONCOSTCAD

Windows desktop CAD built with a Rust drawing core and a Tauri 2 interface. The current Tauri shell has an AutoCAD-inspired ribbon, canvas, Layers and Properties panels, and a command bar.

## Run

```powershell
npm install
npm run tauri dev
```

## Current Tauri build

The app can open and save DWG/DXF through `acadrust`, draw and edit common 2D entities, use layers, dimensions, measurement tools, and undo/redo. The frontend is in `src-ui/`; Tauri commands and the drawing model are in `src/main.rs` and `src/document.rs`. Each drawing tab now has its own Rust document and undo history.

Dirty drawings are backed up every three minutes under `%LOCALAPPDATA%\CONCOSTCAD\Autosave` while the application is running. The backup contains drawing data; it does not clear the unsaved indicator or replace an explicit Save. DWG/DXF interoperability has automated corpus checks but still needs acceptance against representative customer files and a reference CAD application.

Build checks: `npm run build` and `cargo check`. See [the status matrix](docs/STATUS_MATRIX.md) and [the Rust development plan](docs/RUST_DEVELOPMENT_PLAN.md).
