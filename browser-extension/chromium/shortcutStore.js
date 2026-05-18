// === PHASE_SHORTCUT_STORE ===
// Storage layer for KickClip's custom clip shortcut.
// Reads/writes chrome.storage.local under key 'kickclipShortcut'.
// All getters async — they fetch from storage and never cache stale values.

const STORAGE_KEY = 'kickclipShortcutV2';

export function getDefaultShortcut() {
  const isMac = navigator.platform.toUpperCase().includes('MAC') ||
                navigator.userAgent.includes('Mac');
  return isMac
    ? { ctrlKey: false, metaKey: true,  shiftKey: false, altKey: false, code: 'KeyC', display: '⌘C' }
    : { ctrlKey: true,  metaKey: false, shiftKey: false, altKey: false, code: 'KeyC', display: 'Ctrl+C' };
}

export async function getShortcut() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    if (result && result[STORAGE_KEY] && typeof result[STORAGE_KEY] === 'object') {
      return result[STORAGE_KEY];
    }
  } catch (e) {
    // ignore
  }
  return getDefaultShortcut();
}

export async function setShortcut(shortcut) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: shortcut });
    return true;
  } catch (e) {
    return false;
  }
}

// Subscribe to shortcut changes. Returns an unsubscribe function.
export function onShortcutChange(callback) {
  const listener = (changes, areaName) => {
    if (areaName !== 'local') return;
    if (!changes[STORAGE_KEY]) return;
    const newValue = changes[STORAGE_KEY].newValue;
    if (newValue && typeof newValue === 'object') {
      try { callback(newValue); } catch (e) {}
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

// Forbidden shortcuts (keydown doesn't reach the page).
// Maintained as a list of partial matchers; matchShortcut checks tag-by-tag.
export const FORBIDDEN_SHORTCUTS = Object.freeze([
  // Tab/window lifecycle
  { metaKey: true,  ctrlKey: false, shiftKey: false, altKey: false, code: 'KeyT' },  // Cmd+T
  { metaKey: true,  ctrlKey: false, shiftKey: false, altKey: false, code: 'KeyW' },  // Cmd+W
  { metaKey: true,  ctrlKey: false, shiftKey: false, altKey: false, code: 'KeyN' },  // Cmd+N
  { metaKey: true,  ctrlKey: false, shiftKey: false, altKey: false, code: 'KeyQ' },  // Cmd+Q
  { metaKey: true,  ctrlKey: false, shiftKey: true,  altKey: false, code: 'KeyN' },  // Cmd+Shift+N
  { metaKey: true,  ctrlKey: false, shiftKey: true,  altKey: false, code: 'KeyW' },  // Cmd+Shift+W
  // Windows/Linux equivalents
  { metaKey: false, ctrlKey: true,  shiftKey: false, altKey: false, code: 'KeyT' },  // Ctrl+T
  { metaKey: false, ctrlKey: true,  shiftKey: false, altKey: false, code: 'KeyW' },  // Ctrl+W
  { metaKey: false, ctrlKey: true,  shiftKey: false, altKey: false, code: 'KeyN' },  // Ctrl+N
  { metaKey: false, ctrlKey: true,  shiftKey: true,  altKey: false, code: 'KeyN' },  // Ctrl+Shift+N
  { metaKey: false, ctrlKey: true,  shiftKey: true,  altKey: false, code: 'KeyW' },  // Ctrl+Shift+W
]);

// Returns true if the shortcut matches any FORBIDDEN entry exactly.
export function isShortcutForbidden(shortcut) {
  if (!shortcut || typeof shortcut !== 'object') return false;
  return FORBIDDEN_SHORTCUTS.some(forbidden =>
    forbidden.metaKey === !!shortcut.metaKey &&
    forbidden.ctrlKey === !!shortcut.ctrlKey &&
    forbidden.shiftKey === !!shortcut.shiftKey &&
    forbidden.altKey === !!shortcut.altKey &&
    forbidden.code === shortcut.code
  );
}

// Format a shortcut object into a display string ('⌘C', 'Ctrl+Shift+B', etc.).
export function formatShortcut(shortcut) {
  if (!shortcut || typeof shortcut !== 'object') return '';
  const isMac = navigator.platform.toUpperCase().includes('MAC') ||
                navigator.userAgent.includes('Mac');
  // Strip 'Key' prefix from code like 'KeyC' → 'C'
  const keyLabel = String(shortcut.code || '').replace(/^Key/, '') ||
                   String(shortcut.code || '').replace(/^Digit/, '') ||
                   String(shortcut.code || '');
  if (isMac) {
    const parts = [];
    if (shortcut.ctrlKey) parts.push('⌃');
    if (shortcut.altKey) parts.push('⌥');
    if (shortcut.shiftKey) parts.push('⇧');
    if (shortcut.metaKey) parts.push('⌘');
    parts.push(keyLabel);
    return parts.join('');
  }
  const parts = [];
  if (shortcut.metaKey) parts.push('Meta');
  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.altKey) parts.push('Alt');
  if (shortcut.shiftKey) parts.push('Shift');
  parts.push(keyLabel);
  return parts.join('+');
}

// Check if a KeyboardEvent matches a shortcut definition.
export function matchesShortcut(event, shortcut) {
  if (!event || !shortcut) return false;
  return !!event.metaKey === !!shortcut.metaKey &&
         !!event.ctrlKey === !!shortcut.ctrlKey &&
         !!event.shiftKey === !!shortcut.shiftKey &&
         !!event.altKey === !!shortcut.altKey &&
         event.code === shortcut.code;
}
// === END PHASE_SHORTCUT_STORE ===
