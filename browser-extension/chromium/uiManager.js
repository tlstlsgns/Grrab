/**
 * UI highlight and tooltip DOM logic.
 * Handles purple highlight, green candidate outlines, metadata tooltip, and core selection.
 */

import { state } from './stateLite.js';
import { BRAND } from './brandConfig.js';

const PURPLE_OVERLAY_ID = 'kickclip-highlight-overlay';
const CORE_BADGE_ID = 'kickclip-status-badge-core';
// Externally-registered status_badge texts. Set once at content-script
// init (and refreshed if the keyboard shortcut changes). Keeps text
// decisions out of uiManager — text composition (which depends on
// platform-specific shortcut formatting) lives in coreEntry.
let _coreBadgeDefaultText = '';
// === PHASE_BADGE_ANCHOR_OVERLAY ===
// Target viewport x of the badge's RIGHT edge (overlay right − inset), stored
// by positionCoreStatusBadgeToOverlay so setCoreStatusBadgeText can re-pin the
// right edge (via a viewport-coord left) when clip-time text changes the badge
// width — without depending on innerWidth or a fixed containing block.
let _badgeAnchorRightX = null;
// === END PHASE_BADGE_ANCHOR_OVERLAY ===
let _coreBadgeFailedText = '';

// ── Debug flag ────────────────────────────────────────────────────────────
// Set to true to show ItemMap candidate outlines (green/red/blue) for debugging.
// Set to false to disable all debug outlines in production.
const ITEMMAP_DEBUG_OUTLINES = false;

let _activeCoreHighlightItem = null; // tracks which coreItem is currently highlighted
let _kcHideResetHandle = null; // deferred clip/transform clear after hide fade-out

function _kcCancelHideReset() {
  if (!_kcHideResetHandle) return;
  const { timer, overlay, onTransitionEnd } = _kcHideResetHandle;
  if (timer) clearTimeout(timer);
  if (overlay && onTransitionEnd) {
    try { overlay.removeEventListener('transitionend', onTransitionEnd); } catch (_) {}
  }
  _kcHideResetHandle = null;
}

function _kcResetOverlayVisualState(overlay) {
  if (!overlay || parseFloat(overlay.style.opacity) !== 0) return;
  overlay.style.transform = '';
  overlay.style.transformOrigin = '';
  overlay.style.clipPath = '';
  overlay.classList.remove('kickclip-clipped');
}

function _kcScheduleHideReset(overlay) {
  _kcCancelHideReset();
  const finish = () => {
    _kcCancelHideReset();
    _kcResetOverlayVisualState(overlay);
  };
  const onTransitionEnd = (e) => {
    if (e.target !== overlay || e.propertyName !== 'opacity') return;
    finish();
  };
  try { overlay.addEventListener('transitionend', onTransitionEnd); } catch (_) {}
  const timer = setTimeout(finish, 250);
  _kcHideResetHandle = { timer, overlay, onTransitionEnd };
}

// ─────────────────────────────────────────────────────────────────────────
// Shadow DOM host — single isolation boundary for all injected UI
// ─────────────────────────────────────────────────────────────────────────
//
// All KickClip UI (highlights, badges, tooltips, etc.) will live inside a
// Shadow DOM attached to a single host element on the page. This isolates
// our styles from the hosting page's CSS (e.g. flaticon.com's global
// `body > * { width: 100% }` rule that was stretching our badge to the
// full viewport width).
//
// The host is a minimal <div id="kickclip-shadow-host"> appended to document.body.
// Only this empty host is exposed to page CSS; everything meaningful lives
// inside the closed shadow root and is unreachable from page scripts.
//
// NOTE: As of this phase (Phase 2), the shadow root is created but empty.
// UI elements are still rendered in document.body. Migration happens in Phase 3.

const KC_SHADOW_HOST_ID = 'kickclip-shadow-host';
let _kcShadowRoot = null;
let _kcShadowHost = null; // host element ref for re-attach (PHASE_SHADOW_HOST_REATTACH)

/**
 * Returns the KickClip shadow root, creating the host + shadow if needed.
 * Idempotent — safe to call multiple times.
 *
 * The host element itself uses fixed positioning with zero size and
 * pointer-events: none, so it cannot affect page layout or intercept clicks.
 * Child elements inside the shadow root handle their own positioning and
 * pointer events as needed.
 */
export function getKCShadowRoot() {
  if (_kcShadowRoot) {
    // === PHASE_SHADOW_HOST_REATTACH ===
    // SPA hydration (e.g. Pinterest) can replace body content AFTER
    // content-script init and remove our host from the DOM. The closed
    // shadow root, injected stylesheet, and overlay element all survive
    // on the detached host element — re-appending the same host fully
    // restores rendering. Validated on every call so repeated page
    // wipes are re-healed on the next overlay render.
    if (_kcShadowHost && !_kcShadowHost.isConnected) {
      try {
        (document.body || document.documentElement).appendChild(_kcShadowHost);
      } catch (e) { /* defensive: body may be mid-replacement */ }
    }
    // === END PHASE_SHADOW_HOST_REATTACH ===
    return _kcShadowRoot;
  }

  let host = document.getElementById(KC_SHADOW_HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = KC_SHADOW_HOST_ID;
    // The host itself is invisible and non-interactive. Inner children
    // restore pointer-events when needed (e.g. tooltips, highlights).
    host.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 0',
      'height: 0',
      'pointer-events: none',
      'z-index: 2147483647',
    ].join(';');
    // Append to body if available, else documentElement (edge cases where
    // body is replaced by the page).
    (document.body || document.documentElement).appendChild(host);
  }

  _kcShadowHost = host;
  _kcShadowRoot = host.shadowRoot || host.attachShadow({ mode: 'closed' });
  return _kcShadowRoot;
}

/**
 * Lookup an element by id inside the KickClip shadow root.
 * Returns null if not found.
 */
export function getKCShadowElement(id) {
  const root = getKCShadowRoot();
  return root.getElementById ? root.getElementById(id) : root.querySelector(`#${id}`);
}

// === PHASE_BADGE_SHADOW_SEPARATE ===
// Status badge and metadata tooltip live in a SEPARATE shadow host so
// their compositor layer is independent of #kickclip-shadow-host's
// dynamic z-index (PHASE_OVERLAY_STACKING_ZINDEX in showCoreHighlight
// lowers the main host below sticky headers; the badge should stay on
// top regardless). The badge host's z-index is fixed at max and never
// modified at runtime.
const KC_BADGE_SHADOW_HOST_ID = 'kickclip-badge-shadow-host';
let _kcBadgeShadowRoot = null;
let _kcBadgeShadowHost = null; // host element ref for re-attach (PHASE_SHADOW_HOST_REATTACH)

function getKCBadgeShadowRoot() {
  if (_kcBadgeShadowRoot) {
    // PHASE_SHADOW_HOST_REATTACH: re-append detached badge host (same as main overlay host).
    if (_kcBadgeShadowHost && !_kcBadgeShadowHost.isConnected) {
      try {
        (document.body || document.documentElement).appendChild(_kcBadgeShadowHost);
      } catch (e) { /* defensive: body may be mid-replacement */ }
    }
    return _kcBadgeShadowRoot;
  }

  let host = document.getElementById(KC_BADGE_SHADOW_HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = KC_BADGE_SHADOW_HOST_ID;
    host.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 0',
      'height: 0',
      'pointer-events: none',
      'z-index: 2147483647',
    ].join(';');
    (document.body || document.documentElement).appendChild(host);
  }

  _kcBadgeShadowHost = host;
  _kcBadgeShadowRoot = host.shadowRoot || host.attachShadow({ mode: 'closed' });

  try {
    if (_kcBadgeShadowRoot && !_kcBadgeShadowRoot.getElementById('kickclip-overlay-styles')) {
      const styleEl = buildOverlayStyleElement();
      if (styleEl) _kcBadgeShadowRoot.appendChild(styleEl);
    }
  } catch (_) {
    // defensive: style injection must not block badge creation
  }

  return _kcBadgeShadowRoot;
}

