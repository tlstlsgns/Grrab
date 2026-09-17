// Manifest marker for build:prod — const KC_IS_DEV = false;
// Idempotent: manifest + programmatic inject may both load this file in the same frame.
if (typeof globalThis.KC_IS_DEV === 'undefined') {
  globalThis.KC_IS_DEV = false;
  globalThis.KC_SERVER_URL = globalThis.KC_IS_DEV
    ? 'https://api-gstf2hxbiq-du.a.run.app'
    : 'https://api-hn4mxotviq-du.a.run.app';
}
