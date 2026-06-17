import { superResolveToWidth, warmUpSr } from './superResolve.js'; // PHASE_CLIP_SIZE

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
});
