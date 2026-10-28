import test from 'node:test';
import assert from 'node:assert/strict';
import { bindRibbonTabs, mountRibbonFlyouts, mountRibbonOverflow, syncRibbonControls, syncRibbonTabs } from './ribbon.js';

function control(id, tool) {
  const classes = new Set();
  return {
    id, dataset: tool ? { tool } : {}, attributes: {}, disabled: false,
    classList: {
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      contains: (name) => classes.has(name),
    },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
}

function controlsFixture() {
  const controls = ['finishPolylineBtn', 'closePolylineBtn', 'eraseBtn', 'explodeBtn',
    'ribbonToggleGrid', 'ribbonToggleSnap', 'ribbonToggleOrtho', 'ribbonToggleDynamicInput',
    'ribbonToggleCommandLine', 'showPropertiesPanel', 'showLayersPanel', 'ribbonLayerSelect']
    .map((id) => control(id));
  controls.push(control('offsetBtn', 'offset'), control('lineBtn', 'line'));
  const root = {
    querySelectorAll: (selector) => selector === '[data-tool]' ? controls.filter((c) => c.dataset.tool) : controls,
    querySelector: (selector) => controls.find((c) => c.id === selector.slice(1)),
  };
  const state = { editorActive: true, activeTool: 'select', pointCount: 0, selectionCount: 0,
    showGrid: true, snapEnabled: true, orthoEnabled: false, dynamicInputEnabled: false,
    commandbarVisible: true, propertiesVisible: true, layersVisible: true };
  return { root, state, get: (id) => root.querySelector(`#${id}`) };
}

test('Finish/Close cannot consume another command’s points; selection actions require selection', () => {
  const f = controlsFixture();
  for (const activeTool of ['select', 'line', 'spline', 'revcloud']) {
    syncRibbonControls(f.root, { ...f.state, activeTool, pointCount: 4 });
    assert.equal(f.get('finishPolylineBtn').disabled, true);
    assert.equal(f.get('closePolylineBtn').disabled, true);
  }
  for (const pointCount of [0, 1, 2, 5]) {
    syncRibbonControls(f.root, { ...f.state, activeTool: 'polyline', pointCount });
    assert.equal(f.get('finishPolylineBtn').disabled, pointCount < 2);
    assert.equal(f.get('closePolylineBtn').disabled, pointCount < 2);
  }
  syncRibbonControls(f.root, f.state);
  assert.equal(f.get('eraseBtn').disabled, true);
  assert.equal(f.get('explodeBtn').disabled, true);
  syncRibbonControls(f.root, { ...f.state, selectionCount: 2 });
  assert.equal(f.get('eraseBtn').disabled, false);
  assert.equal(f.get('explodeBtn').disabled, false);
});

test('keyboard/status changes update existing Ribbon controls, including OFFSET and drafting toggles', () => {
  const f = controlsFixture();
  const grid = f.get('ribbonToggleGrid');
  syncRibbonControls(f.root, f.state);
  assert.equal(grid.attributes['aria-pressed'], 'true');
  syncRibbonControls(f.root, { ...f.state, activeTool: 'offset', showGrid: false, snapEnabled: false, orthoEnabled: true,
    dynamicInputEnabled: true, commandbarVisible: false, propertiesVisible: false });
  assert.equal(f.get('ribbonToggleGrid'), grid);
  assert.equal(grid.classList.contains('selected'), false);
  assert.equal(grid.attributes['aria-pressed'], 'false');
  assert.equal(f.get('ribbonToggleSnap').attributes['aria-pressed'], 'false');
  assert.equal(f.get('ribbonToggleOrtho').attributes['aria-pressed'], 'true');
  assert.equal(f.get('ribbonToggleDynamicInput').attributes['aria-pressed'], 'true');
  assert.equal(f.get('ribbonToggleCommandLine').attributes['aria-pressed'], 'false');
  assert.equal(f.get('showPropertiesPanel').attributes['aria-pressed'], 'false');
  assert.equal(f.get('offsetBtn').attributes['aria-pressed'], 'true');
  assert.equal(f.get('lineBtn').attributes['aria-pressed'], 'false');
  syncRibbonControls(f.root, { ...f.state, editorActive: false, selectionCount: 3, activeTool: 'polyline', pointCount: 4 });
  assert.ok(f.root.querySelectorAll('button, input, select').every((c) => c.disabled));
});

function dispatch(target, type, source, properties = {}) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'target', { value: source });
  Object.assign(event, properties);
  target.dispatchEvent(event);
  return event;
}

