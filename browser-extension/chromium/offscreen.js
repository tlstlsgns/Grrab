import { superResolveToWidth, warmUpSr } from './superResolve.js'; // PHASE_CLIP_SIZE
import { removeBackground } from './backgroundRemove.js'; // PHASE_BG_REMOVE

const toDataURL = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg?.target !== 'offscreen') return;
  // === PHASE_CLIP_SIZE ===
  if (msg.action === 'sr-warm') {
    warmUpSr();
    sendResponse?.({ ok: true });
    return;
  }
  if (msg.action === 'sr-upscale-run') {
    (async () => {
      try {
        const blob = await (await fetch(msg.dataUrl)).blob();
        const up = await superResolveToWidth(blob, msg.targetWidth);
        if (!up) { sendResponse({ ok: false, error: 'sr-null' }); return; }
        sendResponse({ ok: true, dataUrl: await toDataURL(up) });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
  // === END PHASE_CLIP_SIZE ===
  // === PHASE_BG_REMOVE ===
  if (msg.action === 'bg-remove-run') {
    (async () => {
      try {
        const blob = await (await fetch(msg.dataUrl)).blob();
        const out = await removeBackground(blob);
        if (!out) { sendResponse({ ok: false, error: 'bg-null' }); return; }
        sendResponse({ ok: true, dataUrl: await toDataURL(out) });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
  // === END PHASE_BG_REMOVE ===
});