export function getKCBadgeShadowElement(id) {
  const root = getKCBadgeShadowRoot();
  return root.getElementById ? root.getElementById(id) : root.querySelector(`#${id}`);
}
// === END PHASE_BADGE_SHADOW_SEPARATE ===

/**
 * Look up an element by id, searching the shadow root first, then document.body.
 * Used by UI functions during the Phase 3 migration when some elements have
 * moved into the shadow root and others are still in document.body. Once the
 * migration is complete, callers that should only find shadow elements can
 * switch to using getKCShadowElement directly.
 */
export function findKCElement(id) {
  const fromShadow = getKCShadowElement(id);
  if (fromShadow) return fromShadow;
  return document.getElementById(id);
}

/**
 * Build a fresh <style> element with the overlay CSS. A new element is
 * returned each call so it can be independently appended to the head AND
 * to the shadow root (a DOM node can only have one parent).
 */
function buildOverlayStyleElement() {
  const style = document.createElement('style');
  style.id = 'kickclip-overlay-styles';
  style.textContent = `
#kickclip-highlight-overlay {
  transition: box-shadow 0.15s ease, opacity 0.15s ease,
              top 0.05s ease, left 0.05s ease,
              width 0.05s ease, height 0.05s ease;
}
#kickclip-highlight-overlay.kickclip-default {
  box-shadow: 0 2px 16px 4px rgba(188, 19, 254, 0.65);
}
#kickclip-highlight-overlay.kickclip-default.kickclip-size-medium {
  box-shadow: 0 4px 30px 5px rgba(188, 19, 254, 0.75);
}
#kickclip-highlight-overlay.kickclip-default.kickclip-size-large {
  box-shadow: 0 6px 44px 7px rgba(188, 19, 254, 0.85);
}
/* ── StatusBadge colors ── */
#kickclip-status-badge-core {
  background: ${BRAND.KEY_COLOR_HEX};
}

`;
  return style;
}

function injectKickClipOverlayStyles() {
  // All KickClip UI lives inside the shadow root, so the stylesheet is
  // injected only there. The head-injected copy from earlier migration
  // phases has been removed now that no UI elements render in document.body.
  try {
    const shadowRoot = getKCShadowRoot();
    // Guard: shadow root may not be ready in early edge cases.
    if (shadowRoot && !shadowRoot.getElementById('kickclip-overlay-styles')) {
      const shadowStyle = buildOverlayStyleElement();
      shadowRoot.appendChild(shadowStyle);
    }
  } catch (_) { /* shadow root unavailable — silent */ }
}

injectKickClipOverlayStyles();

const GREEN_LAYER_ID = 'kickclip-green-candidate-layer';
const METADATA_TOOLTIP_ID = 'kickclip-metadata-tooltip';
const EVIDENCE_TYPE_INTERACTION = 'B';
const EVIDENCE_TYPE_IMAGE_ANCHOR = 'D';
// === TYPED_REDESIGN_PHASE20_TYPEE ===
const EVIDENCE_TYPE_E = 'E';
// === END TYPED_REDESIGN_PHASE20_TYPEE ===

let greenOutlinedElements = new Set();

function normalizeText(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function formatPlatformLabel(platform) {
  const key = normalizeText(platform || '').toUpperCase();
  if (!key) return '';
  switch (key) {
    case 'X_TWITTER':
      return 'X/Twitter';
    default:
      return key
        .split('_')
        .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
        .join(' ');
  }
}

// === PHASE_OVERLAY_STACKING_ZINDEX ===
// Compute the effective stacking z-index for an element by walking its
// ancestor chain (up to but not including document.body) and tracking
// the maximum positive explicit z-index. Negative z-indices are ignored
// — the overlay should not sink below page background. Returns 0 when
// no positive explicit z-index is found in the chain, meaning the
// overlay sits just above page normal flow (and below any sticky header
// that has its own positive z-index).
//
// Used by showCoreHighlight to sync the shadow host's z-index to the
// coreItem's stacking context so page chrome (sticky headers, modal
// shells, etc.) renders above the overlay when appropriate.
function computeStackingZIndexForElement(el) {
  if (!el || el.nodeType !== 1) return 0;
  let cur = el;
  let maxZ = -Infinity;
  let depth = 0;
  const maxDepth = 50; // defensive: avoid pathological deep trees
  while (cur && cur !== document.body && depth < maxDepth) {
    try {
      const cs = window.getComputedStyle?.(cur);
      if (cs) {
        const zStr = cs.zIndex;
        if (zStr && zStr !== 'auto') {
          const z = parseInt(zStr, 10);
          if (Number.isFinite(z) && z > maxZ) {
            maxZ = z;
          }
        }
      }
    } catch (e) {
      // defensive: getComputedStyle on disconnected nodes
    }
    cur = cur.parentElement;
    depth++;
  }
  return Number.isFinite(maxZ) && maxZ > 0 ? maxZ : 0;
}
// === END PHASE_OVERLAY_STACKING_ZINDEX ===

function ensurePurpleOverlay() {
  injectKickClipOverlayStyles();
  let el = getKCShadowElement(PURPLE_OVERLAY_ID);
  if (el) return el;
  el = document.createElement('div');
  el.id = PURPLE_OVERLAY_ID;
  el.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483646;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    border-radius: 8px;
    box-sizing: border-box;
    overflow: visible;
    transition: top 0.05s ease, left 0.05s ease, width 0.05s ease, height 0.05s ease, box-shadow 0.15s ease, opacity 0.15s ease;
    display: block;
    opacity: 0;
  `;
  el.classList.add('kickclip-default');
  getKCShadowRoot().appendChild(el);
  return el;
}

function ensureCoreBadge() {
  // === PHASE_BADGE_SHADOW_SEPARATE ===
  let el = getKCBadgeShadowElement(CORE_BADGE_ID);
  if (el) return el;
  el = document.createElement('div');
  el.id = CORE_BADGE_ID;
  el.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      font-size: 11px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 3px 8px;
      border-radius: 4px;
      letter-spacing: 0.02em;
      opacity: 0;
      transition: background 0.15s ease, opacity 0.15s ease;
      color: #fff;
      top: 0;
      left: 0;
    `;
  getKCBadgeShadowRoot().appendChild(el);
  return el;
  // === END PHASE_BADGE_SHADOW_SEPARATE ===
}

/**
 * Register the status_badge texts used for non-success states.
 * Called by coreEntry at init (and on shortcut change) so the badge's
 * 'default' (hover) and 'error' (clip failure) states render with
 * consistent, platform-correct wording without uiManager knowing
 * anything about clipboard semantics or platform glyphs.
 *
 * Success text (e.g. "Image clipped" / "URL clipped") is NOT registered
 * here because it depends on the per-item category, which is only
 * known at clip time — use setCoreStatusBadgeText() instead at that
 * moment.
 */
export function setCoreBadgeTexts({ defaultText, failedText } = {}) {
  if (typeof defaultText === 'string') _coreBadgeDefaultText = defaultText;
  if (typeof failedText === 'string') _coreBadgeFailedText = failedText;
}

/**
 * Imperatively set the status_badge text. Used by coreEntry after a
 * successful clip to render category-aware text ("Image clipped" /
 * "URL clipped"). Does not change overlay visual state — the thick
 * clipped ring is applied via markCoreHighlightClipped().
 */
// === PHASE_BADGE_CLIP_ICON ===
// Builds the small white clip/copy icon (two overlapping rounded
// squares) as an inline SVG. DOM-built because the badge lives in a
// closed shadow root; stroke uses currentColor so it inherits the
// badge's white text color.
function _buildBadgeClipIcon() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.style.flexShrink = '0';
  const rect = document.createElementNS(NS, 'rect');
  rect.setAttribute('x', '9');
  rect.setAttribute('y', '9');
  rect.setAttribute('width', '11');
  rect.setAttribute('height', '11');
  rect.setAttribute('rx', '2');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M5 15V5a2 2 0 0 1 2-2h10');
  svg.appendChild(rect);
  svg.appendChild(path);
  return svg;
}
// === END PHASE_BADGE_CLIP_ICON ===

