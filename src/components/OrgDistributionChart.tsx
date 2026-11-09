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
  Plugin,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { BarChart3, Sparkles } from 'lucide-react';
import { formatCurrency, ORGANIZATION_LABELS } from '../lib/formatters';
import { OrganizationCode, QuarterCode } from '../types/database';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export interface OrgSummaryStat {
  organization: OrganizationCode;
  t1_assigned: number;
  t2_assigned: number;
  t3_assigned: number;
  t4_assigned: number;
  assigned: number;
  spent: number;
  available: number;
  usagePercent: number;
  shareOfPoolPercent: number;
}

interface OrgDistributionChartProps {
  orgStats: OrgSummaryStat[];
}

type PeriodFilter = 'GLOBAL' | QuarterCode;

const YOUTH_ORGS: OrganizationCode[] = ['HJ', 'MJ', 'SEMINARIO'];

const CHART_AXIS_LABELS: Record<OrganizationCode, string> = {
  MJ: 'Mujeres Jóvenes',
  HJ: 'Hombres Jóvenes',
  SEMINARIO: 'Seminario',
  SS: 'Soc. de Socorro',
  PRIMARIA: 'Primaria',
  JAS: 'JAS',
  AS: 'Adultos Solteros',
  CFS: 'FamilySearch',
  ESTACA: 'Estaca',
  TODAS: 'Todas',
};

const formatPercentEs = (value: number): string =>
  `${value.toFixed(1).replace('.', ',')}%`;

