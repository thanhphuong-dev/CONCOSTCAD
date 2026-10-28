# UI regression checks

Run `npm run test:ui` for input routing, shell lifecycle/DPI and ViewCube regressions. Windows CI runs this command after the frontend build.

For browser smoke tests, run `npm run dev` and open `http://127.0.0.1:1420/tests/ui-smoke.html`. The fixture loads the production frontend with Tauri's provided IPC/window mocks and one horizontal LINE. Its visible banner counts calls. It does not open or save local drawings, and it does not verify Rust geometry, history, DWG/DXF, or native window behavior. Unknown commands fail explicitly; ERASE is a sentinel failure for these focus tests. The production entrypoint never imports the fixture.

Manual regression sequence:

1. Select the **UI smoke fixture** document tab. Toggle VI/EN twice.
2. With focus outside an editable field, press Ctrl+Z and Ctrl+Shift+Z. The banner must show `undo:1` and `redo:1`.
3. Click the horizontal line, focus Start X in Properties, select its value, and press Backspace. The line must remain selected and the banner must not contain `erase_entities`.
4. Press Ctrl+Z in that field. Its value should return and the drawing `undo` count must remain 1.
5. Press F8 once. ORTHO must toggle once.
6. Drag the palette width splitter. The canvas must fill the resized viewport after language changes; CSS canvas dimensions must equal the viewport dimensions and its bitmap must account for display scaling.
7. Exercise ViewCube directions, drag, quarter turns and keyboard rotation. Navigation must not add `hit_test_entity` calls.

On 2026-10-28, steps 1–6 passed through the in-app browser with no JavaScript errors. Native Windows capture failed with timeouts; these results are frontend-only acceptance evidence.
