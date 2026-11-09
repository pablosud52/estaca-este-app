import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEV_PROFILES } from '../data/seedData';
import { supabase } from '../lib/supabase';
import { OrganizationCode, UserProfile } from '../types/database';

interface AuthContextValue {
  user: UserProfile;
  profiles: UserProfile[];
  switchProfileById: (profileId: string) => void;
  updateUserProfile: (id: string, updates: Partial<UserProfile>) => Promise<void>;
  addUserProfile: (newProfile: Omit<UserProfile, 'id'>) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isSimulating: boolean;
  /** Organizaciones que este usuario tiene permiso de ver */
  allowedOrganizations: OrganizationCode[];
  /** Si el usuario pertenece a MJ o HJ y puede alternar/incluir Seminario */
  canAccessSeminario: boolean;
}

const STORAGE_KEY = 'estaca_este_active_profile_id';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<UserProfile[]>(DEV_PROFILES);
  const [user, setUser] = useState<UserProfile>(() => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return DEV_PROFILES.find((p) => p.id === savedId) || DEV_PROFILES[0];
  });
  const [isSimulating, setIsSimulating] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function syncSupabaseProfiles() {
      try {
        const { data, error } = await supabase
          .from('users_profiles')
          .select('*')
          .order('full_name', { ascending: true });

        if (!error && data && data.length > 0 && mounted) {
          // Merge remote profiles preserving deterministic DEV_PROFILES IDs when email matches
          const devByEmail = new Map(
            DEV_PROFILES.map((p) => [p.email.toLowerCase(), p])
          );
          const remoteEmails = new Set(
            data.map((d) => String(d.email || '').toLowerCase())
          );

          const normalizedRemote: UserProfile[] = data.map((d) => {
            const devMatch = devByEmail.get(String(d.email || '').toLowerCase());
            return {
              ...(d as UserProfile),
              id: devMatch ? devMatch.id : String(d.id),
            };
          });

          setProfiles((prev) => {
            const prevById = new Map(prev.map((item) => [item.id, item]));
            const merged: UserProfile[] = [
              ...DEV_PROFILES.filter((p) => !remoteEmails.has(p.email.toLowerCase())),
              ...normalizedRemote,
            ];
            return merged.map((item) => prevById.get(item.id) || item);
          });
        }
      } catch {
        // Fallback silencioso a DEV_PROFILES en caso de desconexión local
      }
    }

    syncSupabaseProfiles();
    return () => {
      mounted = false;
    };
  }, []);

  const switchProfileById = (profileId: string) => {
    const target = profiles.find((p) => p.id === profileId) || DEV_PROFILES.find((p) => p.id === profileId);
    if (target) {
      setUser(target);
      setIsSimulating(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, target.id);
      }
    }
  };

  const updateUserProfile = async (id: string, updates: Partial<UserProfile>) => {
    setProfiles((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        // Regla Sagrada #1: Ningún administrador puede quitarse permisos ni modificar un admin permanente
        if (item.is_permanent_admin || item.email === user.email) {
          return item;
        }
        return { ...item, ...updates };
      })
    );

    try {
      await supabase.from('users_profiles').update(updates).eq('id', id);
    } catch {
      // Estado local ya actualizado
    }
  };

  const addUserProfile = async (newProfile: Omit<UserProfile, 'id'>) => {
    const created: UserProfile = {
      ...newProfile,
      id: `user-${Date.now()}`,
    };
    setProfiles((prev) => [...prev, created]);

    try {
      await supabase.from('users_profiles').insert([newProfile]);
    } catch {
      // Estado local ya actualizado
    }
  };

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    switchProfileById(DEV_PROFILES[0].id);
  };

  const canAccessSeminario =
    user.role === 'ADMIN' ||
    user.role === 'PRESIDENCIA' ||
    user.organization === 'MJ' ||
    user.organization === 'HJ';

  const allowedOrganizations: OrganizationCode[] = React.useMemo(() => {
    if (!user.is_active || user.role === 'NO_AUTORIZADO') return [];
    if (user.role === 'ADMIN' || user.role === 'PRESIDENCIA') {
      return ['MJ', 'HJ', 'SEMINARIO', 'SS', 'PRIMARIA', 'JAS', 'AS', 'CFS', 'ESTACA'];
    }
    if (user.organization === 'MJ' || user.organization === 'HJ') {
      return [user.organization, 'SEMINARIO'];
    }
    return [user.organization];
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profiles,
        switchProfileById,
        updateUserProfile,
        addUserProfile,
        signInWithGoogle,
        signOut,
        isSimulating,
        allowedOrganizations,
        canAccessSeminario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  }
  return ctx;
}