export function setCoreStatusBadgeText(text, opts = {}) {
  try {
    const el = getKCBadgeShadowElement(CORE_BADGE_ID);
    if (!el) return;
    // PHASE_BADGE_CLIP_ICON: success messages opt into an inline icon
    // via opts.icon === 'clip'; all other callers keep plain text.
    if (opts && opts.icon === 'clip') {
      el.textContent = '';
      el.style.display = 'inline-flex';
      el.style.alignItems = 'center';
      el.style.gap = '5px';
      el.appendChild(_buildBadgeClipIcon());
      const span = document.createElement('span');
      span.textContent = String(text || '');
      el.appendChild(span);
    } else {
      el.style.display = '';
      el.style.alignItems = '';
      el.style.gap = '';
      el.textContent = String(text || '');
    }
    // === PHASE_BADGE_ANCHOR_OVERLAY ===
    // Width changed -> re-pin right edge (viewport left coord; no innerWidth /
    // containing-block dependency).
    _reanchorBadgeLeft();
    // === END PHASE_BADGE_ANCHOR_OVERLAY ===
  } catch (_) {}
}

// PHASE_BADGE_HIDDEN: the status badge's only remaining role is the hover hint
// ("Press X to clip"); clip feedback is the top-right toast stack + the purple clipped
// ring. Suppress the badge on activation by gating the single show path. Flip to true to
// restore. positionCoreStatusBadgeToOverlay / hideCoreStatusBadge / save-time restore all
// no-op on the never-created badge element.
const KC_STATUS_BADGE_ENABLED = false;
export function showCoreStatusBadge(badgeState = 'default') {
  if (!KC_STATUS_BADGE_ENABLED) return; // PHASE_BADGE_HIDDEN
  try {
    const el = ensureCoreBadge();
    el.textContent = _coreBadgeDefaultText;
    // PHASE_BADGE_CLIP_ICON: reset icon-row layout from a prior success render
    el.style.display = '';
    el.style.alignItems = '';
    el.style.gap = '';
    el.style.opacity = '1';
  } catch (e) {}
}

export function hideCoreStatusBadge() {
  try {
    const el = getKCBadgeShadowElement(CORE_BADGE_ID);
    if (el) {
      // Keep opacity transition for fade-out; disable only background transition for instant color reset
      el.style.transition = 'opacity 0.15s ease';
      el.style.opacity = '0';
      // Re-enable transition after reset so next show animates correctly
      requestAnimationFrame(() => {
        try { el.style.transition = ''; } catch (e) {}
      });
    }
  } catch (e) {}
}

// === PHASE_CLIP_TOAST ===
// Top-RIGHT stacked clip-result toasts. The status_badge always shows its
// default "Press X to clip" text (the imperative setCoreStatusBadgeText clip
// calls in coreEntry were removed); each clip outcome is announced by its own
// toast in a fixed top-right column. Newest toast is appended at the BOTTOM
// (older toasts sit above). Each toast self-dismisses after
// CORE_CLIP_TOAST_DURATION_MS; the stack is capped at CORE_CLIP_TOAST_MAX and
// the oldest (top) toast is dropped IMMEDIATELY on overflow (FIFO).
//
// Lives in the SEPARATE badge shadow host (kickclip-badge-shadow-host):
// already isolated from page CSS, pinned at max z-index, and reattach-healed
// (PHASE_BADGE_SHADOW_SEPARATE / PHASE_SHADOW_HOST_REATTACH), so the toasts
// inherit that robustness without a third shadow host.
const CORE_CLIP_TOAST_STACK_ID = 'kickclip-clip-toast-stack';
const CORE_CLIP_TOAST_DURATION_MS = 1800;
const CORE_CLIP_TOAST_EXIT_MS = 200; // matches the toast opacity/transform transition
const CORE_CLIP_TOAST_ERROR_BG = '#e5484d';
const CORE_CLIP_TOAST_CANCELED_BG = '#6b7280'; // neutral gray for canceled clips
const CORE_CLIP_TOAST_MAX = 4;

function ensureCoreClipToastStack() {
  let stack = getKCBadgeShadowElement(CORE_CLIP_TOAST_STACK_ID);
  if (stack) return stack;
  stack = document.createElement('div');
  stack.id = CORE_CLIP_TOAST_STACK_ID;
  stack.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 2147483647;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    `;
  getKCBadgeShadowRoot().appendChild(stack);
  return stack;
}

// Clear a toast's pending timers and detach it from the stack.
function _removeCoreClipToast(el) {
  if (!el) return;
  try { if (el._kcDismissTimer) clearTimeout(el._kcDismissTimer); } catch (_) {}
  try { if (el._kcRemoveTimer) clearTimeout(el._kcRemoveTimer); } catch (_) {}
  try { el.remove(); } catch (_) {}
}

// Inline SVG spinner for the 'loading' kind. Uses <animateTransform> so it
// works inside the shadow root without injecting @keyframes.
function _buildClipToastSpinner() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  const ring = document.createElementNS(NS, 'circle');
  ring.setAttribute('cx', '12'); ring.setAttribute('cy', '12'); ring.setAttribute('r', '10');
  ring.setAttribute('stroke', '#fff'); ring.setAttribute('stroke-width', '3');
  ring.setAttribute('fill', 'none'); ring.setAttribute('stroke-opacity', '0.3');
  svg.appendChild(ring);
  const arc = document.createElementNS(NS, 'path');
  arc.setAttribute('d', 'M 12 2 A 10 10 0 0 1 22 12');
  arc.setAttribute('stroke', '#fff'); arc.setAttribute('stroke-width', '3');
  arc.setAttribute('fill', 'none'); arc.setAttribute('stroke-linecap', 'round');
  const anim = document.createElementNS(NS, 'animateTransform');
  anim.setAttribute('attributeName', 'transform'); anim.setAttribute('type', 'rotate');
  anim.setAttribute('from', '0 12 12'); anim.setAttribute('to', '360 12 12');
  anim.setAttribute('dur', '0.9s'); anim.setAttribute('repeatCount', 'indefinite');
  arc.appendChild(anim);
  svg.appendChild(arc);
  return svg;
}

/**
 * Show a clip-result toast in the top-right stack.
 *   kind 'loading' -> brand-color background + spinner; NEVER auto-dismisses.
 *   kind 'success' -> brand-color background + inline clip icon; auto-dismisses.
 *   kind 'error'   -> red background, text only; auto-dismisses.
 * Returns a handle { update({kind,text}), dismiss() } so callers can morph an
 * existing toast in place (loading -> success/error) instead of stacking a new
 * one. Existing call sites that ignore the return value behave as before.
 * Each call creates its own toast (newest at the bottom). The stack is capped
 * at CORE_CLIP_TOAST_MAX; the oldest is dropped immediately on overflow.
 */
export function showCoreClipToast({ kind = 'success', text = '' } = {}) {
  try {
    const stack = ensureCoreClipToastStack();
    const el = document.createElement('div');
    el.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 8px;
        max-width: 80vw;
        font-size: 14px;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        letter-spacing: 0.02em;
        padding: 9px 16px;
        border-radius: 9999px;
        color: #fff;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28);
        white-space: nowrap;
        opacity: 0;
        transform: translateX(8px);
        transition: opacity 0.18s ease, transform 0.18s ease, background 0.18s ease;
      `;

    // Fixed slots: icon (variable), text (variable). Update mutates these in place.
    const iconSlot = document.createElement('span');
    iconSlot.style.cssText = 'display:inline-flex;align-items:center;line-height:0;';
    el.appendChild(iconSlot);
    const span = document.createElement('span');
    el.appendChild(span);

    const applyKind = (k, t) => {
      el.style.background =
        (k === 'error') ? CORE_CLIP_TOAST_ERROR_BG :
          (k === 'canceled') ? CORE_CLIP_TOAST_CANCELED_BG :
            BRAND.KEY_COLOR_HEX;
      while (iconSlot.firstChild) iconSlot.removeChild(iconSlot.firstChild);
      if (k === 'loading') {
        iconSlot.appendChild(_buildClipToastSpinner());
      } else if (k !== 'error' && k !== 'canceled') {
        // success: reuse the badge clip glyph (PHASE_BADGE_CLIP_ICON), sized for the toast.
        const icon = _buildBadgeClipIcon();
        icon.setAttribute('width', '14');
        icon.setAttribute('height', '14');
        iconSlot.appendChild(icon);
      } // error / canceled: text only
      span.textContent = String(t == null ? '' : t);
    };

    let currentKind = kind;
    applyKind(currentKind, text);

    // Newest at the bottom of the stack.
    stack.appendChild(el);

    // FIFO cap: drop oldest (top) toasts immediately on overflow.
    while (stack.children.length > CORE_CLIP_TOAST_MAX) {
      _removeCoreClipToast(stack.firstElementChild);
    }

    // Enter animation: reflow from the hidden state, then settle.
    void el.offsetWidth;
    el.style.opacity = '1';
    el.style.transform = 'translateX(0)';

    // (Re)arm the self-dismiss timer. Loading kind does NOT arm.
    const armDismiss = () => {
      try { if (el._kcDismissTimer) clearTimeout(el._kcDismissTimer); } catch (_) {}
      try { if (el._kcRemoveTimer) clearTimeout(el._kcRemoveTimer); } catch (_) {}
      el._kcDismissTimer = setTimeout(() => {
        try {
          el.style.opacity = '0';
          el.style.transform = 'translateX(8px)';
          el._kcRemoveTimer = setTimeout(() => _removeCoreClipToast(el), CORE_CLIP_TOAST_EXIT_MS);
        } catch (_) {}
      }, CORE_CLIP_TOAST_DURATION_MS);
    };
    if (currentKind !== 'loading') armDismiss();

    return {
      update(next = {}) {
        try {
          const k = next.kind || currentKind;
          const t = (next.text == null) ? span.textContent : next.text;
          currentKind = k;
          applyKind(k, t);
          if (k !== 'loading') armDismiss();
        } catch (_) {}
      },
      dismiss() {
        try { _removeCoreClipToast(el); } catch (_) {}
      },
    };
  } catch (_) {
    // Always return a no-op handle so callers can chain safely.
    return { update() {}, dismiss() {} };
  }
}
// === END PHASE_CLIP_TOAST ===