test('Ribbon tabs wrap with arrows, support Home/End, maintain one tab stop and release handlers', () => {
  const names = ['home', 'draw', 'annotate', 'view', 'manage', 'output'];
  const tabs = names.map((name) => {
    const tab = control('', null);
    tab.dataset.tab = name;
    tab.closest = () => tab;
    tab.focus = () => { focused = tab; };
    return tab;
  });
  let focused = tabs[0];
  let active = 'home';
  let activations = 0;
  let activationOptions;
  let toggles = 0;
  const panel = control('ribbonContainer');
  const tabList = new EventTarget();
  tabList.querySelectorAll = () => tabs;
  tabList.contains = (tab) => tabs.includes(tab);
  const binding = bindRibbonTabs({ tabList,
    onActivate(name, options) { active = name; activationOptions = options; activations++; syncRibbonTabs(tabList, panel, active); },
    onToggleDisplay() { toggles++; },
  });
  syncRibbonTabs(tabList, panel, active);
  for (const [key, expected] of [['ArrowLeft', 'output'], ['ArrowRight', 'home'], ['End', 'output'], ['Home', 'home'], ['ArrowRight', 'draw']]) {
    const event = dispatch(tabList, 'keydown', focused, { key });
    assert.equal(event.defaultPrevented, true);
    assert.equal(active, expected);
    assert.equal(focused.dataset.tab, expected);
    assert.equal(tabs.filter((tab) => tab.tabIndex === 0).length, 1);
    assert.equal(focused.attributes['aria-selected'], 'true');
    assert.equal(panel.attributes['aria-labelledby'], focused.id);
  }
  const enterPanel = dispatch(tabList, 'keydown', focused, { key: 'ArrowDown' });
  assert.equal(enterPanel.defaultPrevented, true);
  assert.equal(activationOptions.focusPanel, true);
  assert.equal(active, 'draw');
  const before = activations;
  for (const flags of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }, { keyCode: 229 }]) {
    dispatch(tabList, 'keydown', focused, { key: 'ArrowRight', ...flags });
  }
  assert.equal(activations, before);
  dispatch(tabList, 'click', tabs[3]);
  assert.equal(active, 'view');
  dispatch(tabList, 'dblclick', tabs[3]);
  assert.equal(toggles, 1);
  binding.dispose();
  dispatch(tabList, 'click', tabs[2]);
  assert.equal(active, 'view');
});

test('overflow controls follow resize/content/scroll and reveal focused commands; disposal removes listeners', () => {
  const frame = { clientWidth: 1000 };
  const previous = new EventTarget();
  const next = new EventTarget();
  previous.hidden = next.hidden = true;
  const viewport = new EventTarget();
  viewport.scrollWidth = 1600;
  viewport.scrollLeft = 0;
  Object.defineProperty(viewport, 'clientWidth', { get: () => frame.clientWidth - (previous.hidden ? 0 : 44) });
  viewport.getBoundingClientRect = () => ({ left: 22, right: 22 + viewport.clientWidth });
  viewport.scrollBy = ({ left }) => {
    viewport.scrollLeft = Math.min(viewport.scrollWidth - viewport.clientWidth, Math.max(0, viewport.scrollLeft + left));
    viewport.dispatchEvent(new Event('scroll'));
  };
  let observer;
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = []; observer = this; }
    observe(target) { this.targets.push(target); }
    disconnect() { this.disconnected = true; }
  }
  const binding = mountRibbonOverflow({ frame, viewport, previous, next, Observer });
  assert.equal(previous.hidden, false);
  assert.equal(previous.disabled, true);
  assert.equal(next.disabled, false);
  next.dispatchEvent(new Event('click'));
  assert.equal(next.disabled, true);
  assert.equal(previous.disabled, false);
  previous.dispatchEvent(new Event('click'));
  assert.equal(viewport.scrollLeft, 0);
  dispatch(viewport, 'focusin', { getBoundingClientRect: () => ({ left: 1100, right: 1160 }) });
  assert.ok(viewport.scrollLeft > 0);
  frame.clientWidth = 1800;
  observer.callback();
  assert.equal(previous.hidden, true);
  assert.equal(next.hidden, true);
  frame.clientWidth = 1000;
  viewport.scrollWidth = 1900;
  binding.update();
  assert.equal(next.hidden, false);
  assert.deepEqual(observer.targets, [frame, viewport]);
  binding.dispose();
  const before = viewport.scrollLeft;
  next.dispatchEvent(new Event('click'));
  assert.equal(viewport.scrollLeft, before);
  assert.equal(observer.disconnected, true);
});

