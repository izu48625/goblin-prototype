(() => {
  'use strict';

  const CANONICAL_SHARE_ORIGIN='https://statsmaker.app';
  const host=String(location.hostname||'').toLowerCase();
  const isGithubPages=host.endsWith('.github.io');
  const isLocal=host==='localhost'||host==='127.0.0.1'||host==='';

  window.SM_RUNTIME=Object.assign({},window.SM_RUNTIME,{
    // GitHub Pages and local previews always create links to the official
    // Cloudflare-guarded share endpoint, never the directly reachable legacy
    // Vercel preview host. Hosted Cloudflare sites keep their own origin.
    ogShareOrigin:(isGithubPages||isLocal)?CANONICAL_SHARE_ORIGIN:location.origin
  });
})();