// === PHASE_BADGE_ANCHOR_OVERLAY ===
// Bottom (viewport y) of the lowest TOP-ANCHORED fixed/sticky page chrome
// (e.g. a site header, possibly multi-row) covering column `x`, or 0 if none.
// Relies on our overlay/host/badge being pointer-events:none, so
// elementFromPoint returns page elements. Jumps from each chrome occluder's
// bottom (deterministic; clears tall/multi-row headers in a few hops).
// Occluder counts as chrome only if it (or an ancestor within 6 hops) is
// position:fixed|sticky AND is contiguous from the top — static content above
// the media, and non-top fixed elements (e.g. a right sidebar), are excluded.
function _topChromeBottomAt(x, coreItem) {
  const PAD = 8;
  const MAX_JUMPS = 8;
  const hostId = KC_SHADOW_HOST_ID;
  const isFixedOrSticky = (el) => {
    let cur = el, hops = 0;
    while (cur && cur.nodeType === 1 && hops < 6) {
      let pos = '';
      try { pos = getComputedStyle(cur).position; } catch (_) {}
      if (pos === 'fixed' || pos === 'sticky') return true;
      cur = cur.parentElement; hops++;
    }
    return false;
  };
  let y = 1;
  let bottom = 0;
  for (let i = 0; i < MAX_JUMPS; i++) {
    if (y < 0 || y > window.innerHeight) break;
    let topEl = null;
    try { topEl = document.elementFromPoint(x, y); } catch (_) { break; }
    if (!topEl) break;
    if (topEl.id === hostId) break; // our own UI (defensive; should be pointer-events:none)
    if (coreItem && (topEl === coreItem || coreItem.contains?.(topEl))) break; // reached the media
    if (!isFixedOrSticky(topEl)) break; // benign static content above the media
    const r = topEl.getBoundingClientRect?.();
    if (!r) break;
    if (r.top > bottom + PAD) break; // not contiguous from the top (e.g. side panel)
    const nb = Math.round(r.bottom);
    if (nb <= bottom) break; // no downward progress
    bottom = nb;
    y = nb + 1; // jump just below this chrome row and re-probe
  }
  return bottom;
}

// === PHASE_BADGE_ANCHOR_OVERLAY ===
// Re-pin the badge right edge to the last stored target x using a viewport
// left coordinate (right:auto). Called when text-only changes alter width.
function _reanchorBadgeLeft() {
  try {
    if (_badgeAnchorRightX == null) return;
    const el = getKCBadgeShadowElement(CORE_BADGE_ID);
    if (!el || el.style.opacity === '0') return;
    const PAD = 8;
    const w = el.getBoundingClientRect().width || 0;
    let left = Math.round(_badgeAnchorRightX - w);
    if (left < PAD) left = PAD;
    el.style.right = 'auto';
    el.style.left = `${left}px`;
  } catch (_) {}
}
// === END PHASE_BADGE_ANCHOR_OVERLAY ===

// Anchors the status_badge to the OUTER TOP-RIGHT of the overlay rect: badge
// right edge aligned to overlay right edge (inset), badge above the overlay's
// unoccluded visible top. If that top would be clipped above the visible
// region, the badge drops INTO the visible top instead (so it follows the
// overlay down as the overlay scrolls off the top behind page chrome).
export function positionCoreStatusBadgeToOverlay(overlayRect, coreItem) {
  try {
    const el = getKCBadgeShadowElement(CORE_BADGE_ID);
    if (!el || el.style.opacity === '0') return;
    if (!overlayRect || overlayRect.width <= 0 || overlayRect.height <= 0) return;
    const PAD = 8;
    const GAP = 6;
    const RIGHT_INSET = 2;
    const r = el.getBoundingClientRect();
    const badgeW = r.width || 0;
    const badgeH = r.height || 0;
    const probeX = Math.min(Math.round(overlayRect.right) - 1, window.innerWidth - PAD);
    const chromeBottom = _topChromeBottomAt(probeX, coreItem);
    const floor = chromeBottom > 0 ? chromeBottom + GAP : PAD;
    // === PHASE_BADGE_ANCHOR_OVERLAY ===
    // Horizontal: pin the badge RIGHT edge to the overlay right edge (minus
    // inset) using a VIEWPORT-coordinate left (right:auto) — the same model
    // the overlay uses (left + width) — so the badge aligns to the overlay
    // regardless of any fixed containing block on the page. _badgeAnchorRightX
    // is stored so setCoreStatusBadgeText can re-pin on text-width changes.
    const targetRightX = Math.min(Math.round(overlayRect.right) - RIGHT_INSET, window.innerWidth - PAD);
    _badgeAnchorRightX = targetRightX;
    let left = Math.round(targetRightX - badgeW);
    if (left < PAD) left = PAD;
    // === END PHASE_BADGE_ANCHOR_OVERLAY ===
    // Default: outer top-right, above the overlay. Clamp below top chrome /
    // viewport top so the badge is never hidden behind a fixed header; when
    // clamped it sits just inside the visible region and follows the overlay
    // down as it scrolls off the top.
    let top = Math.round(overlayRect.top - badgeH - GAP);
    if (top < floor) top = Math.round(floor);
    const maxTop = window.innerHeight - PAD - badgeH;
    if (top > maxTop) top = Math.round(Math.max(PAD, maxTop));
    el.style.right = 'auto';
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  } catch (e) {}
}
// === END PHASE_BADGE_ANCHOR_OVERLAY ===

