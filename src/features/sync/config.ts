/**
 * The Supabase project calendar items sync to. The publishable key is a
 * public, client-side key (like an app id); what a user can read or write is
 * enforced by row-level security in the database. Override either value
 * with EXPO_PUBLIC_* variables in .env (see .env.example).
 */
export const SUPABASE_URL = (
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://drrhnblmbdjnumgymzpj.supabase.co'
).replace(/\/+$/, '');

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  'sb_publishable_oP2MEQk-RjcOzby-s2n9lA_J98dYa4p';
