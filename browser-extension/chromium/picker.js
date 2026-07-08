// picker.js — runs in a dedicated extension popup window, invokes showDirectoryPicker,
// persists handle to IndexedDB, notifies side panel, and closes itself.

import { setPrimaryHandle, setDestination } from './uploadStorage.js';

const btn = document.getElementById('pick');
const driveBtn = document.getElementById('pick-drive');
const downloadsBtn = document.getElementById('pick-downloads');
const statusEl = document.getElementById('status');

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = kind || '';
}

async function closeSelfTab() {
  try {
    const tab = await chrome.tabs.getCurrent();
    if (tab?.windowId) {
      await chrome.windows.remove(tab.windowId);
      return;
    }
    if (tab?.id) {
      await chrome.tabs.remove(tab.id);
    }
  } catch (_) {}
}

/** Helper to notify side panel of busy state; safe if side panel is closed */
function notifyBusy(isBusy) {
  try {
    chrome.runtime.sendMessage({
      action: 'kc-picker-busy',
      busy: Boolean(isBusy),
    });
  } catch (_) {}
}

/**
 * Drive button handler (Phase U3.3c).
 * Skips Google Picker (incompatible with MV3 CSP) and directly creates/
 * reuses Grrab_files in user's My Drive root. Picker API reintroduction
 * (folder selection UI) is deferred to Phase U4 with a custom tree view.
 */
async function handleDriveButtonClick() {
  setStatus('Connecting to Google Drive…', '');
  notifyBusy(true);

  try {
    const tokenResp = await chrome.runtime.sendMessage({
      action: 'get-google-oauth-token',
      scopes: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });
    if (!tokenResp?.token) {
      setStatus('Google sign-in failed. Please try again.', 'error');
      notifyBusy(false);
      return;
    }

    setStatus('Setting up the Grrab_files folder in your Drive…', '');
    const ensureResp = await chrome.runtime.sendMessage({
      action: 'drive-ensure-folder',
      parentFolderId: 'root',
      parentFolderName: 'My Drive',
    });
    if (!ensureResp?.ok) {
      setStatus(`Couldn't set up the folder: ${ensureResp?.message || 'Unknown'}`, 'error');
      notifyBusy(false);
      return;
    }

    const saved = await setDestination({
      type: 'drive',
      driveFolderId: ensureResp.folderId,
      driveFolderName: ensureResp.folderName,
      driveParentFolderId: ensureResp.parentFolderId,
      driveParentFolderName: ensureResp.parentFolderName,
    });
    if (!saved) {
      setStatus('Unable to save. Please try again.', 'error');
      notifyBusy(false);
      return;
    }

    notifyBusy(false);
    setStatus(
      `✓ Your Drive's "Grrab_files" folder is set. Closing…`,
      'success'
    );
    try {
      chrome.runtime.sendMessage({
        action: 'kc-picker-drive-ready',
        destination: {
          type: 'drive',
          driveFolderId: ensureResp.folderId,
          driveFolderName: ensureResp.folderName,
          driveParentFolderId: ensureResp.parentFolderId,
          driveParentFolderName: ensureResp.parentFolderName,
        },
      });
    } catch (_) {}
    setTimeout(closeSelfTab, 1200);
  } catch (e) {
    setStatus(`Error: ${e?.message || String(e)}`, 'error');
    notifyBusy(false);
  }
}

// Export for Phase U3.3b wiring
window.handleDriveButtonClick = handleDriveButtonClick;

btn.addEventListener('click', async () => {
  btn.disabled = true;
  if (driveBtn) driveBtn.disabled = true;
  setStatus('Opening the folder picker…', '');

  // Tell side panel we're opening the system dialog — suppress auto-close
  notifyBusy(true);

  let handle;
  try {
    handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (e) {
    notifyBusy(false);
    if (e && (e.name === 'AbortError' || e.code === 20)) {
      // User cancelled (or cancelled Chrome's sensitive-folder dialog).
      // Not an error: silently re-enable buttons so the user can retry.
      btn.disabled = false;
      if (driveBtn) driveBtn.disabled = false;
      return;
    }
    setStatus(`Error: ${e?.message || e}`, 'error');
    btn.disabled = false;
    if (driveBtn) driveBtn.disabled = false;
    return;
  }

  // Dialog closed (user selected). Re-enable auto-close.
  notifyBusy(false);

  // Verify readwrite permission
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      const req = await handle.requestPermission({ mode: 'readwrite' });
      if (req !== 'granted') {
        setStatus('Write permission was denied for this folder.', 'error');
        btn.disabled = false;
        if (driveBtn) driveBtn.disabled = false;
        return;
      }
    }
  } catch (e) {
    setStatus(`Permission check failed: ${e?.message || e}`, 'error');
    btn.disabled = false;
    if (driveBtn) driveBtn.disabled = false;
    return;
  }

  // Persist
  try {
    await setPrimaryHandle(handle);
  } catch (e) {
    setStatus(`Couldn't save: ${e?.message || e}`, 'error');
    btn.disabled = false;
    if (driveBtn) driveBtn.disabled = false;
    return;
  }

  setStatus(`✓ "${handle.name}" is set as your folder. Closing…`, 'success');

  try {
    chrome.runtime.sendMessage({
      action: 'kc-picker-handle-ready',
      folderName: handle.name,
    });
  } catch (_) {}

  setTimeout(closeSelfTab, 800);
});

// Wire Google Drive button (Phase U3.3b)
if (driveBtn) {
  driveBtn.addEventListener('click', async () => {
    btn.disabled = true;
    driveBtn.disabled = true;
    try {
      await handleDriveButtonClick();
    } finally {
      btn.disabled = false;
      driveBtn.disabled = false;
    }
  });
}

// Wire Default (Downloads) button — sets destination to {type:'downloads'}.
// No system dialog or OAuth: chrome.downloads writes to the Downloads root.
async function handleDownloadsButtonClick() {
  setStatus('Setting Downloads as your location…', '');
  notifyBusy(true);
  try {
    const saved = await setDestination({ type: 'downloads' });
    if (!saved) {
      setStatus('Unable to save. Please try again.', 'error');
      notifyBusy(false);
      return;
    }
    notifyBusy(false);
    setStatus('✓ Downloads is set as your location. Closing…', 'success');
    try {
      chrome.runtime.sendMessage({ action: 'kc-picker-downloads-ready' });
    } catch (_) {}
    setTimeout(closeSelfTab, 800);
  } catch (e) {
    setStatus(`Error: ${e?.message || String(e)}`, 'error');
    notifyBusy(false);
  }
}

if (downloadsBtn) {
  downloadsBtn.addEventListener('click', async () => {
    btn.disabled = true;
    driveBtn.disabled = true;
    downloadsBtn.disabled = true;
    try {
      await handleDownloadsButtonClick();
    } finally {
      btn.disabled = false;
      driveBtn.disabled = false;
      downloadsBtn.disabled = false;
    }
  });
}
