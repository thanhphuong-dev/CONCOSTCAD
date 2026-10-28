# Ribbon acceptance — 28-10-2026

Scope follows week 22 of `RUST_DEVELOPMENT_PLAN.md`: the existing six Ribbon tabs, command state, keyboard access, palettes and resize/DPI behavior.

## Evidence

- `src-ui/ribbon.test.js`: eight passing tests cover context-sensitive actions, live state, tab navigation, overflow, transient tab/panel flyouts, live control reparenting, Escape ownership, focus, mode changes and disposal.
- The existing 15 keyboard/ViewCube tests also pass (`npm run test:ui`: 23 total).
- Vite build and EN/VI catalog check pass.
- These are frontend/unit results. Visual and Windows/WebView2 acceptance below remains unverified. The app browser tool is disabled in the current Work settings.

## Reproducible frontend preview

Run `npm run dev`, then open `http://127.0.0.1:1420/scripts/ribbon-preview.html` in a browser. Click New Drawing on Start. This fixture imports the real UI and Tauri's official mock helpers; its small in-memory document supports layers and PLINE for these UI workflows. It throws on unsupported commands. It does not read or write drawings, verify Rust geometry or prove DWG/DXF compatibility.

## Remaining manual acceptance

| Check | Expected behavior | Status |
|---|---|---|
| Start and New Drawing | Drawing actions disabled on Start, enabled after New; one selected Ribbon tab. | Pending |
| All six tabs | Captions and commands remain available in EN/VI and light/dark themes. | Pending |
| Keyboard tabs | Tab enters the selected tab; Left/Right wrap; Home/End select first/last; Down enters the command area. Active tab owns `aria-selected` and labels the panel. | Pending |
| Ribbon display modes | Full/panel-title/tab-only modes keep the workspace aligned. Double click and collapse button work; preference survives relaunch. Selecting a tab/panel in a minimized mode opens commands temporarily and preserves the saved mode. | Pending |
| Temporary flyouts | A tab-only flyout opens below the tabs; panel-title mode opens only the chosen group. Escape closes once and returns focus to its trigger, without cancelling the CAD command. Click/focus outside also closes. | Pending |
| Flyout controls and refresh | Toggle buttons and layer inputs keep their state while open. Same-tab refresh preserves the open panel and focused field; a new drawing tool closes the flyout and focuses the viewport. Switching tabs closes the old panel. | Pending |
| Flyout bounds | Resize and scroll the Ribbon near both window edges. Popovers stay anchored and within the viewport, including light/dark themes. | Pending |
| Narrow and wide windows | At 900/1200/1600/1920 px, the last group is reachable with scroll buttons and keyboard focus. Scroll buttons hide when content fits; endpoints disable correctly. | Pending |
| Windows DPI | Repeat resize and keyboard checks at 100/125/150/200%; no cut-off commands or stale canvas size. | Pending |
| Drafting toggles | Change GRID via command/status/Ribbon, OSNAP via F3 and ORTHO via F8. Every visible button reflects the same state and a Ribbon click keeps its focus. | Pending |
| Tool selection | Choose OFFSET from Home and another tool from quickbar/command line; only the current tool remains pressed. | Pending |
| Finish/Close PLINE | Disabled during LINE/SPLINE and with fewer than two PLINE vertices. Enabled after two vertices; Finish creates an open polyline and Close a closed one. | Pending |
| Add Layer | Hide and collapse Layers, then use Add Layer in Home/Manage. Palette opens expanded and name input receives focus. A rejected layer name stays editable. | Pending |
| Refresh focus/scroll | Scroll to the last Home group or focus the current-layer select, then change a layer/palette. A same-tab refresh retains scroll position and the focused control; starting a drawing command focuses the viewport. | Pending |
| Selection actions | Erase/Explode disabled with no selection; become available after selection and disable after clearing it. | Pending |
| Annotate | TEXT is available alongside DIM/DIST/AREA and dispatches its insertion prompt. | Pending |
| Shell rebuild | Change EN/VI/KO, return to Start/New and repeat keyboard/toggle/scroll actions; each action dispatches once. | Pending |

Native acceptance must use the Tauri app with approved drawing fixtures. Record the tested window size, DPI, locale/theme and outcome here before marking week 22 complete.
