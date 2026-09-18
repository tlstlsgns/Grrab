import {
  getShortcut,
  setShortcut,
  isShortcutForbidden,
  formatShortcut,
  onShortcutChange,
} from './shortcutStore.js';

// ─────────── Clip Shortcut recorder (mirrors the sidepanel recorder) ───────────
const scBtn = document.getElementById('pp-shortcut-btn');

let _recording = false;
let _prior = null;
let _keyListener = null;
let _outsideListener = null;

function renderChip(sc) {
  scBtn.textContent = formatShortcut(sc);
  scBtn.classList.remove('recording', 'error');
}
function isModifierOnly(e) {
  return e.key === 'Meta' || e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'AltGraph';
}
function showScError(msg) {
  scBtn.textContent = msg;
  scBtn.classList.add('error');
  scBtn.classList.remove('recording');
}
function setRecording(on) {
  _recording = on;
  if (on) { scBtn.classList.add('recording'); scBtn.classList.remove('error'); scBtn.textContent = 'Press a key…'; }
  else { scBtn.classList.remove('recording'); }
}
function stopRecording(saved, savedShortcut) {
  if (!_recording) return;
  if (_keyListener) { document.removeEventListener('keydown', _keyListener, true); _keyListener = null; }
  if (_outsideListener) {
    document.removeEventListener('pointerdown', _outsideListener, true);
    _outsideListener = null;
  }
  setRecording(false);
  if (saved && savedShortcut) renderChip(savedShortcut);
  else if (!saved && _prior) renderChip(_prior);
  _prior = null;
}
function startRecording() {
  if (_recording) return;
  getShortcut().then((cur) => {
    _prior = cur;
    setRecording(true);
    _keyListener = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); stopRecording(false); return; }
      if (isModifierOnly(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const candidate = {
        metaKey: !!event.metaKey,
        ctrlKey: !!event.ctrlKey,
        shiftKey: !!event.shiftKey,
        altKey: !!event.altKey,
        code: event.code,
        display: '',
      };
      if (!candidate.metaKey && !candidate.ctrlKey) { showScError('⌘ or Ctrl + key'); return; }
      if (isShortcutForbidden(candidate)) { showScError('This shortcut is unavailable'); return; }
      candidate.display = formatShortcut(candidate);
      setShortcut(candidate).then((ok) => {
        if (!ok) { showScError('Failed to save'); return; }
        stopRecording(true, candidate);
      });
    };
    document.addEventListener('keydown', _keyListener, true);

    _outsideListener = (ev) => {
      const t = ev.target;
      if (scBtn && (t === scBtn || scBtn.contains(t))) return;
      stopRecording(false);
    };
    document.addEventListener('pointerdown', _outsideListener, true);
  });
}
scBtn.addEventListener('click', (e) => { e.stopPropagation(); if (_recording) stopRecording(false); else startRecording(); });
getShortcut().then(renderChip);
onShortcutChange(() => { if (!_recording) getShortcut().then(renderChip); });

// ─────────── Clip Effect switch (shares kc_clip_effect with the sidepanel) ───────────
const KC_CLIP_EFFECT_KEY = 'kc_clip_effect';
const KC_CLIP_EFFECT_VALUES = ['none', 'erase'];
const ceNote = document.getElementById('pp-clip-mode-note');

function ceNormalize(v) {
  const s = String(v ?? '').trim();
  if (s === 'bg-remove') return 'erase';
  return KC_CLIP_EFFECT_VALUES.includes(s) ? s : 'none';
}

function _clipEffectToDataMode(key) {
  return ceNormalize(key) === 'erase' ? 'editor' : 'instant';
}

function _dataModeToClipEffect(dataMode) {
  return dataMode === 'editor' ? 'erase' : 'none';
}

function ceRender(value) {
  const key = ceNormalize(value);
  const sw = document.getElementById('kc-clip-effect-switch');
  if (!sw) return;
  const uiMode = _clipEffectToDataMode(key);
  sw.setAttribute('data-mode', uiMode);
  const tabs = sw.querySelectorAll('[role="tab"]');
  for (const tab of tabs) {
    const tabMode = tab.getAttribute('data-mode');
    tab.setAttribute('aria-selected', tabMode === uiMode ? 'true' : 'false');
  }
}

async function ceSelect(value) {
  const key = ceNormalize(value);
  if (key === 'erase') {
    let signedIn = false;
    try {
      const r = await chrome.storage.local.get('kickclipUserId');
      signedIn = !!r?.kickclipUserId;
    } catch (_) {}
    if (!signedIn) {
      ceNote.hidden = false;
      ceRender('none');
      return;
    }
  }
  ceNote.hidden = true;
  try { await chrome.storage.local.set({ [KC_CLIP_EFFECT_KEY]: key }); } catch (_) {}
  ceRender(key);
}

