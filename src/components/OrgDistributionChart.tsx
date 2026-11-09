import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { BarChart3, Percent, DollarSign } from 'lucide-react';
import { formatCurrency, ORGANIZATION_SHORT_LABELS } from '../lib/formatters';
import { OrganizationCode } from '../types/database';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export interface OrgSummaryStat {
  organization: OrganizationCode;
  assigned: number;
  spent: number;
  available: number;
  usagePercent: number;
  shareOfPoolPercent: number;
}

interface OrgDistributionChartProps {
  orgStats: OrgSummaryStat[];
}

export const OrgDistributionChart: React.FC<OrgDistributionChartProps> = ({ orgStats }) => {
  const [chartMode, setChartMode] = useState<'MONTOS' | 'PORCENTAJES'>('MONTOS');

  // Filtrar las 8 organizaciones operativas + Seminario para que la comparación visual sea limpia
  const chartOrgs = useMemo(
    () => orgStats.filter((o) => o.organization !== 'ESTACA'),
    [orgStats]
  );

  const labels = useMemo(
    () => chartOrgs.map((o) => ORGANIZATION_SHORT_LABELS[o.organization]),
    [chartOrgs]
  );

  const chartData = useMemo(() => {
    const isPercent = chartMode === 'PORCENTAJES';
    return {
      labels,
      datasets: [
        {
          label: isPercent ? '% Asignado del Pool' : 'Presupuesto Asignado ($)',
          data: chartOrgs.map((o) => (isPercent ? o.shareOfPoolPercent : o.assigned)),
          backgroundColor: 'rgba(16, 185, 129, 0.85)', // emerald-500
          hoverBackgroundColor: 'rgba(5, 150, 105, 1)',
          borderRadius: 8,
          borderSkipped: false as const,
          maxBarThickness: 32,
        },
        {
          label: isPercent ? '% Consumido de su Cuota' : 'Gasto Ejecutado ($)',
          data: chartOrgs.map((o) => (isPercent ? o.usagePercent : o.spent)),
          backgroundColor: chartOrgs.map((o) =>
            o.usagePercent > 90
              ? 'rgba(244, 63, 94, 0.88)' // rose-500
              : o.usagePercent > 75
              ? 'rgba(245, 158, 11, 0.88)' // amber-500
              : 'rgba(15, 23, 42, 0.82)' // slate-900
          ),
          borderRadius: 8,
          borderSkipped: false as const,
          maxBarThickness: 32,
        },
      ],
    };
  }, [chartMode, chartOrgs, labels]);

  const options: ChartOptions<'bar'> = useMemo(() => {
    const isPercent = chartMode === 'PORCENTAJES';
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 240,
        easing: 'easeOutQuart',
      },
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            useBorderRadius: true,
            borderRadius: 4,
            padding: 16,
            font: {
              family: '"Plus Jakarta Sans", sans-serif',
              size: 11,
              weight: 600,
            },
            color: '#475569',
          },
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: {
            family: '"Plus Jakarta Sans", sans-serif',
            size: 12,
            weight: 'bold',
          },
          bodyFont: {
            family: '"JetBrains Mono", monospace',
            size: 11,
          },
          padding: 10,
          cornerRadius: 10,
          callbacks: {
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const stat = chartOrgs[idx];
              if (!stat) return '';
              if (isPercent) {
                if (ctx.datasetIndex === 0) {
                  return ` Asignado: ${stat.shareOfPoolPercent.toFixed(1)}% (${formatCurrency(stat.assigned)})`;
                }
                return ` Consumido: ${stat.usagePercent}% (${formatCurrency(stat.spent)})`;
              }
              const raw = Number(ctx.raw) || 0;
              return ` ${ctx.dataset.label?.replace(' ($)', '')}: ${formatCurrency(raw)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              family: '"Plus Jakarta Sans", sans-serif',
              size: 11,
              weight: 700,
            },
            color: '#334155',
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(226, 232, 240, 0.7)',
          },
          ticks: {
            font: {
              family: '"JetBrains Mono", monospace',
              size: 10,
            },
            color: '#64748b',
            callback: (val) => {
              const num = Number(val);
              if (isPercent) return `${num}%`;
              if (num >= 1000) return `$ ${(num / 1000).toFixed(0)}k`;
              return formatCurrency(num);
            },
          },
        },
      },
    };
  }, [chartMode, chartOrgs]);

  return (
    <section
      aria-label="Distribución Presupuestaria por Organización"
      data-testid="org-distribution-chart-card"
      className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
              Distribución y Ejecución por Organización
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparativa de las 8 organizaciones + Seminario (Año Fiscal 2026)
            </p>
          </div>
        </div>

        {/* Toggle Montos vs Porcentajes */}
        <div
          role="group"
          aria-label="Modo de visualización del gráfico"
          className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start sm:self-auto"
        >
          <button
            type="button"
            data-testid="chart-mode-montos"
            onClick={() => setChartMode('MONTOS')}
            className={`pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              chartMode === 'MONTOS'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
            <span>Montos ($)</span>
          </button>

          <button
            type="button"
            data-testid="chart-mode-porcentajes"
            onClick={() => setChartMode('PORCENTAJES')}
            className={`pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              chartMode === 'PORCENTAJES'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Percent className="w-3.5 h-3.5 text-emerald-700" />
            <span>Porcentajes (%)</span>
          </button>
        </div>
      </div>

      {/* Contenedor del Canvas Chart.js */}
      <div
        data-testid={`chart-canvas-container-${chartMode}`}
        className="h-64 sm:h-72 w-full relative"
      >
        <Bar data={chartData} options={options} />
      </div>
    </section>
  );
};
