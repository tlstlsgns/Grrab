import { superResolveToWidth, warmUpSr, getSrMaxPixels } from './superResolve.js'; // PHASE_CLIP_SIZE
import { inpaintWithMask } from './inpaint.js'; // PHASE_ERASE

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
        const outDataUrl = await toDataURL(up);
        sendResponse({ ok: true, dataUrl: outDataUrl });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
  if (msg.action === 'sr-max-pixels') {
    (async () => {
      try {
        const px = await getSrMaxPixels();
        sendResponse({ ok: true, px });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
  // === END PHASE_CLIP_SIZE ===
  // === PHASE_ERASE ===
  if (msg.action === 'inpaint-run') {
    (async () => {
      try {
        const blob = await (await fetch(msg.dataUrl)).blob();
        const maskBlob = await (await fetch(msg.maskDataUrl)).blob();
        const out = await inpaintWithMask(blob, maskBlob);
        if (!out) { sendResponse({ ok: false, error: 'inpaint-null' }); return; }
        sendResponse({ ok: true, dataUrl: await toDataURL(out) });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
  // === END PHASE_ERASE ===
});
