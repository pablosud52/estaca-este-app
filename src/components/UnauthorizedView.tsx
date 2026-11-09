import React from 'react';
import { ShieldAlert, PhoneCall, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const UnauthorizedView: React.FC = () => {
  const { user, switchProfileById } = useAuth();

  return (
    <div
      data-testid="unauthorized-view"
      className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center px-5 py-10 text-center"
    >
      <div className="w-full max-w-md bg-white rounded-3xl p-7 shadow-lg border border-slate-200/90">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-5 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 mb-3">
          Estaca Montevideo Uruguay Este
        </span>

        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Cuenta sin Permisos Activos
        </h1>

        {/* Mensaje Oficial Exacto requerido en PROJECT_CONTEXT.md */}
        <p
          data-testid="unauthorized-official-message"
          className="mt-3 text-sm font-medium text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/80"
        >
          Acceso restringido. Ponte en contacto con el administrador o un miembro de la presidencia de Estaca.
        </p>

        <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span>Sesión detectada: <strong className="text-slate-700">{user.email}</strong></span>
          </div>
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Habilitación directa vía WhatsApp o Secretaría Financiera</span>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => switchProfileById('lider-mj-01')}
            className="pressable w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-sm hover:bg-slate-800"
          >
            Volver a Perfil de Prueba (Líder MJ)
          </button>
        </div>
      </div>
    </div>
  );
};
