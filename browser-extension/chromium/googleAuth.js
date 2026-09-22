/**
 * Shared Google OAuth access-token helper for extension pages and the service worker.
 * Chrome: chrome.identity.getAuthToken (unchanged behaviour when supported).
 * Fallback: launchWebAuthFlow with Firebase's web OAuth client when browser sign-in is off.
 */
(function (global) {
  'use strict';

  const KC_USE_WEB_OAUTH_FLOW_KEY = 'kc_use_web_oauth_flow_v1';
  const KC_WEB_OAUTH_SESSION_KEY = 'kc_web_oauth_access_v1';
  const KC_WEB_CLIENT_PLACEHOLDER = 'REPLACE_WITH_FIREBASE_WEB_OAUTH_CLIENT_ID';
  const KC_WEB_CLIENT_UNCONFIGURED_MSG =
    'Sign-in is not available in this browser yet.';
  const KC_TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

  function manifestOAuthScopes() {
    const oauth2 = chrome.runtime.getManifest()?.oauth2;
    if (oauth2 && Array.isArray(oauth2.scopes) && oauth2.scopes.length) {
      return oauth2.scopes.slice();
    }
    return [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.file',
    ];
  }

  function isWebClientConfigured() {
    const id = global.KC_WEB_OAUTH_CLIENT_ID;
    if (!id || typeof id !== 'string') return false;
    const trimmed = id.trim();
    if (!trimmed || trimmed === KC_WEB_CLIENT_PLACEHOLDER) return false;
    if (trimmed.includes('REPLACE_WITH')) return false;
    return trimmed.endsWith('.apps.googleusercontent.com');
  }

  function isUserCancelError(message) {
    const m = String(message || '').toLowerCase();
    return (
      m.includes('the user did not approve access') ||
      m.includes('user did not approve') ||
      m.includes('user cancelled') ||
      m.includes('user canceled') ||
      m.includes('oauth2 request failed: access_denied') ||
      m.includes('access_denied')
    );
  }

  function isBrowserSignInUnsupportedError(message) {
    const m = String(message || '').toLowerCase();
    if (isUserCancelError(message)) return false;
    if (m.includes('turned off browser signin')) return true;
    if (m.includes('browser signin is disabled')) return true;
    if (m.includes('browser sign-in is disabled')) return true;
    if (m.includes('browser signin') && m.includes('not supported')) return true;
    if (m.includes('browser sign-in') && m.includes('not supported')) return true;
    return false;
  }

  function getAuthTokenChrome(options) {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken(options, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'getAuthToken failed'));
          return;
        }
        if (!token) {
          reject(new Error('No token returned'));
          return;
        }
        resolve(token);
      });
    });
  }

  function readWebOAuthSession() {
    return new Promise((resolve) => {
      if (!chrome.storage?.session) {
        resolve(null);
        return;
      }
      chrome.storage.session.get(KC_WEB_OAUTH_SESSION_KEY, (result) => {
        resolve(result?.[KC_WEB_OAUTH_SESSION_KEY] || null);
      });
    });
  }

  function writeWebOAuthSession(payload) {
    return new Promise((resolve) => {
      if (!chrome.storage?.session) {
        resolve();
        return;
      }
      chrome.storage.session.set({ [KC_WEB_OAUTH_SESSION_KEY]: payload }, resolve);
    });
  }

  function clearWebOAuthSession() {
    return new Promise((resolve) => {
      if (!chrome.storage?.session) {
        resolve();
        return;
      }
      chrome.storage.session.remove(KC_WEB_OAUTH_SESSION_KEY, resolve);
    });
  }

  function readUseWebOAuthFlowFlag() {
    return new Promise((resolve) => {
      chrome.storage.local.get(KC_USE_WEB_OAUTH_FLOW_KEY, (result) => {
        resolve(!!result?.[KC_USE_WEB_OAUTH_FLOW_KEY]);
      });
    });
  }

  function setUseWebOAuthFlowFlag() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [KC_USE_WEB_OAUTH_FLOW_KEY]: true }, resolve);
    });
  }

  function parseOAuthRedirectFragment(redirectUrl) {
    const hash = String(redirectUrl || '').split('#')[1] || '';
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    if (!accessToken) {
      const err = params.get('error');
      const errDesc = params.get('error_description');
      if (err === 'access_denied') {
        throw new Error('The user did not approve access.');
      }
      throw new Error(errDesc || err || 'No access_token in redirect');
    }
    const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
    const expiresAt = Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000;
    return { accessToken, expiresAt };
  }

  function buildWebAuthUrl(interactive) {
    const clientId = global.KC_WEB_OAUTH_CLIENT_ID.trim();
    const redirectUri = chrome.identity.getRedirectURL();
    const scopes = manifestOAuthScopes().join(' ');
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'token',
      redirect_uri: redirectUri,
      scope: scopes,
      include_granted_scopes: 'true',
    });
    if (interactive) {
      params.set('prompt', 'select_account');
    } else {
      params.set('prompt', 'none');
    }
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  function launchWebAuthFlow(interactive) {
    return new Promise((resolve, reject) => {
      const url = buildWebAuthUrl(interactive);
      chrome.identity.launchWebAuthFlow(
        { url, interactive },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message || 'launchWebAuthFlow failed'));
            return;
          }
          if (!redirectUrl) {
            reject(new Error('Empty redirect from launchWebAuthFlow'));
            return;
          }
          try {
            resolve(parseOAuthRedirectFragment(redirectUrl));
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  }

  async function getWebOAuthAccessToken(interactive) {
    if (!isWebClientConfigured()) {
      throw new Error(KC_WEB_CLIENT_UNCONFIGURED_MSG);
    }

    const cached = await readWebOAuthSession();
    if (cached?.accessToken && cached.expiresAt > Date.now() + KC_TOKEN_REFRESH_BUFFER_MS) {
      return cached.accessToken;
    }

    if (cached?.accessToken) {
      await clearWebOAuthSession();
    }

    try {
      const parsed = await launchWebAuthFlow(false);
      await writeWebOAuthSession(parsed);
      return parsed.accessToken;
    } catch (silentErr) {
      if (!interactive) {
        throw silentErr;
      }
      if (isUserCancelError(silentErr?.message)) {
        throw silentErr;
      }
      const parsed = await launchWebAuthFlow(true);
      await writeWebOAuthSession(parsed);
      return parsed.accessToken;
    }
  }

  async function getGoogleAccessToken(options) {
    const interactive = options?.interactive !== false;
    const scopes = manifestOAuthScopes();
    const useWeb = await readUseWebOAuthFlowFlag();

    if (!useWeb) {
      try {
        const tokenOpts = { interactive, scopes };
        return await getAuthTokenChrome(tokenOpts);
      } catch (err) {
        if (isUserCancelError(err?.message)) {
          throw err;
        }
        if (isBrowserSignInUnsupportedError(err?.message)) {
          await setUseWebOAuthFlowFlag();
          return getWebOAuthAccessToken(interactive);
        }
        throw err;
      }
    }

    return getWebOAuthAccessToken(interactive);
  }

  async function discardGoogleAccessToken(token) {
    if (token) {
      try {
        await new Promise((resolve) => {
          chrome.identity.removeCachedAuthToken({ token }, resolve);
        });
      } catch (_) {}
    }
    await clearWebOAuthSession();
  }

  async function discardAllGoogleAccessTokens() {
    let chromeToken = null;
    try {
      chromeToken = await getAuthTokenChrome({ interactive: false });
    } catch (_) {}
    await discardGoogleAccessToken(chromeToken);
  }

  global.KC_googleAuth = {
    KC_USE_WEB_OAUTH_FLOW_KEY,
    KC_WEB_OAUTH_SESSION_KEY,
    KC_WEB_CLIENT_UNCONFIGURED_MSG,
    getGoogleAccessToken,
    discardGoogleAccessToken,
    discardAllGoogleAccessTokens,
    isUserCancelError,
    isBrowserSignInUnsupportedError,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
