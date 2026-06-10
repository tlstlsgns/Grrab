import { removeBackgroundPngBlob, warmUpBgr } from './bgRemoval.js';

const toDataURL = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg?.target !== 'offscreen') return;
  if (msg.action === 'bgr-warm') {
    warmUpBgr();
    sendResponse?.({ ok: true });
    return;
  }
  if (msg.action === 'bgr-cutout-run') {
    (async () => {
      try {
        const blob = await (await fetch(msg.dataUrl)).blob();
        const cut = await removeBackgroundPngBlob(blob);
        sendResponse({ ok: true, dataUrl: await toDataURL(cut) });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
});
