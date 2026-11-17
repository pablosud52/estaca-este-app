import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  FileText,
  Scale,
  ShieldAlert,
} from 'lucide-react';

export const FinancialInfoSection: React.FC = () => {
  const [openSection, setOpenSection] = useState<'CLOSING_50' | null>('CLOSING_50');

  return (
    <div data-testid="financial-info-section" className="space-y-5 animate-fade-in">
      {/* Cabecera */}
      <div className="bg-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-md border border-slate-800">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
              Información y Normativas Financieras
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              Guías oficiales de consulta rápida para la Presidencia de Estaca y Administración Financiera.
            </p>
          </div>
        </div>
      </div>

      {/* Guía 1: Cierre de Fin de Año y Regla del 50% (Publicada) */}
      <article className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenSection((prev) => (prev === 'CLOSING_50' ? null : 'CLOSING_50'))}
          className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 transition"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center flex-shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Cierre de Fin de Año y Regla del 50%
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900">
                  Vigente · Aviso Oficial Área
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Departamento de Registros y Estadísticas – Finanzas de Unidades Locales (Área Sudamérica Sur)
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
              openSection === 'CLOSING_50' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSection === 'CLOSING_50' && (
          <div className="px-5 pb-6 pt-2 border-t border-slate-100 space-y-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
            {/* 1. Regla del 50% */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-3">
              <div className="flex items-center gap-2 text-amber-950 font-extrabold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Cómo funciona la quita al cierre del año (Tope del 50%)</span>
              </div>
              <ul className="space-y-1.5 text-xs text-amber-950/90 list-disc pl-5">
                <li>
                  Se suman únicamente las <strong>4 asignaciones trimestrales recibidas en el año</strong>{' '}
                  (<span className="font-semibold">T1 + T2 + T3 + T4</span>),{' '}
                  <strong>sin contar</strong> el saldo inicial que venía del año anterior.
                </li>
                <li>
                  Se calcula el <strong>50% de esa suma anual</strong>: ese monto es el{' '}
                  <strong>tope máximo permitido</strong> al cierre del <strong>31 de diciembre</strong>.
                </li>
                <li>
                  <strong>Si el saldo al 31/12 es menor o igual a ese 50%</strong>: no hay descuento y pasa completo al año siguiente.
                </li>
                <li>
                  <strong>Si el saldo al 31/12 supera ese 50%</strong>: se descuenta el excedente y el nuevo año inicia con el tope del 50%.
                </li>
              </ul>

              {/* Tabla de ejemplo oficial */}
              <div className="overflow-x-auto pt-1">
                <table className="w-full text-left border-collapse bg-white rounded-xl overflow-hidden border border-amber-200 text-xs">
                  <thead>
                    <tr className="bg-amber-100/80 text-amber-950 font-extrabold text-[11px]">
                      <th className="py-2 px-3">Caso</th>
                      <th className="py-2 px-3 text-right">4 Ingresos Anuales</th>
                      <th className="py-2 px-3 text-right">Tope 50%</th>
                      <th className="py-2 px-3 text-right">Saldo al 31/12</th>
                      <th className="py-2 px-3 text-right">Quita al cierre</th>
                      <th className="py-2 px-3 text-right">Saldo inicial próximo año</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 tabular-nums">
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-900">Ejemplo 1 (Excede)</td>
                      <td className="py-2 px-3 text-right">$ 1.000,00</td>
                      <td className="py-2 px-3 text-right font-semibold">$ 500,00</td>
                      <td className="py-2 px-3 text-right font-bold text-rose-700">$ 600,00</td>
                      <td className="py-2 px-3 text-right font-extrabold text-rose-700">- $ 100,00</td>
                      <td className="py-2 px-3 text-right font-extrabold text-slate-900">$ 500,00</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-900">Ejemplo 2 (Dentro del tope)</td>
                      <td className="py-2 px-3 text-right">$ 1.000,00</td>
                      <td className="py-2 px-3 text-right font-semibold">$ 500,00</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">$ 400,00</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">Ninguno</td>
                      <td className="py-2 px-3 text-right font-extrabold text-slate-900">$ 400,00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Fechas y Gastos + Tarjeta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                <div className="flex items-center gap-2 font-extrabold text-slate-900 text-xs sm:text-sm">
                  <CalendarClock className="w-4 h-4 text-sky-600 flex-shrink-0" />
                  <span>Cierre administrativo y fechas límite</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                  <li>
                    El cierre administrativo del año es el <strong>31 de diciembre</strong>.
                  </li>
                  <li>
                    Todo gasto que no se registre y transmita antes del 31/12 se contabiliza en el año siguiente, incluso si la fecha del comprobante es anterior.
                  </li>
                  <li>
                    <strong>Del 1 al 5 de enero inclusive</strong> no se pueden registrar gastos en el sistema oficial de finanzas (LCR).
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                <div className="flex items-center gap-2 font-extrabold text-slate-900 text-xs sm:text-sm">
                  <CreditCard className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                  <span>Tarjeta en $ 0,00 en diciembre (y mensual)</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                  <li>
                    Al menos una vez en diciembre, tanto <strong>&ldquo;Saldo Final&rdquo;</strong> como{' '}
                    <strong>&ldquo;Para Ser Aprobado&rdquo;</strong> deben quedar en <strong>$ 0,00</strong>.
                  </li>
                  <li>
                    Dejar de usar la tarjeta unos días, esperar los movimientos bancarios, registrar todos los gastos y esperar <strong>2 días</strong> tras ver todo en cero antes de volver a usarla.
                  </li>
                  <li>
                    Si en enero se detecta saldo distinto de cero, la tarjeta puede quedar <strong>inhabilitada temporalmente</strong>. Se recomienda llevarla a cero al menos una vez al mes.
                  </li>
                </ul>
              </div>
            </div>

            {/* 3. Uso permitido */}
            <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/80 flex items-start gap-2.5 text-xs text-rose-950">
              <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold">Recordatorio sobre compras no aprobadas:</span> el presupuesto no debe utilizarse para adquirir elementos no aprobados por la Iglesia (por ejemplo: heladeras, televisores, proyectores u otros dispositivos tecnológicos).
              </div>
            </div>
          </div>
        )}
      </article>

      {/* Guías pendientes en preparación */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
          Próximas guías en preparación
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              title: 'Cierre de tarjeta, reseteo y límite mensual',
              desc: 'Detalle operativo mensual de la planilla Excel para evitar bloqueos y controlar el tope de tarjeta.',
              icon: CreditCard,
            },
            {
              title: 'Ampliaciones y excepciones entre unidades',
              desc: 'Procedimiento oficial para solicitar refuerzos de fondos o excepciones presupuestarias.',
              icon: FileText,
            },
            {
              title: 'Uso apropiado de los fondos',
              desc: 'Criterios y ejemplos prácticos sobre gastos permitidos y buenas prácticas de administración.',
              icon: CheckCircle2,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-white/80 rounded-2xl p-4 border border-dashed border-slate-300 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                      <Clock className="w-3 h-3" />
                      Pendiente
                    </span>
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-800">{item.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
