export const VIEW_HEADINGS = { N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 };

export function normalizeRotation(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function rotateWorldPoint(x, y, angle) {
  return { x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) };
}

export function rotationAroundCenter(pan, angle, nextAngle) {
  // Pan is measured in screen pixels (Y down); rotating it keeps the same
  // world point at the viewport center at any zoom, including a panned view.
  const rotated = rotateWorldPoint(pan.x, -pan.y, nextAngle - angle);
  return { x: rotated.x, y: -rotated.y };
}

export function headingForRotation(angle) {
  return Object.keys(VIEW_HEADINGS).find((key) =>
    Math.abs(normalizeRotation(angle - VIEW_HEADINGS[key])) < 1e-6);
}

export function updateViewCube(cube, angle) {
  if (!cube) return;
  cube.querySelector('.cube-top-face').style.transform = `rotate(${-angle}rad)`;
  const heading = headingForRotation(angle);
  cube.querySelectorAll('[data-cube-heading]').forEach((button) => {
    const direction = VIEW_HEADINGS[button.dataset.cubeHeading] - angle;
    button.style.left = `${52 + 39 * Math.sin(direction)}px`;
    button.style.top = `${52 - 39 * Math.cos(direction)}px`;
    button.setAttribute('aria-pressed', String(button.dataset.cubeHeading === heading));
  });
  const degrees = ((angle * 180 / Math.PI) % 360 + 360) % 360;
  cube.querySelector('.cube-angle').textContent = `${(Math.round(degrees * 10) / 10) % 360}°`;
}

export function bindViewCube(cube, { getRotation, setRotation, home, onEnter }) {
  let drag = null;
  let suppressClick = false;
  const stop = (event) => event.stopPropagation();
  // Navigation is inside the viewport DOM, but must never reach CAD pick,
  // snap, command acceptance, pan, or wheel-zoom handlers.
  ['pointermove', 'pointerup', 'wheel', 'dblclick', 'contextmenu'].forEach((name) => {
    cube.addEventListener(name, (event) => {
      stop(event);
      if (name === 'wheel' || name === 'contextmenu') event.preventDefault();
    }, { passive: false });
  });
  cube.addEventListener('pointerenter', onEnter);
  cube.addEventListener('pointerdown', (event) => {
    stop(event);
    if (event.button !== 0 || drag) return;
    suppressClick = false;
    if (!event.target.closest('.cube-top-face, .cube-compass-ring')) return;
    const control = event.target.closest('button') || cube.querySelector('.cube-top-face');
    control.focus({ preventScroll: true });
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, angle: getRotation(), moved: false,
      resetOnTap: Boolean(event.target.closest('.cube-top-face')) };
    cube.setPointerCapture(event.pointerId);
  });
  cube.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 4) return;
    drag.moved = true;
    cube.classList.add('dragging');
    setRotation(drag.angle - dx * Math.PI / 300);
  });
  const finish = (cancelled) => {
    if (!drag) return;
    const { id, angle, moved, resetOnTap } = drag;
    drag = null;
    suppressClick = moved || cancelled;
    cube.classList.remove('dragging');
    if (cancelled) setRotation(angle);
    else if (!moved && resetOnTap) setRotation(0);
    if (cube.hasPointerCapture(id)) cube.releasePointerCapture(id);
  };
  cube.addEventListener('pointerup', (event) => {
    if (drag?.id === event.pointerId) finish(false);
  });
  cube.addEventListener('pointercancel', (event) => {
    stop(event);
    if (drag?.id === event.pointerId) finish(true);
  });
  cube.addEventListener('lostpointercapture', () => finish(true));
  cube.addEventListener('click', (event) => {
    stop(event);
    if (suppressClick && event.detail !== 0) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.cubeHeading) setRotation(VIEW_HEADINGS[button.dataset.cubeHeading]);
    else if (button.dataset.cubeTurn) setRotation(getRotation() + Number(button.dataset.cubeTurn) * Math.PI / 2);
    else if (button.classList.contains('cube-home')) home();
    else if (button.classList.contains('cube-top-face')) setRotation(0);
  });
  cube.addEventListener('keydown', (event) => {
    stop(event);
    if (event.key === 'Escape' && drag) {
      event.preventDefault();
      finish(true);
    }
    if (!event.target.closest('.cube-top-face')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const step = (event.shiftKey ? 45 : 15) * Math.PI / 180;
      setRotation(getRotation() + (event.key === 'ArrowLeft' ? step : -step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setRotation(0);
    }
  });
}
