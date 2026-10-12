import { createClient } from '@supabase/supabase-js';

const getEnvVar = (name: string): string => {
  try {
    const metaVal = (import.meta.env as Record<string, any>)?.[name];
    if (typeof metaVal === 'string' && metaVal.trim()) {
      return metaVal.trim();
    }
  } catch {}

  try {
    if (typeof process !== 'undefined' && process.env) {
      const procVal = (process.env as Record<string, any>)?.[name];
      if (typeof procVal === 'string' && procVal.trim()) {
        return procVal.trim();
      }
    }
  } catch {}

  return '';
};

// Authoritative default Supabase credentials for Concerned Citizens of PE Metro
export const DEFAULT_SUPABASE_URL = 'https://majiuodmywmnfssxzpcf.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_8ZgZ0zS0ra4ejosOC4HIOQ_kdfU7fPU';

const rawSupabaseUrl = (
  getEnvVar('VITE_SUPABASE_URL') ||
  getEnvVar('SUPABASE_URL') ||
  DEFAULT_SUPABASE_URL
);

export const cleanSupabaseUrl = rawSupabaseUrl
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');

export const supabasePublishableKey = (
  getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') ||
  getEnvVar('VITE_SUPABASE_ANON_KEY') ||
  getEnvVar('SUPABASE_ANON_KEY') ||
  getEnvVar('SUPABASE_PUBLISHABLE_KEY') ||
  DEFAULT_SUPABASE_KEY
);

export const isSupabaseConfigured = Boolean(
  cleanSupabaseUrl &&
  supabasePublishableKey &&
  cleanSupabaseUrl !== 'YOUR_SUPABASE_PROJECT_URL' &&
  !cleanSupabaseUrl.includes('placeholder')
);

// Fallback to avoid fatal initialization errors when environment variables have not been configured yet
const safeUrl = isSupabaseConfigured ? cleanSupabaseUrl : 'https://placeholder-project.supabase.co';
const safeKey = isSupabaseConfigured ? supabasePublishableKey : 'placeholder-anon-key';

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const STORAGE_BUCKET = 'community-images';
export default supabase;
