/* eslint-disable no-console */
// Bundles the content script's module graph into one classic script.
//
// The graph is loaded today with import(chrome.runtime.getURL('coreEntry.js')), which the
// browser caches per isolated world for the life of the page. That cache is what makes a
// re-injected script inert: the new file's URL is unchanged, so import() hands back the
// old instances and none of the new code runs. A classic script has no such cache —
// chrome.scripting.executeScript re-executes it, with fresh module state, every time.
//
// eraseOverlay.js is included even though it is loaded lazily at clip time. Left outside,
// it would be the one module-cache entry still standing.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ERASE_OVERLAY_DYNAMIC_IMPORT =
  /const mod = await import\(chrome\.runtime\.getURL\('eraseOverlay\.js'\)\);/;

/**
 * eraseOverlay is reached only through a runtime-computed dynamic import(), which esbuild
 * cannot follow statically. A second entry point would emit a separate file and leave the
 * dynamic import() in coreEntry — the module-cache entry would remain. Instead, an esbuild
 * plugin rewrites that one line at build time to a static import namespace binding; the
 * source file on disk is untouched.
 */
function eraseOverlayInlinePlugin(chromiumDir) {
  const coreEntryPath = path.join(chromiumDir, 'coreEntry.js');

  return {
    name: 'inline-erase-overlay',
    setup(build) {
      build.onLoad({ filter: /coreEntry\.js$/ }, async (args) => {
        if (path.resolve(args.path) !== path.resolve(coreEntryPath)) return null;
        let contents = await fs.promises.readFile(args.path, 'utf8');
        if (!ERASE_OVERLAY_DYNAMIC_IMPORT.test(contents)) {
          throw new Error(
            'coreEntry.js: expected `const mod = await import(chrome.runtime.getURL(\'eraseOverlay.js\'));`'
          );
        }
        contents = contents.replace(
          ERASE_OVERLAY_DYNAMIC_IMPORT,
          'const mod = __kcEraseOverlayModule;'
        );
        contents = `import * as __kcEraseOverlayModule from './eraseOverlay.js';\n${contents}`;
        return { contents, loader: 'js', resolveDir: chromiumDir };
      });
    },
  };
}

async function bundleContent(chromiumDir, outFile) {
  const result = await esbuild.build({
    entryPoints: [path.join(chromiumDir, 'coreEntry.js')],
    bundle: true,
    format: 'iife',
    target: 'chrome110',
    platform: 'browser',
    outfile: outFile,
    logLevel: 'warning',
    legalComments: 'none',
    // KC_IS_DEV is a global from config.js, a classic script the manifest loads first.
    // It is NOT part of the module graph, so esbuild must be told to leave it alone.
    define: {},
    metafile: true,
    plugins: [eraseOverlayInlinePlugin(chromiumDir)],
  });
  return result;
}

module.exports = { bundleContent };
