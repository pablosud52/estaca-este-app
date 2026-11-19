import React, { useState } from 'react';
import { Lock, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getRememberMePreference,
  setRememberMePreference,
} from '../lib/supabase';

export const LoginView: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [rememberMe, setRememberMe] = useState<boolean>(getRememberMePreference);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRememberChange = (checked: boolean) => {
    setRememberMe(checked);
    setRememberMePreference(checked);
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      setErrorMsg('No se pudo iniciar la conexión con Google. Intenta nuevamente.');
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="login-view"
      className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center px-5 py-10"
    >
      <div className="w-full max-w-md bg-white rounded-3xl p-7 sm:p-8 shadow-lg border border-slate-200/90">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center mx-auto mb-5 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>

        <div className="text-center">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 mb-3">
            Estaca Montevideo Uruguay Este
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Sistema de Finanzas y Calendario
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Ingresá con tu cuenta de Google autorizada para acceder a tu organización.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer select-none">
            <input
              type="checkbox"
              data-testid="login-remember-checkbox"
              checked={rememberMe}
              onChange={(e) => handleRememberChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            <span className="text-left">
              <span className="block text-xs font-bold text-slate-800">
                Recordarme en este dispositivo
              </span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                Desmárcalo si estás usando una computadora compartida.
              </span>
            </span>
          </label>

          {errorMsg && (
            <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-center">
              {errorMsg}
            </p>
          )}

          <button
            type="button"
            data-testid="login-google-btn"
            disabled={isLoading}
            onClick={handleGoogleLogin}
            className="pressable w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-slate-900 text-white text-sm font-bold shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            <span>{isLoading ? 'Conectando con Google...' : 'Ingresar con Google'}</span>
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <span>Acceso exclusivo para líderes habilitados (@gmail.com)</span>
        </div>
      </div>
    </div>
  );
};