function ensureMetadataTooltip() {
  // === PHASE_BADGE_SHADOW_SEPARATE ===
  let el = getKCBadgeShadowElement(METADATA_TOOLTIP_ID);
  if (el) return el;
  el = document.createElement('div');
  el.id = METADATA_TOOLTIP_ID;
  el.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483647;
    top: 0;
    left: 0;
    width: 280px;
    max-width: min(320px, 70vw);
    border: 1px solid var(--kc-accent, ${BRAND.KEY_COLOR_HEX});
    background: rgba(var(--kc-accent-rgb, 188, 19, 254), 0.70);
    color: #fff;
    border-radius: 10px;
    box-sizing: border-box;
    padding: 8px;
    backdrop-filter: blur(2px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24);
    display: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  el.innerHTML = `
    <div data-kc-tooltip-image-wrap style="width:100%;height:96px;border-radius:8px;overflow:hidden;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;">
      <img data-kc-tooltip-image alt="" style="display:none;width:100%;height:100%;object-fit:cover;" />
      <div data-kc-tooltip-image-placeholder style="font-size:12px;opacity:0.9;">No Image Found</div>
    </div>
    <div data-kc-tooltip-title style="margin-top:8px;font-size:13px;line-height:1.35;font-weight:600;max-height:3.9em;overflow:hidden;word-break:break-word;"></div>
    <div data-kc-tooltip-shortcode style="margin-top:6px;font-size:11px;line-height:1.35;opacity:0.95;display:none;"></div>
    <div data-kc-tooltip-category style="margin-top:6px;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;opacity:0.75;display:none;"></div>
    <div data-kc-tooltip-url style="margin-top:6px;font-size:11px;line-height:1.35;opacity:0.95;max-height:2.8em;overflow:hidden;word-break:break-all;"></div>
    <div data-kc-tooltip-ai style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.25);display:none;">
      <div data-kc-tooltip-ai-type style="font-size:11px;font-weight:700;opacity:0.85;letter-spacing:0.03em;text-transform:uppercase;"></div>
      <div data-kc-tooltip-ai-summary style="margin-top:3px;font-size:11px;line-height:1.45;opacity:0.90;word-break:break-word;"></div>
    </div>
  `;
  getKCBadgeShadowRoot().appendChild(el);
  return el;
  // === END PHASE_BADGE_SHADOW_SEPARATE ===
}

function setMetadataTooltipContent(meta) {
  const el = ensureMetadataTooltip();
  const titleEl = el.querySelector('[data-kc-tooltip-title]');
  const shortcodeEl = el.querySelector('[data-kc-tooltip-shortcode]');
  const categoryEl = el.querySelector('[data-kc-tooltip-category]');
  const urlEl = el.querySelector('[data-kc-tooltip-url]');
  const imgEl = el.querySelector('[data-kc-tooltip-image]');
  const phEl = el.querySelector('[data-kc-tooltip-image-placeholder]');

  const title = normalizeText(meta?.title || '') || '(No title)';
  const shortcode = normalizeText(meta?.shortcode || '');
  const platform = formatPlatformLabel(meta?.platform || '');
  const url = normalizeText(meta?.activeHoverUrl || '') || '(No url)';
  if (titleEl) titleEl.textContent = title;
  if (shortcodeEl) {
    if (shortcode) {
      shortcodeEl.textContent = platform ? `Source: ${platform} | ID: ${shortcode}` : `ID: ${shortcode}`;
      shortcodeEl.style.display = 'block';
    } else {
      shortcodeEl.textContent = '';
      shortcodeEl.style.display = 'none';
    }
  }
  const category = normalizeText(meta?.category || '');
  if (categoryEl) {
    if (category) {
      categoryEl.textContent = category;
      categoryEl.style.display = 'block';
    } else {
      categoryEl.textContent = '';
      categoryEl.style.display = 'none';
    }
  }
  if (urlEl) urlEl.textContent = url;

  const imageUrl = String(meta?.image?.url || '').trim();
  if (imgEl && phEl) {
    if (imageUrl) {
      imgEl.src = imageUrl;
      imgEl.style.display = 'block';
      phEl.style.display = 'none';
    } else {
      imgEl.removeAttribute('src');
      imgEl.style.display = 'none';
      phEl.style.display = 'block';
    }
  }
}

export function setAiTooltipContent({ type, summary }) {
  try {
    const el = getKCBadgeShadowElement(METADATA_TOOLTIP_ID);
    if (!el) return;
    const aiWrap = el.querySelector('[data-kc-tooltip-ai]');
    const typeEl = el.querySelector('[data-kc-tooltip-ai-type]');
    const summaryEl = el.querySelector('[data-kc-tooltip-ai-summary]');
    if (!aiWrap || !typeEl || !summaryEl) return;
    typeEl.textContent = type ? `⬩ ${type}` : '';
    summaryEl.textContent = summary || '';
    aiWrap.style.display = (type || summary) ? 'block' : 'none';
  } catch (e) {}
}

export function clearAiTooltipContent() {
  try {
    const el = getKCBadgeShadowElement(METADATA_TOOLTIP_ID);
    if (!el) return;
    const aiWrap = el.querySelector('[data-kc-tooltip-ai]');
    const typeEl = el.querySelector('[data-kc-tooltip-ai-type]');
    const summaryEl = el.querySelector('[data-kc-tooltip-ai-summary]');
    if (!aiWrap || !typeEl || !summaryEl) return;
    typeEl.textContent = '';
    summaryEl.textContent = 'Analyzing...';
    aiWrap.style.display = 'block';
  } catch (e) {}
}

export function positionMetadataTooltip(clientX, clientY) {
  try {
    const el = ensureMetadataTooltip();
    const x = Number(clientX);
    const y = Number(clientY);
    if (!isFinite(x) || !isFinite(y)) return false;
    const pad = 12;
    const offset = 14;
    const r = el.getBoundingClientRect();
    let left = x + offset;
    let top = y + offset;
    if (left + r.width > window.innerWidth - pad) left = Math.max(pad, x - r.width - offset);
    if (top + r.height > window.innerHeight - pad) top = Math.max(pad, y - r.height - offset);
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    return true;
  } catch (e) {
    return false;
  }
}

