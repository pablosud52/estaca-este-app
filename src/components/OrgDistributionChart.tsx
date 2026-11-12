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
import { BarChart3, ReceiptText, Users } from 'lucide-react';
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
  t1_spent: number;
  t2_spent: number;
  t3_spent: number;
  t4_spent: number;
  spent: number;
  available: number;
  usagePercent: number;
  shareOfPoolPercent: number;
}

interface OrgDistributionChartProps {
  orgStats: OrgSummaryStat[];
}

export type PeriodFilter = 'GLOBAL' | QuarterCode;
export type MetricMode = 'INGRESOS' | 'GASTOS';
export type YouthGrouping = 'UNIFICADOS' | 'DESGLOSADOS';

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
  const [metricMode, setMetricMode] = useState<MetricMode>('INGRESOS');
  const [youthGrouping, setYouthGrouping] = useState<YouthGrouping>('UNIFICADOS');
  const [chartMode, setChartMode] = useState<'MONTOS' | 'PORCENTAJES'>('PORCENTAJES');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('GLOBAL');

  // Cálculo dinámico de métricas según [Ingresos | Gastos], [Global | T1-T4] y [Unificados | Desglosados]
  const periodStats = useMemo(() => {
    const getValueForPeriod = (item: OrgSummaryStat): number => {
      if (metricMode === 'INGRESOS') {
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
      } else {
        switch (periodFilter) {
          case 'T1':
            return item.t1_spent ?? 0;
          case 'T2':
            return item.t2_spent ?? 0;
          case 'T3':
            return item.t3_spent ?? 0;
          case 'T4':
            return item.t4_spent ?? 0;
          default:
            return item.spent;
        }
      }
    };

    // Obtenemos los valores individuales de cada organización
    const individualStats = orgStats.map((item) => ({
      ...item,
      amount: getValueForPeriod(item),
      isYouth: YOUTH_ORGS.includes(item.organization),
    }));

    const youthItems = individualStats.filter((i) => i.isYouth);
    const nonYouthItems = individualStats.filter((i) => !i.isYouth);

    const youthTotalAmount = youthItems.reduce((acc, i) => acc + i.amount, 0);

    interface DisplayItem {
      key: string;
      label: string;
      amount: number;
      isYouth: boolean;
      organization?: OrganizationCode;
      percent?: number;
    }

    let rawItems: DisplayItem[] = [];

    if (youthGrouping === 'UNIFICADOS') {
      // Barra unificada para Jóvenes (HJ + MJ + Seminario)
      rawItems = [
        {
          key: 'JOVENES',
          label: 'Jóvenes',
          amount: youthTotalAmount,
          isYouth: true,
        },
        ...nonYouthItems.map((item) => ({
          key: item.organization,
          label: CHART_AXIS_LABELS[item.organization],
          amount: item.amount,
          isYouth: false,
          organization: item.organization,
        })),
      ];
    } else {
      // Barras individuales de las 9 organizaciones
      rawItems = individualStats.map((item) => ({
        key: item.organization,
        label: CHART_AXIS_LABELS[item.organization],
        amount: item.amount,
        isYouth: item.isYouth,
        organization: item.organization,
      }));
    }

    const totalPeriodAmount = rawItems.reduce((acc, i) => acc + i.amount, 0);

    const items = rawItems.map((item) => {
      const percent =
        totalPeriodAmount > 0
          ? Number(((item.amount / totalPeriodAmount) * 100).toFixed(1))
          : 0;
      return {
        ...item,
        percent,
      };
    });

    const youthTotalPercent =
      totalPeriodAmount > 0
        ? Number(((youthTotalAmount / totalPeriodAmount) * 100).toFixed(1))
        : 0;

    return {
      items,
      totalPeriodAmount,
      youthTotalAmount,
      youthTotalPercent,
    };
  }, [orgStats, metricMode, periodFilter, youthGrouping]);

  const labels = useMemo(
    () => periodStats.items.map((o) => o.label),
    [periodStats.items]
  );

  const chartData = useMemo(() => {
    const isPercent = chartMode === 'PORCENTAJES';
    const isIncome = metricMode === 'INGRESOS';

    return {
      labels,
      datasets: [
        {
          label: isIncome
            ? isPercent
              ? 'Asignación (%)'
              : 'Asignación ($)'
            : isPercent
            ? 'Gastos (%)'
            : 'Gastos ($)',
          data: periodStats.items.map((o) =>
            isPercent ? o.percent : o.amount
          ),
          backgroundColor: periodStats.items.map((o) =>
            o.isYouth
              ? 'rgba(245, 158, 11, 0.90)' // ámbar cálido característico para Jóvenes
              : isIncome
              ? 'rgba(15, 118, 110, 0.85)' // teal-700 para ingresos
              : 'rgba(225, 29, 72, 0.82)' // rose-600 para gastos
          ),
          hoverBackgroundColor: periodStats.items.map((o) =>
            o.isYouth
              ? 'rgba(217, 119, 6, 1)'
              : isIncome
              ? 'rgba(17, 94, 89, 1)'
              : 'rgba(190, 18, 60, 1)'
          ),
          borderRadius: 8,
          borderSkipped: false as const,
          maxBarThickness: youthGrouping === 'UNIFICADOS' ? 44 : 36,
        },
      ],
    };
  }, [chartMode, metricMode, youthGrouping, periodStats.items, labels]);

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
              ? formatPercentEs(item.percent)
              : formatCurrency(item.amount);

          ctx.fillStyle = item.isYouth
            ? '#b45309'
            : metricMode === 'INGRESOS'
            ? '#0f172a'
            : '#881337';

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
    [chartMode, metricMode, periodStats.items]
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
              if (!stat) return '';
              if (stat.key === 'JOVENES') {
                return 'Jóvenes (HJ + MJ + Seminario)';
              }
              return stat.organization
                ? ORGANIZATION_LABELS[stat.organization]
                : stat.label;
            },
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const stat = periodStats.items[idx];
              if (!stat) return '';
              const actionLabel = metricMode === 'INGRESOS' ? 'Asignado' : 'Gastado';
              return ` ${actionLabel}: ${formatCurrency(stat.amount)} (${formatPercentEs(
                stat.percent
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
  }, [chartMode, metricMode, periodStats.items]);

  return (
    <section
      aria-label="Distribución presupuestaria por organización"
      data-testid="org-distribution-chart-card"
      className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90"
    >
      {/* Cabecera limpia y controles */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${
              metricMode === 'INGRESOS'
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-800'
                : 'bg-rose-50 border border-rose-100 text-rose-800'
            }`}
          >
            {metricMode === 'INGRESOS' ? (
              <BarChart3 className="w-5 h-5" />
            ) : (
              <ReceiptText className="w-5 h-5" />
            )}
          </div>
          <h2 className="text-base font-extrabold text-slate-900 leading-tight">
            {metricMode === 'INGRESOS'
              ? 'Asignación de fondos por organización'
              : 'Distribución de gastos por organización'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Selector Métrica: [ Ingresos ] [ Gastos ] */}
          <div
            role="group"
            aria-label="Métrica a graficar"
            className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80"
          >
            <button
              type="button"
              data-testid="chart-metric-ingresos"
              onClick={() => setMetricMode('INGRESOS')}
              className={`pressable px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                metricMode === 'INGRESOS'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ingresos
            </button>
            <button
              type="button"
              data-testid="chart-metric-gastos"
              onClick={() => setMetricMode('GASTOS')}
              className={`pressable px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                metricMode === 'GASTOS'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Gastos
            </button>
          </div>

          {/* 2. Selector Jóvenes: [ Juntos ] [ Separados ] */}
          <div
            role="group"
            aria-label="Agrupación de jóvenes"
            className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80"
          >
            <button
              type="button"
              data-testid="chart-youth-unified"
              onClick={() => setYouthGrouping('UNIFICADOS')}
              title="Ver jóvenes unificados en una sola barra (HJ + MJ + Seminario)"
              className={`pressable inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                youthGrouping === 'UNIFICADOS'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Jóvenes juntos</span>
            </button>
            <button
              type="button"
              data-testid="chart-youth-split"
              onClick={() => setYouthGrouping('DESGLOSADOS')}
              title="Separar jóvenes en Hombres Jóvenes, Mujeres Jóvenes y Seminario"
              className={`pressable px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                youthGrouping === 'DESGLOSADOS'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Separados
            </button>
          </div>

          {/* 3. Píldoras de período: [ Global ] [ T1 ] [ T2 ] [ T3 ] [ T4 ] */}
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
                className={`pressable px-2 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  periodFilter === period
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {period === 'GLOBAL' ? 'Global' : period}
              </button>
            ))}
          </div>

          {/* 4. Toggle Montos ($) vs Porcentajes (%) */}
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
          key={`${chartMode}-${periodFilter}-${metricMode}-${youthGrouping}`}
          data={chartData}
          options={options}
          plugins={[barValueLabelsPlugin]}
        />
      </div>

      {/* Leyenda limpia y elegante al pie (reemplaza a la reseña pesada) */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-500">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>
              {youthGrouping === 'UNIFICADOS'
                ? 'Jóvenes (HJ + MJ + Seminario)'
                : 'Nuevas Generaciones'}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full inline-block ${
                metricMode === 'INGRESOS' ? 'bg-teal-700' : 'bg-rose-600'
              }`}
            />
            <span>Resto de Organizaciones</span>
          </span>
        </div>

        <span className="text-slate-400 text-[10px] tabular-nums">
          {metricMode === 'INGRESOS' ? 'Base: Fondos presupuestados' : 'Base: Gastos devengados'} ({periodFilter === 'GLOBAL' ? 'Anual' : periodFilter})
        </span>
      </div>
    </section>
  );
};
