import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const env =
  (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const supabaseUrl =
  env.NEXT_PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  : null;

export const getSupabaseClient = () => {
  if (!supabase) {
    throw new Error(
      "Supabase nao configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY no ambiente."
    );
  }

  return supabase;
};
