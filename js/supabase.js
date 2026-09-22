(() => {
  'use strict';

  const SUPABASE_URL = 'https://ibpdxbeltdwkquowjeay.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_6abnwW_1p-U_Y_DefUXfFQ_Dz_Y2vsD';

  if (!window.supabase || !window.supabase.createClient) {
    console.error('[Stats Maker] Supabase library is not loaded.');
    window.SM_SUPABASE = { ready:false, error:'library-not-loaded' };
    return;
  }

  const client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  window.SM_SUPABASE = {
    ready: true,
    client,
    url: SUPABASE_URL
  };
})();
