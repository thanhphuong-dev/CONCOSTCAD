// Keep Ribbon state in sync without rebuilding the focused controls.
export function syncRibbonControls(root, state) {
  if (!root) return;
  for (const control of root.querySelectorAll('button, input, select')) {
    control.disabled = !state.editorActive;
  }
  for (const control of root.querySelectorAll('[data-tool]')) {
    const selected = state.editorActive && control.dataset.tool === state.activeTool;
    control.classList.toggle('selected', selected);
    control.setAttribute('aria-pressed', String(selected));
  }
  const toggles = {
    ribbonToggleGrid: state.showGrid,
    ribbonToggleSnap: state.snapEnabled,
    ribbonToggleOrtho: state.orthoEnabled,
    ribbonToggleDynamicInput: state.dynamicInputEnabled,
    ribbonToggleCommandLine: state.commandbarVisible,
    showPropertiesPanel: state.propertiesVisible,
    showLayersPanel: state.layersVisible,
  };
  for (const [id, pressed] of Object.entries(toggles)) {
    const control = root.querySelector(`#${id}`);
    control?.classList.toggle('selected', Boolean(pressed));
    control?.setAttribute('aria-pressed', String(Boolean(pressed)));
  }
  for (const id of ['finishPolylineBtn', 'closePolylineBtn']) {
    const control = root.querySelector(`#${id}`);
    if (control) control.disabled = !state.editorActive || state.activeTool !== 'polyline' || state.pointCount < 2;
  }
  for (const id of ['eraseBtn', 'explodeBtn']) {
    const control = root.querySelector(`#${id}`);
    if (control) control.disabled = !state.editorActive || state.selectionCount === 0;
  }
}

export function syncRibbonTabs(tabList, panel, activeTab) {
  if (!tabList || !panel) return;
  for (const tab of tabList.querySelectorAll('[data-tab]')) {
    const selected = tab.dataset.tab === activeTab;
    tab.classList.toggle('active', selected);
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(selected));
    tab.setAttribute('aria-controls', panel.id);
    tab.id = `ribbon-tab-${tab.dataset.tab}`;
    tab.tabIndex = selected ? 0 : -1;
    if (selected) panel.setAttribute('aria-labelledby', tab.id);
  }
}

export function bindRibbonTabs({ tabList, onActivate, onToggleDisplay }) {
  const controller = new AbortController();
  const { signal } = controller;
  tabList.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]');
    if (tab && tabList.contains(tab)) onActivate(tab.dataset.tab, { toggle: true, focusPanel: event.detail === 0 });
  }, { signal });
  tabList.addEventListener('dblclick', (event) => {
    if (event.target.closest('[data-tab]')) onToggleDisplay();
  }, { signal });
  tabList.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.altKey || event.metaKey) return;
    const tab = event.target.closest('[data-tab]');
    const tabs = Array.from(tabList.querySelectorAll('[data-tab]'));
    const index = tabs.indexOf(tab);
    if (index < 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      onActivate(tab.dataset.tab, { focusPanel: true });
      return;
    }
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    event.stopPropagation();
    onActivate(tabs[nextIndex].dataset.tab);
    tabs[nextIndex].focus({ preventScroll: true });
  }, { signal });
  return { dispose: () => controller.abort() };
}

function focusFirstControl(root) {
  const control = Array.from(root.querySelectorAll('button, input, select')).find((item) => !item.disabled);
  (control || root).focus({ preventScroll: true });
}

