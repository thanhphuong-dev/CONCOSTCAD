// Browser-only fixture for keyboard, focus and shell lifecycle checks.
// Not imported by the production entrypoint; does not validate Rust/DWG behavior.
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';

const snapshot = {
  documentId: 1, documents: [{ id: 1, title: 'UI smoke fixture', dirty: false }],
  title: 'UI smoke fixture', dirty: false, entityCount: 1, currentLayer: '0',
  layers: [{ handle: '1', name: '0', frozen: false, off: false, locked: false, color: '#79c9dc' }],
  entities: [{ kind: 'line', handle: '2', layer: '0', x1: -100, y1: 0, x2: 100, y2: 0 }],
};
const calls = new Map();
mockWindows('main');
mockIPC((command, args) => {
  if (command.startsWith('plugin:window|')) return null;
  calls.set(command, (calls.get(command) || 0) + 1);
  document.querySelector('#smokeBridge').textContent = `UI smoke fixture · Rust IPC mocked · ${[...calls].map(([name, count]) => `${name}:${count}`).join(' · ')}`;
  switch (command) {
    case 'get_snapshot': case 'undo': case 'redo': return structuredClone(snapshot);
    case 'hit_test_entity':
      return Math.abs(args.y) <= args.tolerance && args.x >= -100 - args.tolerance && args.x <= 100 + args.tolerance ? '2' : null;
    case 'update_line':
      Object.assign(snapshot.entities[0], { x1: args.x1, y1: args.y1, x2: args.x2, y2: args.y2 });
      return structuredClone(snapshot);
    case 'erase_entities':
      throw new Error('UI smoke: unexpected ERASE; check focused-field keyboard routing');
    default: throw new Error(`UI smoke does not implement ${command}`);
  }
}, { shouldMockEvents: true });

await import('../src-ui/main.js');
