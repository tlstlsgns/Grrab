// Manifest marker for build:dev — const KC_IS_DEV = true;
// Idempotent: manifest + programmatic inject may both load this file in the same frame.
if (typeof globalThis.KC_IS_DEV === 'undefined') {
  globalThis.KC_IS_DEV = true;
  globalThis.KC_SERVER_URL = globalThis.KC_IS_DEV
    ? 'https://api-gstf2hxbiq-du.a.run.app'
    : 'https://api-hn4mxotviq-du.a.run.app';
}
if (typeof globalThis.KC_WEB_OAUTH_CLIENT_ID === 'undefined') {
  globalThis.KC_WEB_OAUTH_CLIENT_ID = '658386350246-a9pv7t1ajedkl5fo99idvk45sf7sfagf.apps.googleusercontent.com';
}
