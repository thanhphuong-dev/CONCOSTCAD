import test from 'node:test';
import assert from 'node:assert/strict';
import { cadShortcut, mountShellEvents } from './shell-events.js';

const target = (selector) => ({ closest: (query) => query.split(', ').includes(selector) ? {} : null });
const key = (key, options = {}) => ({ key, ...options });

test('native text editing never erases CAD entities or changes drawing undo history', () => {
  for (const field of ['input', 'textarea', 'select', '[role="textbox"]', '[role="spinbutton"]']) {
    for (const event of [key('Delete'), key('Backspace'), key('z', { ctrlKey: true }),
      key('Z', { ctrlKey: true, shiftKey: true }), key('y', { ctrlKey: true }), key('Enter'), key(' ')]) {
      assert.equal(cadShortcut({ ...event, target: target(field) }, true), null, `${field} ${event.key}`);
    }
  }
  assert.equal(cadShortcut(key('Delete', { target: { isContentEditable: true } }), true), null);
  assert.equal(cadShortcut(key('Delete'), true), 'erase');
});

test('Ctrl+Shift+Z resolves exclusively to Redo; file shortcuts remain available from inputs', () => {
  assert.equal(cadShortcut(key('Z', { ctrlKey: true, shiftKey: true }), true), 'redo');
  assert.equal(cadShortcut(key('z', { ctrlKey: true }), true), 'undo');
  assert.equal(cadShortcut(key('y', { ctrlKey: true }), true), 'redo');
  assert.equal(cadShortcut(key('s', { ctrlKey: true, target: target('input') }), true), 'save');
  assert.equal(cadShortcut(key('S', { ctrlKey: true, shiftKey: true }), true), 'saveAs');
});

test('focused buttons and separators keep Enter/Space; canvas accepts or repeats the command', () => {
  for (const element of ['button', 'a', 'summary', '[role="separator"]', '[role="tab"]']) {
    for (const value of ['Enter', ' ', 'Backspace', 'Delete']) {
      assert.equal(cadShortcut(key(value, { target: target(element) }), true), null);
    }
  }
  assert.equal(cadShortcut(key('Enter'), true), 'accept');
  assert.equal(cadShortcut(key(' '), true), 'accept');
  assert.equal(cadShortcut(key('Escape'), true), 'cancel');
});

test('IME, held keys, handled events, modal focus and Alt shortcuts cannot dispatch CAD actions', () => {
  for (const flags of [{ isComposing: true }, { keyCode: 229 }, { repeat: true },
    { defaultPrevented: true }, { altKey: true }, { target: target('[role="dialog"]') }]) {
    assert.equal(cadShortcut(key('Delete', flags), true), null);
    assert.equal(cadShortcut(key('z', { ctrlKey: true, ...flags }), true), null);
  }
});

test('Start allows New/Open but does not edit a hidden drawing; drafting toggles work in command input', () => {
  assert.equal(cadShortcut(key('n', { ctrlKey: true }), false), 'new');
  assert.equal(cadShortcut(key('o', { ctrlKey: true }), false), 'open');
  for (const event of [key('Delete'), key('Enter'), key('F3'), key('F8'), key('z', { ctrlKey: true }), key('s', { ctrlKey: true })]) {
    assert.equal(cadShortcut(event, false), null);
  }
  assert.equal(cadShortcut(key('F3', { target: target('input') }), true), 'snap');
  assert.equal(cadShortcut(key('F8', { target: target('input') }), true), 'ortho');
});

function shellFixture() {
  const queries = [];
  const observers = [];
  const windowTarget = new EventTarget();
  windowTarget.devicePixelRatio = 1;
  windowTarget.matchMedia = (query) => {
    const media = new EventTarget();
    media.query = query;
    queries.push(media);
    return media;
  };
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(viewport) { this.viewport = viewport; }
    disconnect() { this.disconnected = true; }
  }
  return { queries, observers, windowTarget, Observer };
}

test('rebuilding the shell ten times leaves one keyboard handler and only the current viewport observed', () => {
  const f = shellFixture();
  let mounted;
  let undoCalls = 0;
  let resizeCalls = 0;
  for (let i = 0; i < 10; i++) {
    mounted?.dispose();
    const viewport = { id: i };
    mounted = mountShellEvents({ ...f, viewport, onResize: () => resizeCalls++, onKeyDown: (event) => {
      if (cadShortcut(event, true) === 'undo') undoCalls++;
    } });
  }
  const event = new Event('keydown', { cancelable: true });
  Object.assign(event, key('z', { ctrlKey: true }));
  f.windowTarget.dispatchEvent(event);
  assert.equal(undoCalls, 1);
  assert.equal(f.observers.filter((o) => !o.disconnected).length, 1);
  assert.equal(f.observers.at(-1).viewport.id, 9);
  const before = resizeCalls;
  f.windowTarget.dispatchEvent(new Event('resize'));
  assert.equal(resizeCalls, before + 1);
  mounted.dispose();
  f.windowTarget.dispatchEvent(event);
  f.windowTarget.dispatchEvent(new Event('resize'));
  assert.equal(undoCalls, 1);
  assert.equal(resizeCalls, before + 1);
  assert.equal(f.observers.filter((o) => !o.disconnected).length, 0);
});

test('moving between DPI scales redraws and re-arms the query; disposed queries do not redraw', () => {
  const f = shellFixture();
  let redraws = 0;
  const mounted = mountShellEvents({ ...f, viewport: {}, onResize: () => redraws++, onKeyDown: () => {} });
  assert.equal(redraws, 1);
  for (const scale of [1.25, 1.5, 2, 1]) {
    const previousQuery = f.queries.at(-1);
    f.windowTarget.devicePixelRatio = scale;
    previousQuery.dispatchEvent(new Event('change'));
    assert.equal(f.queries.at(-1).query, `(resolution: ${scale}dppx)`);
    const before = redraws;
    previousQuery.dispatchEvent(new Event('change'));
    assert.equal(redraws, before);
  }
  assert.equal(redraws, 5);
  mounted.dispose();
  f.queries.at(-1).dispatchEvent(new Event('change'));
  assert.equal(redraws, 5);
});
