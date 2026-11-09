import React, { useState } from 'react';
import { ShieldCheck, Users, Eye, Sparkles, Lock } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DevRoleSwitcher } from './components/DevRoleSwitcher';
import { UnauthorizedView } from './components/UnauthorizedView';
import { LeaderView } from './views/LeaderView';
import { OrganizationCode } from './types/database';
import { ORGANIZATION_LABELS, ORGANIZATION_SHORT_LABELS } from './lib/formatters';

const STAKE_ORGS: OrganizationCode[] = [
  'MJ',
  'HJ',
  'PRIMARIA',
  'SS',
  'AS',
  'JAS',
  'CFS',
  'ESTACA',
];

const AppRouter: React.FC = () => {
  const { user } = useAuth();
  const [inspectedOrg, setInspectedOrg] = useState<OrganizationCode | null>(null);

  // 1. Usuario No Autorizado o Inactivo -> Mensaje Oficial de Bloqueo
  if (!user.is_active || user.role === 'NO_AUTORIZADO') {
    return <UnauthorizedView />;
  }

  // 2. Perfil Líder -> Ingresa directo a la Vista Móvil de su Organización (Paso 6.2)
  if (user.role === 'LIDER') {
    return <LeaderView />;
  }

  // 3. Si Presidencia o Admin seleccionó una organización para ver su vista espejo
  if (inspectedOrg) {
    return <LeaderView inspectedOrg={inspectedOrg} onBackToHub={() => setInspectedOrg(null)} />;
  }

  // 4. Hub Puente para Presidencia / Administrador (el desarrollo completo corresponde al Paso 6.3 y 6.4)
  return (
    <div
      data-testid="executive-bridge-hub"
      className="min-h-[100dvh] bg-slate-100 flex flex-col justify-between pb-24"
    >
      <header
        className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-900 text-emerald-50">
              Estaca Montevideo Uruguay Este
            </span>
            <h1 className="text-sm font-extrabold text-slate-900 mt-1">
              Hub de {user.role === 'ADMIN' ? 'Administración y Presidencia' : 'Presidencia de Estaca'}
            </h1>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>{user.full_name}</span>
            </span>
            {user.is_permanent_admin && (
              <p
                data-testid="permanent-admin-badge"
                className="text-[10px] font-bold text-amber-700 mt-0.5"
              >
                ★ Administrador Permanente Inmutable
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg w-full mx-auto px-4 pt-5 space-y-4 flex-1">
        <div className="bg-gradient-to-br from-slate-900 to-emerald-950 rounded-3xl p-5 text-white shadow-lg border border-slate-800">
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Paso 6.1 y 6.2 Activos</span>
          </div>
          <h2 className="text-lg font-extrabold mt-1">Vista Espejo por Organización</h2>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Selecciona cualquier organización debajo para inspeccionar su Vista Móvil del Líder en tiempo real, o utiliza el selector flotante inferior para cambiar a un perfil de Líder.
          </p>
          {user.is_permanent_admin && (
            <div className="mt-3 p-2.5 rounded-xl bg-slate-800/80 border border-amber-500/30 flex items-center gap-2 text-[11px] text-amber-200">
              <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>
                Regla Sagrada #1 verificada: Tu cuenta ({user.calling}) posee protección de Administrador Permanente no revocable.
              </span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-emerald-700" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
              Inspeccionar Organización (Modo Espejo)
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {STAKE_ORGS.map((org) => (
              <button
                key={org}
                type="button"
                data-testid={`inspect-org-${org}`}
                onClick={() => setInspectedOrg(org)}
                className="pressable p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 text-left flex items-center justify-between group transition"
              >
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-slate-900 truncate">
                    {ORGANIZATION_SHORT_LABELS[org]}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                    {ORGANIZATION_LABELS[org]}
                  </p>
                </div>
                <Eye className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
      <DevRoleSwitcher />
    </AuthProvider>
  );
}