// Minimized ribbons open transiently. Moving a panel's tools preserves its live
// handlers and state; it is restored before a render or when the flyout closes.
export function mountRibbonFlyouts({ app, tabList, frame, viewport, getMode, getActiveTab,
  panelTitle, documentTarget = document, windowTarget = window }) {
  const controller = new AbortController();
  const { signal } = controller;
  let opened = null;
  const captions = () => Array.from(viewport.querySelectorAll('.group-caption'));
  const selectedTab = () => Array.from(tabList.querySelectorAll('[data-tab]')).find((tab) => tab.dataset.tab === getActiveTab());
  const position = () => {
    if (!opened) return;
    if (opened.kind === 'tab') {
      const tabsBounds = tabList.getBoundingClientRect();
      const appBounds = app.getBoundingClientRect();
      frame.style.top = `${tabsBounds.bottom}px`;
      frame.style.left = `${appBounds.left}px`;
      frame.style.width = `${appBounds.width}px`;
    } else {
      const anchor = opened.trigger.getBoundingClientRect();
      const bounds = opened.popup.getBoundingClientRect();
      opened.popup.style.left = `${Math.max(8, Math.min(anchor.left, windowTarget.innerWidth - bounds.width - 8))}px`;
      opened.popup.style.top = `${Math.max(8, Math.min(anchor.bottom, windowTarget.innerHeight - bounds.height - 8))}px`;
    }
  };
  const updateAria = () => {
    const mode = getMode();
    frame.setAttribute('aria-hidden', String(mode === 'tabs' && opened?.kind !== 'tab'));
    for (const tab of tabList.querySelectorAll('[data-tab]')) {
      if (mode === 'tabs') tab.setAttribute('aria-expanded', String(opened?.kind === 'tab' && tab === opened.trigger));
      else tab.removeAttribute('aria-expanded');
    }
  };
  const close = ({ restoreFocus = false } = {}) => {
    if (!opened) return;
    const previous = opened;
    opened = null;
    app.classList.toggle('ribbon-flyout-open', false);
    if (previous.kind === 'group') {
      previous.group.insertBefore(previous.tools, previous.trigger);
      previous.popup.remove();
      previous.trigger.setAttribute('aria-expanded', 'false');
    } else {
      frame.style.top = frame.style.left = frame.style.width = '';
    }
    updateAria();
    if (restoreFocus) previous.trigger.focus({ preventScroll: true });
  };
  const openTab = ({ focus = false } = {}) => {
    if (getMode() !== 'tabs') return;
    const trigger = selectedTab();
    if (!trigger) return;
    close();
    opened = { kind: 'tab', trigger, tab: getActiveTab() };
    app.classList.toggle('ribbon-flyout-open', true);
    updateAria();
    position();
    if (focus) focusFirstControl(viewport);
  };
  const openGroup = (index, { focus = true } = {}) => {
    if (getMode() !== 'panels') return;
    const trigger = captions()[index];
    const group = trigger?.closest('.ribbon-group');
    const tools = group?.querySelector('.tools');
    if (!tools) return;
    close();
    const popup = documentTarget.createElement('div');
    popup.className = 'ribbon-panel-popover';
    popup.id = `ribbon-panel-popover-${index}`;
    popup.tabIndex = -1;
    popup.setAttribute('role', 'group');
    popup.setAttribute('aria-labelledby', trigger.id);
    group.appendChild(popup);
    popup.appendChild(tools);
    opened = { kind: 'group', trigger, group, tools, popup, index, tab: getActiveTab() };
    trigger.setAttribute('aria-expanded', 'true');
    position();
    if (focus) focusFirstControl(popup);
  };
  const update = () => {
    if (opened && ((opened.kind === 'tab' && getMode() !== 'tabs') || (opened.kind === 'group' && getMode() !== 'panels'))) close();
    for (const [index, caption] of captions().entries()) {
      if (getMode() === 'panels') {
        caption.id = `ribbon-panel-caption-${index}`;
        caption.setAttribute('role', 'button');
        caption.tabIndex = 0;
        caption.title = panelTitle(caption.textContent.trim());
        caption.setAttribute('aria-controls', `ribbon-panel-popover-${index}`);
        caption.setAttribute('aria-expanded', String(opened?.trigger === caption));
      } else {
        for (const attr of ['role', 'tabindex', 'title', 'aria-controls', 'aria-expanded']) caption.removeAttribute(attr);
      }
    }
    updateAria();
    // A display-mode change must not leave keyboard focus in hidden tools.
    const focused = documentTarget.activeElement;
    if (!opened && viewport.contains(focused)) {
      if (getMode() === 'tabs') selectedTab()?.focus({ preventScroll: true });
      else if (getMode() === 'panels' && !focused.closest('.group-caption')) focused.closest('.ribbon-group')?.querySelector('.group-caption')?.focus({ preventScroll: true });
    }
    position();
  };
  const toggleCaption = (caption) => {
    if (opened?.trigger === caption) close({ restoreFocus: true });
    else openGroup(captions().indexOf(caption));
  };
  viewport.addEventListener('click', (event) => {
    const caption = event.target.closest('.group-caption');
    if (caption && getMode() === 'panels') toggleCaption(caption);
    else if (opened && event.target.closest('button:not([aria-pressed])')) close({ restoreFocus: true });
  }, { signal });
  viewport.addEventListener('keydown', (event) => {
    if (event.isComposing || event.keyCode === 229 || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    const caption = event.target.closest('.group-caption');
    if (caption && getMode() === 'panels' && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      toggleCaption(caption);
    }
  }, { signal });
  const isInside = (target) => tabList.contains(target) || frame.contains(target);
  documentTarget.addEventListener('pointerdown', (event) => { if (opened && !isInside(event.target)) close(); }, { signal });
  documentTarget.addEventListener('focusin', (event) => { if (opened && !isInside(event.target)) close(); }, { signal });
  documentTarget.addEventListener('keydown', (event) => {
    if (!opened || event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close({ restoreFocus: true });
  }, { signal });
  windowTarget.addEventListener('resize', position, { signal });
  viewport.addEventListener('scroll', position, { signal });
  update();
  return {
    update, close, openTab, openGroup,
    focusPanel() {
      if (getMode() === 'tabs') openTab({ focus: true });
      else if (getMode() === 'panels') openGroup(0);
      else focusFirstControl(viewport);
    },
    isTabOpen: () => opened?.kind === 'tab',
    beforeRender() {
      const saved = opened ? { kind: opened.kind, index: opened.index, tab: opened.tab } : null;
      close();
      return saved;
    },
    restore(saved) {
      update();
      if (saved?.tab !== getActiveTab()) return;
      if (saved?.kind === 'tab') openTab();
      else if (saved?.kind === 'group') openGroup(saved.index, { focus: false });
    },
    dispose() { close(); controller.abort(); },
  };
}

export function mountRibbonOverflow({ frame, viewport, previous, next, Observer = ResizeObserver }) {
  const controller = new AbortController();
  const { signal } = controller;
  const update = () => {
    const overflow = viewport.scrollWidth > frame.clientWidth + 1;
    previous.hidden = next.hidden = !overflow;
    previous.disabled = !overflow || viewport.scrollLeft <= 1;
    next.disabled = !overflow || viewport.scrollLeft >= viewport.scrollWidth - viewport.clientWidth - 1;
  };
  previous.addEventListener('click', () => viewport.scrollBy({ left: -viewport.clientWidth * 0.8, behavior: 'smooth' }), { signal });
  next.addEventListener('click', () => viewport.scrollBy({ left: viewport.clientWidth * 0.8, behavior: 'smooth' }), { signal });
  viewport.addEventListener('scroll', update, { signal });
  viewport.addEventListener('focusin', (event) => {
    if (event.target.closest?.('.ribbon-panel-popover')) return;
    const bounds = viewport.getBoundingClientRect();
    const focused = event.target.getBoundingClientRect();
    if (focused.left < bounds.left) viewport.scrollBy({ left: focused.left - bounds.left });
    else if (focused.right > bounds.right) viewport.scrollBy({ left: focused.right - bounds.right });
  }, { signal });
  const observer = new Observer(update);
  observer.observe(frame);
  observer.observe(viewport);
  update();
  return {
    update,
    dispose() { controller.abort(); observer.disconnect(); },
  };
}
