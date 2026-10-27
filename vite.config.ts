import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/** Lists the built code files (JS and CSS, not the large fonts) for the service worker to keep on the first visit. */
function precacheList(): Plugin {
  return {
    name: 'studymap-precache',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => /\.(js|css)$/.test(f) && f.startsWith('assets/'));
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(files) });
    },
  };
}

/**
 * Link previews (Facebook, LinkedIn, WhatsApp) need the picture's full address. The site's address comes from
 * SITE_URL when set (e.g. https://studymap.pages.dev), else from Cloudflare Pages' own CF_PAGES_URL at build time;
 * a build with neither keeps the relative path, which works for the site itself.
 */
function absoluteShareImage(): Plugin {
  const site = (process.env.SITE_URL || process.env.CF_PAGES_URL || '').replace(/\/+$/, '');
  return {
    name: 'studymap-share-image',
    apply: 'build',
    transformIndexHtml(html) {
      if (!site) return html;
      return html.replaceAll('content="./og-image.png"', `content="${site}/og-image.png"`)
        .replace('<meta property="og:type"', `<meta property="og:url" content="${site}/" />\n    <meta property="og:type"`);
    },
  };
}

export default defineConfig({
  plugins: [svelte(), precacheList(), absoluteShareImage()],
  base: './',
});
