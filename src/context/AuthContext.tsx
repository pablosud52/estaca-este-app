import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEV_PROFILES } from '../data/seedData';
import { supabase } from '../lib/supabase';
import { OrganizationCode, UserProfile } from '../types/database';

interface AuthContextValue {
  user: UserProfile;
  profiles: UserProfile[];
  switchProfileById: (profileId: string) => void;
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
          // Merge remote profiles with dev simulation profiles without losing dev test personas
          const remoteEmails = new Set(data.map((d) => d.email));
          const merged: UserProfile[] = [
            ...DEV_PROFILES.filter((p) => !remoteEmails.has(p.email)),
            ...(data as UserProfile[]),
          ];
          setProfiles(merged);
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
