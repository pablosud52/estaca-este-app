import React, { useState } from 'react';
import { Shield, Users, UserCheck, Lock, ChevronUp, ChevronDown, Sparkles, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEV_PROFILES } from '../data/seedData';
import { ORGANIZATION_SHORT_LABELS } from '../lib/formatters';

export const DevRoleSwitcher: React.FC = () => {
  const { user, switchProfileById } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'PRESIDENCIA':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'LIDER':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      default:
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    }
  };

  return (
    <div
      data-testid="dev-role-switcher"
      className="fixed bottom-4 right-4 z-50 flex flex-col items-end"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Expanded Menu */}
      {isOpen && (
        <div
          data-testid="dev-role-menu"
          className="mb-2.5 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-slate-900/95 backdrop-blur-md text-white shadow-2xl border border-slate-700/80 overflow-hidden transition-all duration-200 ease-out-expo origin-bottom-right"
        >
          <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold tracking-wider uppercase text-slate-200">
                Simulador RBAC (Paso 6.1)
              </span>
            </div>
            <span className="text-[10px] font-mono bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
              Dev Mode
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80 p-1.5">
            {DEV_PROFILES.map((profile) => {
              const isSelected = user.email === profile.email;
              return (
                <button
                  key={profile.id}
                  type="button"
                  data-testid={`switch-role-${profile.id}`}
                  onClick={() => {
                    switchProfileById(profile.id);
                    setIsOpen(false);
                  }}
                  className={`pressable w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 transition ${
                    isSelected
                      ? 'bg-emerald-950/90 border border-emerald-500/40 text-white'
                      : 'hover:bg-slate-800/70 text-slate-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate">{profile.full_name}</span>
                      {profile.is_permanent_admin && (
                        <span
                          title="Administrador Permanente Inmutable (Regla Sagrada #1)"
                          className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-300 rounded border border-amber-500/30"
                        >
                          Inmutable
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{profile.calling}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getRoleBadgeStyle(
                        profile.role
                      )}`}
                    >
                      {profile.role === 'LIDER'
                        ? ORGANIZATION_SHORT_LABELS[profile.organization]
                        : profile.role === 'NO_AUTORIZADO'
                        ? 'BLOQUEADO'
                        : profile.role}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Pill Trigger */}
      <button
        type="button"
        data-testid="dev-role-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        className="pressable flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-slate-900/95 text-white shadow-xl border border-slate-700/80 backdrop-blur-md text-xs font-semibold"
      >
        {user.role === 'ADMIN' ? (
          <Shield className="w-3.5 h-3.5 text-amber-400" />
        ) : user.role === 'PRESIDENCIA' ? (
          <Users className="w-3.5 h-3.5 text-sky-400" />
        ) : user.role === 'LIDER' ? (
          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Lock className="w-3.5 h-3.5 text-rose-400" />
        )}
        <span className="max-w-[140px] truncate">{user.full_name}</span>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getRoleBadgeStyle(
            user.role
          )}`}
        >
          {user.role === 'LIDER' ? user.organization : user.role}
        </span>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        )}
      </button>
    </div>
  );
};
