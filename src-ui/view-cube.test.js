import test from 'node:test';
import assert from 'node:assert/strict';
import { bindViewCube, headingForRotation, normalizeRotation, rotateWorldPoint,
  rotationAroundCenter, updateViewCube, VIEW_HEADINGS } from './view-cube.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('rotation keeps the world point at the viewport center for panned and zoomed views', () => {
  for (const zoom of [0.0001, 1, 10000]) {
    for (const start of [-Math.PI, -0.37, 0, Math.PI / 2]) {
      for (const end of [-2.8, 0, 0.71, Math.PI]) {
        const center = { x: 721.25, y: -416.125 };
        const initial = rotateWorldPoint(center.x, center.y, start);
        const pan = rotationAroundCenter({ x: -initial.x * zoom, y: initial.y * zoom }, start, end);
        const projected = rotateWorldPoint(center.x, center.y, end);
        near(pan.x + projected.x * zoom, 0);
        near(pan.y - projected.y * zoom, 0);
      }
    }
  }
});

test('full turns and south boundary retain a selected compass heading', () => {
  for (const [heading, angle] of Object.entries(VIEW_HEADINGS)) {
    for (let turns = -8; turns <= 8; turns++) {
      assert.equal(headingForRotation(normalizeRotation(angle + turns * Math.PI * 2)), heading);
    }
  }
  assert.equal(headingForRotation(0.1), undefined);
});

// Small DOM double exercises the actual navigation event handlers, without a
// backend or a browser dependency. Native pointer capture is also smoke tested.
function fixture() {
  const listeners = new Map();
  const classes = new Set();
  const button = (className, dataset = {}) => ({
    dataset, style: {}, attributes: {}, focused: false,
    classList: { contains: (name) => name === className },
    closest(selector) { return selector === 'button' || selector.split(', ').includes(`.${className}`) ? this : null; },
    focus() { this.focused = true; },
    setAttribute(key, value) { this.attributes[key] = value; },
  });
  const face = button('cube-top-face');
  const ring = { closest: (selector) => selector.includes('.cube-compass-ring') ? ring : null };
  const directions = Object.keys(VIEW_HEADINGS).map((key) => button('cube-direction', { cubeHeading: key }));
  const output = {};
  let captured = null;
  const cube = {
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
    querySelector: (selector) => selector === '.cube-top-face' ? face : output,
    querySelectorAll: () => directions,
    addEventListener: (name, listener) => listeners.set(name, [...listeners.get(name) || [], listener]),
    setPointerCapture: (id) => { captured = id; },
    hasPointerCapture: (id) => captured === id,
    releasePointerCapture: () => { captured = null; },
  };
  const state = { angle: 0, homes: 0, entered: 0 };
  bindViewCube(cube, {
    getRotation: () => state.angle,
    setRotation: (angle) => { state.angle = normalizeRotation(angle); updateViewCube(cube, state.angle); },
    home: () => { state.homes++; },
    onEnter: () => { state.entered++; },
  });
  function fire(name, extra = {}) {
    const event = { target: face, button: 0, pointerId: 1, clientX: 100, detail: 1,
      stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; }, ...extra };
    for (const listener of listeners.get(name) || []) listener(event);
    return event;
  }
  return { cube, face, ring, directions, output, state, fire, button, classes };
}

test('east up rotates compass east to the top and labels only that heading selected', () => {
  const f = fixture();
  updateViewCube(f.cube, Math.PI / 2);
  assert.equal(f.directions[1].style.top, '13px');
  assert.equal(f.directions[1].style.left, '52px');
  assert.deepEqual(f.directions.map((b) => b.attributes['aria-pressed']), ['false', 'true', 'false', 'false']);
  assert.equal(f.output.textContent, '90°');
});

test('drag rotates continuously and its following click never resets TOP', () => {
  const f = fixture();
  f.fire('pointerdown');
  f.fire('pointermove', { clientX: 150 });
  near(f.state.angle, -Math.PI / 6);
  assert.ok(f.classes.has('dragging'));
  f.fire('pointerup', { clientX: 150 });
  f.fire('click');
  near(f.state.angle, -Math.PI / 6);
  assert.ok(!f.classes.has('dragging'));
  // A later keyboard click must still reset the face.
  f.fire('click', { detail: 0 });
  near(f.state.angle, 0);
});

test('tap on captured TOP resets north; a small hand tremor is still a tap', () => {
  const f = fixture();
  f.state.angle = 1;
  f.fire('pointerdown');
  f.fire('pointermove', { clientX: 102 });
  near(f.state.angle, 1);
  f.fire('pointerup');
  near(f.state.angle, 0);
});

test('Escape, pointer cancellation and unexpected lost capture restore the start orientation', () => {
  for (const event of ['keydown', 'pointercancel', 'lostpointercapture']) {
    const f = fixture();
    f.state.angle = 0.71;
    f.fire('pointerdown');
    f.fire('pointermove', { clientX: 250 });
    f.fire(event, { key: 'Escape' });
    near(f.state.angle, 0.71);
    f.fire('pointermove', { clientX: 400 });
    near(f.state.angle, 0.71);
    assert.ok(!f.classes.has('dragging'));
  }
});

test('compass, quarter turns, Home and keyboard arrows dispatch correct view actions', () => {
  const f = fixture();
  f.fire('click', { target: f.directions[1] });
  near(f.state.angle, Math.PI / 2);
  f.fire('click', { target: f.button('cube-action', { cubeTurn: '-1' }) });
  near(f.state.angle, 0);
  f.fire('keydown', { key: 'ArrowLeft' });
  near(f.state.angle, Math.PI / 12);
  f.fire('keydown', { key: 'ArrowRight', shiftKey: true });
  near(f.state.angle, -Math.PI / 6);
  f.fire('keydown', { key: 'Home' });
  near(f.state.angle, 0);
  f.fire('click', { target: f.button('cube-home') });
  assert.equal(f.state.homes, 1);
});

test('navigation events stop before canvas handlers, including right/middle clicks and wheel', () => {
  const f = fixture();
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click', 'keydown', 'wheel', 'dblclick', 'contextmenu']) {
    assert.equal(f.fire(name).stopped, true, name);
  }
  for (const button of [1, 2]) {
    assert.equal(f.fire('pointerdown', { button }).stopped, true);
  }
  assert.equal(f.fire('wheel').prevented, true);
  f.fire('pointerenter');
  assert.equal(f.state.entered, 1);
});
