const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="spinbutton"]';
const CONTROL = 'button, a, summary, [role="button"], [role="tab"], [role="separator"], [role="slider"], [role="checkbox"], [role="menuitem"]';

// Decide once per key event. Native text editing and focused controls own their
// keys; CAD shortcuts only run when that event has not already been handled.
export function cadShortcut(event, editorActive) {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat || event.altKey) return null;
  const target = event.target;
  if (target?.closest?.('dialog, [role="dialog"]')) return null;
  const editable = Boolean(target?.isContentEditable || target?.closest?.(EDITABLE));
  const control = Boolean(target?.closest?.(CONTROL));
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    if (key === 'n') return 'new';
    if (key === 'o') return 'open';
    if (key === '9' && !event.shiftKey) return 'toggleCommandBar';
    if (!editorActive) return null;
    if (key === 's') return event.shiftKey ? 'saveAs' : 'save';
    if (editable) return null;
    if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
    if (key === 'y' && !event.shiftKey) return 'redo';
    return null;
  }
  if (!editorActive) return null;
  if (key === 'f12') return 'toggleDynamicInput';
  if (key === 'f3') return 'snap';
  if (key === 'f8') return 'ortho';
  if (editable) return null;
  if (key === 'escape') return 'cancel';
  if (control) return null;
  if (key === 'delete' || key === 'backspace') return 'erase';
  if (key === 'enter' || key === ' ') return 'accept';
  return null;
}

// A shell rebuild replaces the viewport. Its observer, DPI subscription and
// window keyboard handler must be disposed together before mounting the next.
export function mountShellEvents({ viewport, onResize, onKeyDown,
  windowTarget = window, Observer = ResizeObserver }) {
  const controller = new AbortController();
  const { signal } = controller;
  const observer = new Observer(onResize);
  observer.observe(viewport);
  windowTarget.addEventListener('keydown', onKeyDown, { signal });
  windowTarget.addEventListener('resize', onResize, { signal });
  let dpiQuery;
  const watchDpi = () => {
    dpiQuery?.removeEventListener('change', dpiChanged);
    dpiQuery = windowTarget.matchMedia(`(resolution: ${windowTarget.devicePixelRatio || 1}dppx)`);
    dpiQuery.addEventListener('change', dpiChanged);
  };
  const dpiChanged = () => {
    watchDpi();
    onResize();
  };
  watchDpi();
  onResize();
  return {
    signal,
    dispose() {
      controller.abort();
      observer.disconnect();
      dpiQuery.removeEventListener('change', dpiChanged);
    },
  };
}
