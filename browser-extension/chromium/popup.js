import {
  getShortcut,
  setShortcut,
  getDefaultShortcut,
  isShortcutForbidden,
  formatShortcut,
  onShortcutChange,
} from './shortcutStore.js';

// ─────────── Clip Shortcut recorder (mirrors the sidepanel recorder) ───────────
const scBtn = document.getElementById('pp-shortcut-btn');
const scReset = document.getElementById('pp-shortcut-reset');
let _recording = false;
let _prior = null;
let _keyListener = null;

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
  });
}
scBtn.addEventListener('click', (e) => { e.stopPropagation(); if (_recording) stopRecording(false); else startRecording(); });
scReset.addEventListener('click', (e) => {
  e.stopPropagation();
  setShortcut(getDefaultShortcut()).then(() => getShortcut().then(renderChip));
});
getShortcut().then(renderChip);
onShortcutChange(() => { if (!_recording) getShortcut().then(renderChip); });

// ─────────── Clip Size dropdown (shares kc_clip_max_dim with the sidepanel) ───────────
const KC_CLIP_SIZE_KEY = 'kc_clip_max_dim';
const KC_CLIP_SIZE_VALUES = ['0', '512', '1024', '1600', '2880'];
const KC_CLIP_SIZE_LABELS = { '0': 'Original', '512': '512px', '1024': '1024px', '1600': '1600px', '2880': '3K' };
const csBtn = document.getElementById('pp-clip-size-btn');
const csMenu = document.getElementById('pp-clip-size-menu');
let _csOpen = false;
let _csOutside = null;

function csNormalize(v) { const s = String(v ?? '').trim(); return KC_CLIP_SIZE_VALUES.includes(s) ? s : '0'; }
function csRender(value) {
  const key = csNormalize(value);
  csBtn.innerHTML = '<span class="kc-dropdown-btn-label">' + (KC_CLIP_SIZE_LABELS[key] || 'Original') + '</span>';
  csBtn.dataset.size = key;
  csBtn.setAttribute('aria-expanded', _csOpen ? 'true' : 'false');
  csMenu.innerHTML = '';
  for (const preset of KC_CLIP_SIZE_VALUES) {
    const li = document.createElement('li');
    li.className = 'kc-dropdown-menu-item';
    if (preset === key) li.classList.add('kc-dropdown-menu-item-selected');
    li.setAttribute('role', 'option');
    li.textContent = KC_CLIP_SIZE_LABELS[preset];
    li.addEventListener('click', (e) => { e.stopPropagation(); csSelect(preset); });
    csMenu.appendChild(li);
  }
}
function csClose() {
  if (!_csOpen) return;
  _csOpen = false; csMenu.hidden = true; csBtn.setAttribute('aria-expanded', 'false');
  if (_csOutside) { document.removeEventListener('click', _csOutside, true); _csOutside = null; }
}
function csOpen() {
  _csOpen = true; csMenu.hidden = false; csBtn.setAttribute('aria-expanded', 'true');
  csRender(csBtn.dataset.size || '0');
  _csOutside = (e) => { const wrap = csBtn.parentNode; if (wrap && !wrap.contains(e.target)) csClose(); };
  setTimeout(() => { if (_csOpen) document.addEventListener('click', _csOutside, true); }, 0);
}
function csSelect(value) {
  const key = csNormalize(value);
  try { chrome.storage.local.set({ [KC_CLIP_SIZE_KEY]: Number(key) }); } catch (_) {}
  csRender(key);
  csClose();
}
csBtn.addEventListener('click', (e) => { e.stopPropagation(); if (_csOpen) csClose(); else csOpen(); });
try {
  chrome.storage.local.get(KC_CLIP_SIZE_KEY).then((r) => csRender(String(Number(r && r[KC_CLIP_SIZE_KEY]) || 0)));
} catch (_) { csRender('0'); }
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[KC_CLIP_SIZE_KEY]) csRender(String(Number(changes[KC_CLIP_SIZE_KEY].newValue) || 0));
});

// ─────────── Open SidePanel ───────────
let _winId = null;
try { chrome.windows.getCurrent().then((w) => { _winId = (w && w.id != null) ? w.id : null; }); } catch (_) {}
document.getElementById('pp-open-sidepanel').addEventListener('click', () => {
  try {
    const opts = (_winId != null) ? { windowId: _winId } : {};
    const p = chrome.sidePanel.open(opts);
    if (p && p.then) p.then(() => window.close(), () => window.close());
    else window.close();
  } catch (_) { window.close(); }
});

// ─────────── Active toggle (master on/off for activeCoreItem) ───────────
const KC_ACTIVE_ENABLED_KEY = 'kc_active_enabled';
const activeToggle = document.getElementById('pp-active-toggle');
try {
  chrome.storage.local.get(KC_ACTIVE_ENABLED_KEY).then((r) => {
    activeToggle.checked = !(r && r[KC_ACTIVE_ENABLED_KEY] === false); // default ON when unset
  });
} catch (_) { activeToggle.checked = true; }
activeToggle.addEventListener('change', () => {
  try { chrome.storage.local.set({ [KC_ACTIVE_ENABLED_KEY]: !!activeToggle.checked }); } catch (_) {}
});