// A DOM tree fixture exercises live reparenting and event ownership without a
// browser dependency. Visual positioning and native WebView acceptance remain separate.
class RibbonNode extends EventTarget {
  constructor(tag, documentTarget, className = '') {
    super();
    this.tagName = tag.toUpperCase();
    this.documentTarget = documentTarget;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.className = className;
    this.classList = {
      contains: (name) => this.className.split(' ').includes(name),
      toggle: (name, enabled) => {
        const names = new Set(this.className.split(' ').filter(Boolean));
        if (enabled) names.add(name); else names.delete(name);
        this.className = [...names].join(' ');
      },
    };
    this.bounds = { left: 40, right: 240, top: 70, bottom: 100, width: 200, height: 30 };
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  matches(selector) {
    if (selector === '[data-tab]') return Boolean(this.dataset.tab);
    if (selector === 'button:not([aria-pressed])') return this.tagName === 'BUTTON' && !Object.hasOwn(this.attributes, 'aria-pressed');
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    return this.tagName === selector.toUpperCase();
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }
  querySelectorAll(selector) {
    const selectors = selector.split(',').map((item) => item.trim());
    return this.children.flatMap((child) => [
      ...(selectors.some((item) => child.matches(item)) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  contains(target) { return target === this || this.children.some((child) => child.contains(target)); }
  appendChild(node) {
    node.remove();
    this.children.push(node);
    node.parentElement = this;
    return node;
  }
  insertBefore(node, reference) {
    node.remove();
    this.children.splice(this.children.indexOf(reference), 0, node);
    node.parentElement = this;
  }
  remove() {
    if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = null;
  }
  focus() { this.documentTarget.activeElement = this; }
  getBoundingClientRect() { return this.bounds; }
}

function flyoutFixture(initialMode = 'panels') {
  const documentTarget = new EventTarget();
  documentTarget.createElement = (tag) => new RibbonNode(tag, documentTarget);
  const node = (tag = 'div', className = '') => new RibbonNode(tag, documentTarget, className);
  const app = node();
  app.bounds = { left: 0, width: 1000 };
  const tabList = app.appendChild(node());
  tabList.bounds.bottom = 72;
  for (const tab of ['home', 'draw']) {
    const item = tabList.appendChild(node('button'));
    item.dataset.tab = tab;
  }
  const frame = app.appendChild(node());
  const viewport = frame.appendChild(node());
  const groups = [0, 1].map((index) => {
    const group = viewport.appendChild(node('div', 'ribbon-group'));
    const tools = group.appendChild(node('div', 'tools'));
    const command = tools.appendChild(node('button'));
    const toggle = tools.appendChild(node('button'));
    toggle.setAttribute('aria-pressed', 'false');
    const caption = group.appendChild(node('div', 'group-caption'));
    caption.textContent = `Panel ${index}`;
    return { group, tools, command, toggle, caption };
  });
  const windowTarget = new EventTarget();
  windowTarget.innerWidth = 1000;
  windowTarget.innerHeight = 700;
  const state = { mode: initialMode, tab: 'home' };
  const binding = mountRibbonFlyouts({ app, tabList, frame, viewport, documentTarget, windowTarget,
    getMode: () => state.mode, getActiveTab: () => state.tab, panelTitle: (name) => `Open ${name}` });
  return { binding, app, tabList, frame, viewport, groups, state, documentTarget, windowTarget, node };
}

test('minimized panels reuse live controls, consume Escape once and preserve the saved display mode', () => {
  const f = flyoutFixture();
  const group = f.groups[1];
  let clicks = 0;
  group.command.addEventListener('click', () => clicks++);
  dispatch(f.viewport, 'keydown', group.caption, { key: 'Enter' });
  const popup = group.group.querySelector('.ribbon-panel-popover');
  assert.ok(popup);
  group.caption.bounds = { ...group.caption.bounds, left: 950, bottom: 690 };
  popup.bounds = { ...popup.bounds, width: 200, height: 100 };
  f.windowTarget.dispatchEvent(new Event('resize'));
  assert.equal(popup.style.left, '792px');
  assert.equal(popup.style.top, '592px');
  group.caption.bounds.left = 300;
  f.viewport.dispatchEvent(new Event('scroll'));
  assert.equal(popup.style.left, '300px');
  assert.equal(popup.querySelector('.tools'), group.tools);
  assert.equal(f.documentTarget.activeElement, group.command);
  assert.equal(group.caption.attributes['aria-expanded'], 'true');
  group.command.dispatchEvent(new Event('click'));
  assert.equal(clicks, 1);
  const escape = dispatch(f.documentTarget, 'keydown', group.command, { key: 'Escape' });
  assert.equal(escape.defaultPrevented, true);
  assert.equal(f.documentTarget.activeElement, group.caption);
  assert.equal(group.group.querySelector('.ribbon-panel-popover'), null);
  assert.equal(group.group.children[0], group.tools);
  assert.equal(f.state.mode, 'panels');
  assert.equal(dispatch(f.documentTarget, 'keydown', group.caption, { key: 'Escape' }).defaultPrevented, false);
  f.binding.dispose();
});

test('tab-only flyout positions under tabs, dismisses on outside actions and does not change the preference', () => {
  const f = flyoutFixture('tabs');
  const tab = f.tabList.children[0];
  assert.equal(f.frame.attributes['aria-hidden'], 'true');
  f.binding.openTab({ focus: true });
  assert.equal(f.app.classList.contains('ribbon-flyout-open'), true);
  assert.equal(f.frame.style.top, '72px');
  assert.equal(f.frame.style.width, '1000px');
  assert.equal(f.frame.attributes['aria-hidden'], 'false');
  assert.equal(tab.attributes['aria-expanded'], 'true');
  assert.equal(f.documentTarget.activeElement, f.groups[0].command);
  const escape = dispatch(f.documentTarget, 'keydown', f.groups[0].command, { key: 'Escape' });
  assert.equal(escape.defaultPrevented, true);
  assert.equal(f.documentTarget.activeElement, tab);
  assert.equal(f.frame.attributes['aria-hidden'], 'true');
  f.binding.openTab();
  dispatch(f.documentTarget, 'pointerdown', f.node());
  assert.equal(f.binding.isTabOpen(), false);
  f.binding.openTab();
  dispatch(f.documentTarget, 'focusin', f.node('input'));
  assert.equal(f.binding.isTabOpen(), false);
  assert.equal(f.state.mode, 'tabs');
  f.binding.dispose();
});

test('panel toggles stay open, commands close, IME does not activate captions, and re-render restores only the same tab', () => {
  const f = flyoutFixture();
  const group = f.groups[0];
  dispatch(f.viewport, 'keydown', group.caption, { key: 'Enter', isComposing: true });
  assert.equal(group.group.querySelector('.ribbon-panel-popover'), null);
  dispatch(f.viewport, 'click', group.caption);
  dispatch(f.viewport, 'click', group.toggle);
  assert.ok(group.group.querySelector('.ribbon-panel-popover'));
  const saved = f.binding.beforeRender();
  assert.equal(group.group.children[0], group.tools);
  f.binding.restore(saved);
  assert.ok(group.group.querySelector('.ribbon-panel-popover'));
  dispatch(f.viewport, 'click', group.command);
  assert.equal(group.group.querySelector('.ribbon-panel-popover'), null);
  assert.equal(f.documentTarget.activeElement, group.caption);
  f.binding.openGroup(0);
  const previousTab = f.binding.beforeRender();
  f.state.tab = 'draw';
  f.binding.restore(previousTab);
  assert.equal(group.group.querySelector('.ribbon-panel-popover'), null);
  f.binding.openGroup(1);
  f.binding.dispose();
  assert.equal(f.groups[1].group.children[0], f.groups[1].tools);
  dispatch(f.viewport, 'click', group.caption);
  assert.equal(group.group.querySelector('.ribbon-panel-popover'), null);
});

test('changing display modes relocates focus away from hidden commands', () => {
  const f = flyoutFixture('expanded');
  const group = f.groups[1];
  group.command.focus();
  f.state.mode = 'panels';
  f.binding.update();
  assert.equal(f.documentTarget.activeElement, group.caption);
  group.command.focus();
  f.state.mode = 'tabs';
  f.binding.update();
  assert.equal(f.documentTarget.activeElement, f.tabList.children[0]);
  f.state.mode = 'expanded';
  f.binding.update();
  assert.equal(group.caption.attributes.role, undefined);
  assert.equal(f.frame.attributes['aria-hidden'], 'false');
  f.binding.dispose();
});
