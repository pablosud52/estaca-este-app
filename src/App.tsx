import React from 'react';
import { Calendar, Wallet, ShieldCheck, ChevronRight, Sparkles } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col justify-between">
      {/* Header */}
      <header className="bg-emerald-900 text-white shadow-md">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-lg shadow-inner">
              EE
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Estaca Este App</h1>
              <p className="text-xs text-emerald-200">Finanzas y Calendario</p>
            </div>
          </div>
          <span className="text-xs bg-emerald-800 text-emerald-200 px-2 py-1 rounded-full border border-emerald-700">
            PWA
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto px-4 py-8 flex-1 w-full flex flex-col justify-center">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">¡Proyecto Inicializado!</h2>
          <p className="text-sm text-slate-600 mb-6">
            Ecosistema preparado con React, Vite, Tailwind CSS y políticas RBAC para la Estaca Montevideo Este.
          </p>

          <div className="space-y-3 text-left">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center space-x-3">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium text-slate-700">Módulo Financiero</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-teal-600" />
                <span className="text-sm font-medium text-slate-700">Agenda y LCR</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center space-x-3">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-medium text-slate-700">Control de Acceso RBAC</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-slate-400">
        Estaca Montevideo Uruguay Este • 2026
      </footer>
    </div>
  );
}