export const OrgDistributionChart: React.FC<OrgDistributionChartProps> = ({ orgStats }) => {
  const [chartMode, setChartMode] = useState<'MONTOS' | 'PORCENTAJES'>('MONTOS');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('GLOBAL');

  // Obtener el monto asignado de cada organización según el filtro [Global | T1 | T2 | T3 | T4]
  const periodStats = useMemo(() => {
    const getAmountForPeriod = (item: OrgSummaryStat): number => {
      switch (periodFilter) {
        case 'T1':
          return item.t1_assigned;
        case 'T2':
          return item.t2_assigned;
        case 'T3':
          return item.t3_assigned;
        case 'T4':
          return item.t4_assigned;
        default:
          return item.assigned;
      }
    };

    const totalPeriodAssigned = orgStats.reduce(
      (acc, item) => acc + getAmountForPeriod(item),
      0
    );

    const items = orgStats.map((item) => {
      const periodAmount = getAmountForPeriod(item);
      const periodPercent =
        totalPeriodAssigned > 0
          ? Number(((periodAmount / totalPeriodAssigned) * 100).toFixed(1))
          : 0;
      const isYouth = YOUTH_ORGS.includes(item.organization);

      return {
        ...item,
        periodAmount,
        periodPercent,
        isYouth,
      };
    });

    const youthTotalAmount = items
      .filter((i) => i.isYouth)
      .reduce((acc, i) => acc + i.periodAmount, 0);

    const youthTotalPercent =
      totalPeriodAssigned > 0
        ? Number(((youthTotalAmount / totalPeriodAssigned) * 100).toFixed(1))
        : 0;

    return {
      items,
      totalPeriodAssigned,
      youthTotalAmount,
      youthTotalPercent,
    };
  }, [orgStats, periodFilter]);

  const labels = useMemo(
    () => periodStats.items.map((o) => CHART_AXIS_LABELS[o.organization]),
    [periodStats.items]
  );

  const chartData = useMemo(() => {
    const isPercent = chartMode === 'PORCENTAJES';
    return {
      labels,
      datasets: [
        {
          label: isPercent ? 'Asignación (%)' : 'Asignación ($)',
          data: periodStats.items.map((o) =>
            isPercent ? o.periodPercent : o.periodAmount
          ),
          // Enfoque "Nuevas Generaciones": color cálido (ámbar/dorado) para HJ, MJ y Seminario
          backgroundColor: periodStats.items.map((o) =>
            o.isYouth
              ? 'rgba(245, 158, 11, 0.90)' // amber-500 cálido para Nuevas Generaciones
              : 'rgba(15, 118, 110, 0.85)' // teal-700 sobrio para el resto
          ),
          hoverBackgroundColor: periodStats.items.map((o) =>
            o.isYouth ? 'rgba(217, 119, 6, 1)' : 'rgba(17, 94, 89, 1)'
          ),
          borderRadius: 8,
          borderSkipped: false as const,
          maxBarThickness: 38,
        },
      ],
    };
  }, [chartMode, periodStats.items, labels]);

  // Plugin para imprimir los valores directamente en la punta de cada barra
  const barValueLabelsPlugin: Plugin<'bar'> = useMemo(
    () => ({
      id: 'barValueLabels',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data) return;

        const isCompactCanvas = chart.width < 620 && chartMode === 'MONTOS';

        ctx.save();
        ctx.font = isCompactCanvas
          ? '700 9.5px "JetBrains Mono", monospace'
          : '700 10px "JetBrains Mono", monospace';

        meta.data.forEach((barElement, index) => {
          const item = periodStats.items[index];
          if (!item) return;

          const labelText =
            chartMode === 'PORCENTAJES'
              ? formatPercentEs(item.periodPercent)
              : formatCurrency(item.periodAmount);

          ctx.fillStyle = item.isYouth ? '#b45309' : '#0f172a';

          if (isCompactCanvas) {
            ctx.save();
            ctx.translate(barElement.x, barElement.y - 6);
            ctx.rotate(-Math.PI / 4);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, 0, 0);
            ctx.restore();
          } else {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(labelText, barElement.x, barElement.y - 6);
          }
        });

        ctx.restore();
      },
    }),
    [chartMode, periodStats.items]
  );

  const options: ChartOptions<'bar'> = useMemo(() => {
    const isPercent = chartMode === 'PORCENTAJES';
    return {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: isPercent ? 28 : 48,
          right: 18,
          bottom: 4,
        },
      },
      animation: {
        duration: 240,
        easing: 'easeOutQuart',
      },
      plugins: {
        legend: {
          display: false,
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
            title: (items) => {
              const idx = items[0]?.dataIndex ?? 0;
              const stat = periodStats.items[idx];
              return stat ? ORGANIZATION_LABELS[stat.organization] : '';
            },
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const stat = periodStats.items[idx];
              if (!stat) return '';
              return ` Asignado: ${formatCurrency(stat.periodAmount)} (${formatPercentEs(
                stat.periodPercent
              )})`;
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
            minRotation: 45,
            maxRotation: 45,
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
              return formatCurrency(num);
            },
          },
        },
      },
    };
  }, [chartMode, periodStats.items]);

  return (
    <section
      aria-label="Asignación de fondos a cada organización"
      data-testid="org-distribution-chart-card"
      className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90"
    >
      {/* Cabecera limpia y controles */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h2 className="text-base font-extrabold text-slate-900 leading-tight">
            Asignación de fondos a cada organización
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Píldoras de período: [ Global ] [ T1 ] [ T2 ] [ T3 ] [ T4 ] */}
          <div
            role="group"
            aria-label="Filtro por período"
            className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80"
          >
            {(['GLOBAL', 'T1', 'T2', 'T3', 'T4'] as const).map((period) => (
              <button
                key={period}
                type="button"
                data-testid={`chart-period-${period}`}
                onClick={() => setPeriodFilter(period)}
                className={`pressable px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  periodFilter === period
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {period === 'GLOBAL' ? 'Global' : period}
              </button>
            ))}
          </div>

          {/* Toggle Montos ($) vs Porcentajes (%) */}
          <div
            role="group"
            aria-label="Modo de visualización del gráfico"
            className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80"
          >
            <button
              type="button"
              data-testid="chart-mode-montos"
              onClick={() => setChartMode('MONTOS')}
              className={`pressable inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                chartMode === 'MONTOS'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Mostrar en Montos ($)"
            >
              <span>$</span>
            </button>

            <button
              type="button"
              data-testid="chart-mode-porcentajes"
              onClick={() => setChartMode('PORCENTAJES')}
              className={`pressable inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                chartMode === 'PORCENTAJES'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Mostrar en Porcentajes (%)"
            >
              <span>%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenedor del Canvas Chart.js */}
      <div
        data-testid={`chart-canvas-container-${chartMode}`}
        className="h-72 sm:h-80 w-full relative"
      >
        <Bar
          key={`${chartMode}-${periodFilter}`}
          data={chartData}
          options={options}
          plugins={[barValueLabelsPlugin]}
        />
      </div>

      {/* Pastilla "Nuevas Generaciones" al pie de la gráfica */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div
          data-testid="youth-focus-pill"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-950 text-xs sm:text-sm font-extrabold self-start"
        >
          <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            Total Destinado a Jóvenes (HJ + MJ + Seminario):{' '}
            <strong data-testid="youth-focus-amount" className="tabular-nums text-amber-900">
              {formatCurrency(periodStats.youthTotalAmount)} (
              {formatPercentEs(periodStats.youthTotalPercent)})
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
            <span>Nuevas Generaciones (HJ, MJ, Seminario)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-teal-700 inline-block" />
            <span>Resto de Organizaciones</span>
          </span>
        </div>
      </div>
    </section>
  );
};
