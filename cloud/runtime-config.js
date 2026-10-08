(() => {
  'use strict';

  const LEGACY_OG_ORIGIN='https://stats-maker-ogp.vercel.app';
  const host=String(location.hostname||'').toLowerCase();
  const isGithubPages=host.endsWith('.github.io');
  const isLocal=host==='localhost'||host==='127.0.0.1'||host==='';

  window.SM_RUNTIME=Object.assign({},window.SM_RUNTIME,{
    // GitHub Pages keeps the existing Vercel share backend.
    // Cloudflare workers.dev / the future custom domain use same-origin /p and /api/og routes.
    ogShareOrigin:(!isGithubPages&&!isLocal)?location.origin:LEGACY_OG_ORIGIN
  });
})();