document.getElementById('kc-clip-effect-switch')?.addEventListener('click', (e) => {
  const sw = document.getElementById('kc-clip-effect-switch');
  const tab = e.target.closest('[role="tab"]');
  if (!sw || !tab || !sw.contains(tab)) return;
  e.stopPropagation();
  const dataMode = tab.getAttribute('data-mode');
  if (!dataMode) return;
  ceSelect(_dataModeToClipEffect(dataMode));
});

const KC_ACTIVE_ENABLED_KEY = 'kc_active_enabled';
const activeToggle = document.getElementById('pp-active-toggle');

function _ppEnableSwitchTransitions() {
  requestAnimationFrame(() => {
    void document.body.offsetHeight;
    document.body.classList.add('kc-ready');
  });
}

async function _ppHydrateSwitchesFromStorage() {
  let clipKey = 'none';
  let activeOn = true;
  try {
    const r = await chrome.storage.local.get([KC_CLIP_EFFECT_KEY, KC_ACTIVE_ENABLED_KEY]);
    clipKey = ceNormalize(r?.[KC_CLIP_EFFECT_KEY]);
    activeOn = !(r && r[KC_ACTIVE_ENABLED_KEY] === false);
  } catch (_) {}
  ceRender(clipKey);
  if (activeToggle) activeToggle.checked = activeOn;
  _ppEnableSwitchTransitions();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[KC_CLIP_EFFECT_KEY]) ceRender(ceNormalize(changes[KC_CLIP_EFFECT_KEY].newValue));
});

// ─────────── Header auth + open SidePanel ───────────
const KC_USER_ID_KEY = 'kickclipUserId';
const KC_USER_PHOTO_KEY = 'kickclipUserPhoto';
const KC_USER_PHOTO_DATA_URL_KEY = 'kickclipUserPhotoDataUrl';
const ppHeaderSignIn = document.getElementById('pp-header-sign-in');
const ppHeaderAvatar = document.getElementById('pp-header-avatar');

let _winId = null;
try { chrome.windows.getCurrent().then((w) => { _winId = (w && w.id != null) ? w.id : null; }); } catch (_) {}

function openSidePanelAndClose() {
  try {
    const opts = (_winId != null) ? { windowId: _winId } : {};
    const p = chrome.sidePanel.open(opts);
    if (p && p.then) p.then(() => window.close(), () => window.close());
    else window.close();
  } catch (_) { window.close(); }
}

function renderHeaderAuth(userId, photoURL, photoDataUrl) {
  const signedIn = !!userId;
  if (ppHeaderSignIn) {
    ppHeaderSignIn.hidden = signedIn;
    ppHeaderSignIn.style.display = signedIn ? 'none' : '';
  }
  if (!ppHeaderAvatar) return;
  const dataSrc = typeof photoDataUrl === 'string' ? photoDataUrl.trim() : '';
  const photo = typeof photoURL === 'string' ? photoURL.trim() : '';
  const src = dataSrc || photo;
  if (signedIn && src) {
    ppHeaderAvatar.src = src;
    ppHeaderAvatar.hidden = false;
    ppHeaderAvatar.style.display = '';
  } else {
    ppHeaderAvatar.removeAttribute('src');
    ppHeaderAvatar.hidden = true;
    ppHeaderAvatar.style.display = 'none';
  }
}

async function refreshHeaderAuth() {
  try {
    const r = await chrome.storage.local.get([
      KC_USER_ID_KEY,
      KC_USER_PHOTO_KEY,
      KC_USER_PHOTO_DATA_URL_KEY,
    ]);
    renderHeaderAuth(
      r?.[KC_USER_ID_KEY],
      r?.[KC_USER_PHOTO_KEY],
      r?.[KC_USER_PHOTO_DATA_URL_KEY],
    );
  } catch (_) {
    renderHeaderAuth(null, null, null);
  }
}

refreshHeaderAuth();
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!changes[KC_USER_ID_KEY] && !changes[KC_USER_PHOTO_KEY] && !changes[KC_USER_PHOTO_DATA_URL_KEY]) return;
    refreshHeaderAuth();
  });
} catch (_) {}

if (ppHeaderSignIn) {
  ppHeaderSignIn.addEventListener('click', () => openSidePanelAndClose());
}
document.getElementById('pp-open-sidepanel').addEventListener('click', () => openSidePanelAndClose());

// ─────────── Active toggle (master on/off for activeCoreItem) ───────────
activeToggle.addEventListener('change', () => {
  try { chrome.storage.local.set({ [KC_ACTIVE_ENABLED_KEY]: !!activeToggle.checked }); } catch (_) {}
});
_ppHydrateSwitchesFromStorage();
