import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials missing. Check your .env file.');
}

const REMEMBER_ME_KEY = 'estaca_este_remember_me';
const FORCE_ACCOUNT_SELECT_KEY = 'estaca_este_force_account_select';

export function getRememberMePreference(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(REMEMBER_ME_KEY) !== 'false';
}

export function setRememberMePreference(remember: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REMEMBER_ME_KEY, String(remember));
}

export function getForceAccountSelect(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(FORCE_ACCOUNT_SELECT_KEY) === 'true';
}

export function setForceAccountSelect(force: boolean): void {
  if (typeof window === 'undefined') return;
  if (force) {
    window.localStorage.setItem(FORCE_ACCOUNT_SELECT_KEY, 'true');
  } else {
    window.localStorage.removeItem(FORCE_ACCOUNT_SELECT_KEY);
  }
}

const authStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    if (getRememberMePreference()) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
      window.localStorage.removeItem(key);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