export function showMetadataTooltip(meta, clientX = null, clientY = null) {
  try {
    if (!meta || typeof meta !== 'object') return false;
    setMetadataTooltipContent(meta);
    const el = ensureMetadataTooltip();
    el.style.display = 'block';
    if (isFinite(Number(clientX)) && isFinite(Number(clientY))) {
      positionMetadataTooltip(clientX, clientY);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export function hideMetadataTooltip() {
  const el = getKCBadgeShadowElement(METADATA_TOOLTIP_ID);
  if (el) el.style.display = 'none';
}

// === PHASE_OVERLAY_RADIUS_MIRROR ===
// The overlay visually wraps a specific element (the decoupled overlay
// element when rectOverride is supplied, else the coreItem). Mirroring
// that element's computed border-radius makes the highlight hug rounded
// cards/thumbnails exactly instead of applying a uniform 8px. Strict
// mirror: '0px' elements get square highlights. '8px' is only a
// fallback for unreadable computed styles.
function computeOverlayBorderRadius(sourceEl) {
  try {
    if (sourceEl && sourceEl.nodeType === 1) {
      const v = getComputedStyle(sourceEl).borderRadius;
      if (v && typeof v === 'string' && v.trim() !== '') return v;
    }
  } catch (e) {
    // defensive: detached elements / cross-origin oddities
  }
  return '8px';
}
// === END PHASE_OVERLAY_RADIUS_MIRROR ===

// === PHASE_OVERLAY_TRANSFORM_MIRROR ===
// Accumulated linear transform from el up through ancestors (including
// shadow-host hops). Translation (e/f) is excluded at apply time — the
// bounding rect center already reflects it.
function getAccumulatedTransform(el) {
  try {
    if (!el || el.nodeType !== 1) return null;
    let M = new DOMMatrix();
    let node = el;
    while (node && node.nodeType === 1) {
      let cs = null;
      try { cs = window.getComputedStyle?.(node); } catch (_) { cs = null; }
      const t = cs?.transform;
      if (t && t !== 'none') {
        M = new DOMMatrix(t).multiply(M);
      }
      if (node.parentElement) {
        node = node.parentElement;
        continue;
      }
      const root = node.getRootNode?.();
      if (root && root instanceof ShadowRoot && root.host) {
        node = root.host;
        continue;
      }
      break;
    }
    return M;
  } catch (_) {
    return null;
  }
}

// Viewport-space intersection of all ancestor overflow clip bounds (padding
// boxes). Returns null when no clipping ancestor exists (fail-open). Ignores
// border-radius — rectangular clip is sufficient for now.
function getAncestorClipRect(el) {
  try {
    if (!el || el.nodeType !== 1) return null;
    let clip = null;
    let node = el.parentElement;
    while (node && node.nodeType === 1) {
      let cs = null;
      try { cs = window.getComputedStyle?.(node); } catch (_) { cs = null; }
      if (cs) {
        const clipsX = cs.overflowX !== 'visible';
        const clipsY = cs.overflowY !== 'visible';
        if (clipsX || clipsY) {
          const rect = node.getBoundingClientRect();
          const bl = parseFloat(cs.borderLeftWidth) || 0;
          const br = parseFloat(cs.borderRightWidth) || 0;
          const bt = parseFloat(cs.borderTopWidth) || 0;
          const bb = parseFloat(cs.borderBottomWidth) || 0;
          const box = {
            left: rect.left + bl,
            top: rect.top + bt,
            right: rect.right - br,
            bottom: rect.bottom - bb,
          };
          if (clip === null) {
            clip = {
              left: clipsX ? box.left : Number.NEGATIVE_INFINITY,
              right: clipsX ? box.right : Number.POSITIVE_INFINITY,
              top: clipsY ? box.top : Number.NEGATIVE_INFINITY,
              bottom: clipsY ? box.bottom : Number.POSITIVE_INFINITY,
            };
          } else {
            if (clipsX) {
              clip.left = Math.max(clip.left, box.left);
              clip.right = Math.min(clip.right, box.right);
            }
            if (clipsY) {
              clip.top = Math.max(clip.top, box.top);
              clip.bottom = Math.min(clip.bottom, box.bottom);
            }
          }
        }
      }
      if (node.parentElement) {
        node = node.parentElement;
        continue;
      }
      const root = node.getRootNode?.();
      if (root && root instanceof ShadowRoot && root.host) {
        node = root.host;
        continue;
      }
      break;
    }
    return clip;
  } catch (_) {
    return null;
  }
}

function _positionCoreHighlightOverlay(overlay, srcEl, coreItem, r, overlayRadius) {
  const M = getAccumulatedTransform(srcEl);
  const hasTransform = !!M && !(M.a === 1 && M.b === 0 && M.c === 0 && M.d === 1);

  if (hasTransform && srcEl && srcEl.offsetWidth > 0 && srcEl.offsetHeight > 0) {
    const w = srcEl.offsetWidth;
    const h = srcEl.offsetHeight;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    overlay.style.left = `${cx - w / 2}px`;
    overlay.style.top = `${cy - h / 2}px`;
    overlay.style.width = `${w}px`;
    overlay.style.height = `${h}px`;
    overlay.style.transformOrigin = 'center center';
    overlay.style.transform = `matrix(${M.a}, ${M.b}, ${M.c}, ${M.d}, 0, 0)`;
  } else {
    overlay.style.left = `${r.left}px`;
    overlay.style.top = `${r.top}px`;
    overlay.style.width = `${r.width}px`;
    overlay.style.height = `${r.height}px`;
    overlay.style.transformOrigin = '';
    overlay.style.transform = '';
  }
  overlay.style.borderRadius = overlayRadius;

  const clipSrc = (coreItem && srcEl && srcEl !== coreItem && coreItem.contains(srcEl))
    ? coreItem
    : srcEl;
  const clip = getAncestorClipRect(clipSrc);
  if (!clip) {
    overlay.style.clipPath = '';
    return true;
  }

  const ol = parseFloat(overlay.style.left);
  const ot = parseFloat(overlay.style.top);
  const ow = parseFloat(overlay.style.width);
  const oh = parseFloat(overlay.style.height);

  const clipLeft = Number.isFinite(clip.left) ? clip.left : Number.NEGATIVE_INFINITY;
  const clipRight = Number.isFinite(clip.right) ? clip.right : Number.POSITIVE_INFINITY;
  const clipTop = Number.isFinite(clip.top) ? clip.top : Number.NEGATIVE_INFINITY;
  const clipBottom = Number.isFinite(clip.bottom) ? clip.bottom : Number.POSITIVE_INFINITY;

  if (clipRight <= ol || clipLeft >= ol + ow || clipBottom <= ot || clipTop >= ot + oh) {
    overlay.style.opacity = '0';
    overlay.style.clipPath = '';
    return false;
  }

  const GLOW = 24;
  const EPS = 0.5;
  const cutsLeft = clipLeft > ol + EPS;
  const cutsTop = clipTop > ot + EPS;
  const cutsRight = clipRight < ol + ow - EPS;
  const cutsBottom = clipBottom < ot + oh - EPS;
  if (!cutsLeft && !cutsTop && !cutsRight && !cutsBottom) {
    overlay.style.clipPath = '';
    return true;
  }

  const box = {
    left: cutsLeft ? clipLeft : ol - GLOW,
    top: cutsTop ? clipTop : ot - GLOW,
    right: cutsRight ? clipRight : ol + ow + GLOW,
    bottom: cutsBottom ? clipBottom : ot + oh + GLOW,
  };

  const inv = hasTransform ? new DOMMatrix([M.a, M.b, M.c, M.d, 0, 0]).inverse() : null;
  const toLocal = (px, py) => {
    if (!inv) return [px - ol, py - ot];
    const dx = px - (ol + ow / 2);
    const dy = py - (ot + oh / 2);
    return [ow / 2 + inv.a * dx + inv.c * dy, oh / 2 + inv.b * dx + inv.d * dy];
  };
  const pts = [
    [box.left, box.top],
    [box.right, box.top],
    [box.right, box.bottom],
    [box.left, box.bottom],
  ]
    .map(([x, y]) => toLocal(x, y))
    .map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`);
  overlay.style.clipPath = `polygon(${pts.join(', ')})`;
  return true;
}
// === END PHASE_OVERLAY_TRANSFORM_MIRROR ===

/**
 * Show CoreHighlight overlay on a CoreItem.
 * Handles position, opacity, class, and border animation.
 */
// === PHASE_SHORTCUT_TIP ===
// Cursor-following hint showing the clip shortcut (reuses _coreBadgeDefaultText) at the
// pointer's bottom-right while a CoreItem is active. Lives in the badge shadow host; positioned
// by a mousemove listener attached only while shown; hidden during a clip (html.kc-clip-wait).
const KC_SHORTCUT_TIP_ID = 'kickclip-shortcut-tip';
const KC_SHORTCUT_TIP_OFFSET_X = 18;
const KC_SHORTCUT_TIP_OFFSET_Y = 20;
let _kcShortcutTipMoveHandler = null;
let _kcShortcutTipClipObserver = null;
let _kcShortcutTipItem = null;      // PHASE_SHORTCUT_TIP_DWELL: CoreItem the current lifecycle belongs to
let _kcShortcutTipHoldTimer = null; // 1s hold before the 2s fade-out
let _kcShortcutTipArmed = false;    // true after show, until first positioning starts the lifecycle
// PHASE_SHORTCUT_TIP_WINDOW: the tip only appears within 5s of the FIRST activation after a real
// document load. Content scripts re-inject on full navigation, so this resets per page load (SPA
// route changes keep the same window). After the window, new activations are blocked while an
// in-flight fade finishes on its own.
const KC_SHORTCUT_TIP_WINDOW_MS = 3000;
let _kcShortcutTipWindowStart = 0;
function _kcClearShortcutTipTimer() {
  if (_kcShortcutTipHoldTimer) { clearTimeout(_kcShortcutTipHoldTimer); _kcShortcutTipHoldTimer = null; }
}
function ensureShortcutTip() {
  let el = getKCBadgeShadowElement(KC_SHORTCUT_TIP_ID);
  if (el) return el;
  el = document.createElement('div');
  el.id = KC_SHORTCUT_TIP_ID;
  el.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      font-size: 11px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 3px 8px;
      border-radius: 4px;
      letter-spacing: 0.02em;
      white-space: nowrap;
      color: #fff;
      background: #CF00FF;
      opacity: 0;
      transition: opacity 0.12s ease;
      top: 0;
      left: 0;
    `;
  getKCBadgeShadowRoot().appendChild(el);
  try {
    if (!_kcShortcutTipClipObserver && window.MutationObserver && document.documentElement) {
      _kcShortcutTipClipObserver = new MutationObserver(() => {
        if (document.documentElement.classList.contains('kc-clip-wait')) {
          const t = getKCBadgeShadowElement(KC_SHORTCUT_TIP_ID);
          if (t) t.style.opacity = '0';
        }
      });
      _kcShortcutTipClipObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
  } catch (_) {}
  return el;
}
function _kcEscapeHtml(s) { // PHASE_SHORTCUT_TIP_MARKUP
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function _kcSetShortcutTipMarkup(el, text) {
  // PHASE_SHORTCUT_TIP_MARKUP: render "{shortcut} to clip" with the shortcut bold. Derive the
  // glyph from "Press {glyph} to clip" (drop the "Press " prefix); fall back to plain text.
  try {
    const idx = text.indexOf(' to clip');
    if (idx > 0) {
      const glyph = text.slice(0, idx).replace(/^Press\s+/, '');
      el.innerHTML = '<strong>' + _kcEscapeHtml(glyph) + '</strong>' + _kcEscapeHtml(text.slice(idx));
      return;
    }
  } catch (_) {}
  el.textContent = text;
}
function _kcPositionShortcutTip(x, y) {
  const el = getKCBadgeShadowElement(KC_SHORTCUT_TIP_ID);
  if (!el) return;
  if (document.documentElement && document.documentElement.classList.contains('kc-clip-wait')) {
    el.style.opacity = '0';
    return;
  }
  el.style.left = (x + KC_SHORTCUT_TIP_OFFSET_X) + 'px';
  el.style.top = (y + KC_SHORTCUT_TIP_OFFSET_Y) + 'px';
  // PHASE_SHORTCUT_TIP_DWELL: one-shot lifecycle — full opacity, hold 1s, then fade over 2s.
  // The tip keeps following the cursor while it fades; movement does not re-show or reset it.
  if (_kcShortcutTipArmed) {
    _kcShortcutTipArmed = false;
    el.style.transition = 'none';
    el.style.opacity = '1';
    _kcShortcutTipHoldTimer = setTimeout(() => {
      try {
        el.style.transition = 'opacity 0.5s linear';
        el.style.opacity = '0';
      } catch (_) {}
    }, 750);
  }
}
function showShortcutTip(coreItem) {
  try {
    // PHASE_SHORTCUT_TIP_WINDOW: start the 5s window on the first activation after load; once it
    // has elapsed, block new tips (a tip already mid-fade finishes on its own timer).
    const _kcNow = Date.now();
    if (_kcShortcutTipWindowStart === 0) _kcShortcutTipWindowStart = _kcNow;
    else if (_kcNow - _kcShortcutTipWindowStart > KC_SHORTCUT_TIP_WINDOW_MS) return;
    // PHASE_SHORTCUT_TIP_DWELL: run the lifecycle once per item; ignore repeat calls for the
    // same active item (scroll/rect refresh) so it doesn't restart mid-fade.
    if (coreItem && coreItem === _kcShortcutTipItem) return;
    _kcShortcutTipItem = coreItem || _kcShortcutTipItem;
    const text = (typeof _coreBadgeDefaultText === 'string') ? _coreBadgeDefaultText : '';
    if (!text) return;
    const el = ensureShortcutTip();
    _kcSetShortcutTipMarkup(el, text); // PHASE_SHORTCUT_TIP_MARKUP
    _kcClearShortcutTipTimer();
    el.style.transition = 'none';
    el.style.opacity = '0'; // armed; positioned + faded starting on the next mousemove
    _kcShortcutTipArmed = true;
    if (!_kcShortcutTipMoveHandler) {
      _kcShortcutTipMoveHandler = (e) => { try { _kcPositionShortcutTip(e.clientX, e.clientY); } catch (_) {} };
      window.addEventListener('mousemove', _kcShortcutTipMoveHandler, true);
    }
  } catch (_) {}
}
export function showShortcutTipImmediate(coreItem, x, y) {
  // PHASE_SHORTCUT_TIP_KEYHINT: show the tip once at (x,y) regardless of the 5s window and WITHOUT
  // resetting it. The pointer is stationary on a key press, so position immediately and start the
  // normal dwell lifecycle (reuses _kcPositionShortcutTip's armed-start path).
  try {
    const text = (typeof _coreBadgeDefaultText === 'string') ? _coreBadgeDefaultText : '';
    if (!text) return;
    if (document.documentElement && document.documentElement.classList.contains('kc-clip-wait')) return;
    _kcShortcutTipItem = coreItem || _kcShortcutTipItem;
    const el = ensureShortcutTip();
    _kcSetShortcutTipMarkup(el, text);
    _kcClearShortcutTipTimer();
    el.style.transition = 'none';
    el.style.opacity = '0';
    _kcShortcutTipArmed = true;
    if (!_kcShortcutTipMoveHandler) {
      _kcShortcutTipMoveHandler = (e) => { try { _kcPositionShortcutTip(e.clientX, e.clientY); } catch (_) {} };
      window.addEventListener('mousemove', _kcShortcutTipMoveHandler, true);
    }
    _kcPositionShortcutTip(x, y);
  } catch (_) {}
}
function hideShortcutTip() {
  try {
    _kcClearShortcutTipTimer();
    _kcShortcutTipArmed = false;
    _kcShortcutTipItem = null;
    if (_kcShortcutTipMoveHandler) {
      window.removeEventListener('mousemove', _kcShortcutTipMoveHandler, true);
      _kcShortcutTipMoveHandler = null;
    }
    const el = getKCBadgeShadowElement(KC_SHORTCUT_TIP_ID);
    if (el) { el.style.transition = 'none'; el.style.opacity = '0'; }
  } catch (_) {}
}
// === END PHASE_SHORTCUT_TIP ===
export function showCoreHighlight(coreItem, isSaved = false, rectOverride = null, forceRestart = false) {
  try {
    _kcCancelHideReset();
    const srcEl = (rectOverride !== null ? state.activeOverlayElement : null) || coreItem;
    const r = rectOverride ?? (coreItem?.getBoundingClientRect?.());
    if (!r || r.width <= 0 || r.height <= 0) return false;
    // PHASE_OVERLAY_RADIUS_MIRROR: rectOverride implies the rect came from
    // the decoupled overlay element; otherwise the overlay tracks coreItem.
    const radiusSourceEl = srcEl;
    const overlayRadius = computeOverlayBorderRadius(radiusSourceEl);
    const M = getAccumulatedTransform(srcEl);
    const hasTransform = !!M && !(M.a === 1 && M.b === 0 && M.c === 0 && M.d === 1);
    const sizeMetric = (hasTransform && srcEl?.offsetWidth > 0 && srcEl?.offsetHeight > 0)
      ? Math.sqrt(srcEl.offsetWidth * srcEl.offsetHeight)
      : Math.sqrt(r.width * r.height);
    // === PHASE_OVERLAY_STACKING_ZINDEX ===
    // Sync the shadow host's z-index to coreItem's effective stacking
    // context (max positive z-index in its ancestor chain, or 0 if none).
    // Page chrome with higher explicit z-index (e.g. sticky headers
    // typically at 100–9999) then renders above the overlay naturally,
    // instead of being painted over by the host's previous near-max
    // z-index. Applied to the host element only — the badge and
    // overlay div retain their relative z-indices within the shadow.
    try {
      const host = document.getElementById(KC_SHADOW_HOST_ID);
      if (host) {
        const targetZ = computeStackingZIndexForElement(coreItem);
        host.style.zIndex = String(targetZ + 1);
      }
    } catch (e) {
      // defensive: never let stacking sync block the highlight
    }
    // === END PHASE_OVERLAY_STACKING_ZINDEX ===
    const overlay = ensurePurpleOverlay();

    const isHidden = overlay.style.opacity !== '1';
    // PHASE_OVERLAY_RECT_INSTANT: place instantly (no slide) whenever the active item changes,
    // not just when the overlay was hidden — avoids the brief old-rect→new-rect transition when
    // re-activating a different CoreItem while the overlay is still visible.
    const isNewItem = coreItem !== _activeCoreHighlightItem;
    let overlayVisible = true;
    if (isHidden || isNewItem) {
      overlay.style.transition = 'none';
      overlayVisible = _positionCoreHighlightOverlay(overlay, srcEl, coreItem, r, overlayRadius);
      void overlay.offsetHeight;
      overlay.style.transition = '';
    } else {
      overlayVisible = _positionCoreHighlightOverlay(overlay, srcEl, coreItem, r, overlayRadius);
    }
    if (!overlayVisible) return false;

    overlay.style.opacity = '1';
    // === PHASE_BADGE_ANCHOR_OVERLAY ===
    showCoreStatusBadge('default');
    // Anchor badge to the overlay's outer top-right (occlusion-aware), using
    // the same rect `r` that positioned the overlay. Runs on every overlay
    // (re)position: activation, scroll watcher, ResizeObserver, hover gate.
    positionCoreStatusBadgeToOverlay(r, coreItem);
    // === END PHASE_BADGE_ANCHOR_OVERLAY ===

    const isScrollUpdate = rectOverride !== null && !forceRestart;

    if (!isScrollUpdate) {
      // Reset clipped ring immediately (no transition) before applying new state.
      // Handles adjacent CoreItem hover where hideCoreHighlight() is not called.
      overlay.classList.remove('kickclip-clipped');
      // Phase 17: classify element by size (sqrt(area) — equivalent
      // square side length) and apply the matching size class. The
      // CSS scales box-shadow blur/spread so larger elements get more
      // visually prominent hover feedback.
      overlay.classList.remove(
        'kickclip-size-small',
        'kickclip-size-medium',
        'kickclip-size-large'
      );
      if (sizeMetric < 400) {
        overlay.classList.add('kickclip-size-small');
      } else if (sizeMetric < 700) {
        overlay.classList.add('kickclip-size-medium');
      } else {
        overlay.classList.add('kickclip-size-large');
      }
    }
    _activeCoreHighlightItem = coreItem;
    showShortcutTip(coreItem); // PHASE_SHORTCUT_TIP
    return true;
  } catch (e) {
    return false;
  }
}

export function hideCoreHighlight() {
  _kcCancelHideReset();
  const overlay = getKCShadowElement(PURPLE_OVERLAY_ID);
  if (overlay) {
    overlay.style.opacity = '0';
    _kcScheduleHideReset(overlay);
    _activeCoreHighlightItem = null;
  }
  hideShortcutTip(); // PHASE_SHORTCUT_TIP
  hideCoreStatusBadge();
}

// === PHASE_OVERLAY_LIFECYCLE_DECOUPLING ===
// Returns true when the CoreHighlight overlay is currently shown
// (showCoreHighlight succeeded most recently and no hideCoreHighlight
// has cleared it since). Used by the clip gate in coreEntry's
// saveActiveCoreItem to refuse clipping when the pointer is outside
// the overlay region (overlay/tooltip hidden but activeCoreItem still
// alive).
export function isCoreHighlightShown() {
  return _activeCoreHighlightItem != null;
}
// === END PHASE_OVERLAY_LIFECYCLE_DECOUPLING ===

// === PHASE_SHUTTER_REMOVAL ===
// Clip-completion ring removed. markCoreHighlightClipped is now an intentional no-op, kept
// exported for the saveActiveCoreItem call site. Clip success feedback is the toast stack only.
export function markCoreHighlightClipped() {}
// === END PHASE_SHUTTER_REMOVAL ===

function ensureGreenLayer() {
  let layer = getKCShadowElement(GREEN_LAYER_ID);
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = GREEN_LAYER_ID;
  layer.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483645;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    display: none;
  `;
  getKCShadowRoot().appendChild(layer);
  return layer;
}

export function renderItemMapCandidates(candidates) {
  ensureGreenLayer();
  for (const prev of greenOutlinedElements) {
    try {
      prev.style.removeProperty('outline');
      prev.style.removeProperty('outline-offset');
    } catch (e) {}
  }
  greenOutlinedElements = new Set();
  if (!ITEMMAP_DEBUG_OUTLINES) return;
  if (!Array.isArray(candidates) || candidates.length === 0) return;
  for (const item of candidates) {
    const el = item?.element;
    if (!el) continue;
    try {
      // === TYPED_PHASE20_RENDERER START ===
      // Phase 20 image-first Type D system uses similarityType 'typeD-image-first'.
      // Render those with black outline to distinguish from legacy Type D (orange).
      const isPhase20TypeD = item?.similarityType === 'typeD-image-first';
      const color =
        item?.evidenceType === EVIDENCE_TYPE_INTERACTION   ? 'red'     :
        item?.evidenceType === EVIDENCE_TYPE_IMAGE_ANCHOR ?
          (isPhase20TypeD ? '#3B82F6' : '#FFA500') :
        // === TYPED_REDESIGN_PHASE20_TYPEE — yellow for Type E fallback ===
        item?.evidenceType === EVIDENCE_TYPE_E             ? '#FACC15' :
        // === END TYPED_REDESIGN_PHASE20_TYPEE ===
        'green';
      // === TYPED_PHASE20_RENDERER END ===
      el.style.setProperty('outline', `2px solid ${color}`, 'important');
      el.style.setProperty('outline-offset', '-2px', 'important');
      greenOutlinedElements.add(el);
    } catch (e) {}
  }
}

export const showGreenCandidateOutline = renderItemMapCandidates;

export function clearCoreSelection() {
  state.activeCoreItem = null;
  state.activeHoverUrl = null;
  state.lastExtractedMetadata = null;
  hideCoreHighlight();
  hideMetadataTooltip();
}
