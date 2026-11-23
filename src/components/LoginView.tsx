import React, { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
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
        <img
          src="/favicon.svg"
          alt="Estaca Este"
          className="w-16 h-16 rounded-2xl mx-auto mb-5 shadow-md"
        />

        <div className="text-center">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-wider bg-[#083563] text-white shadow-sm mb-3">
            Estaca Montevideo Uruguay Este
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Sistema para Líderes de la Estaca
          </h1>
        </div>

        <div className="mt-6 space-y-4">
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
            className="pressable w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-gradient-to-r from-[#083563] via-[#072B52] to-[#051E3B] text-white text-sm font-bold shadow-sm hover:brightness-110 disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            <span>{isLoading ? 'Conectando con Google...' : 'Ingresar con Google'}</span>
          </button>

          <label className="flex items-center justify-center gap-2.5 py-2 cursor-pointer select-none">
            <input
              type="checkbox"
              data-testid="login-remember-checkbox"
              checked={rememberMe}
              onChange={(e) => handleRememberChange(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#083563] focus:ring-[#083563] accent-[#083563]"
            />
            <span className="text-xs font-bold text-slate-700">
              Recordarme en este dispositivo
            </span>
          </label>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-[#083563] flex-shrink-0" />
          <span>Acceso exclusivo para líderes habilitados</span>
        </div>
      </div>
    </div>
  );
};
