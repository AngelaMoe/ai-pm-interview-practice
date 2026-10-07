// learn/supabase-client.js
// Server-only Supabase client, created on first use (never at import time, so
// the server still starts when the env vars are absent).
// Uses the secret / service role key: it must never reach the browser.

import { createClient } from '@supabase/supabase-js';

let client = null;

// Returns null when Supabase isn't configured; callers treat that as
// "progress unavailable" (503) rather than an error.
export function getSupabase() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return client;
}
