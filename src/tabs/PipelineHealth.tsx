import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { computeConnectToConversationRate, computeDialToConnectRate, computeMeetingToQualifiedRate, type DerivedEvent } from '../data/transforms';
import { shallowEqual, useStore } from '../store';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface RateBreakdown {
  key: 'dialToConnect' | 'connectToConversation' | 'meetingToQualified';
  label: string;
  numerator: number;
  denominator: number;
  value: number | null;
}

interface EntityPipelineHealth {
  id: string;
  label: string;
  score: number;
  components: RateBreakdown[];
}

const RATE_LABELS: Record<RateBreakdown['key'], string> = {
  dialToConnect: 'Dial→Connect',
  connectToConversation: 'Connect→Conversation',
  meetingToQualified: 'Meeting→Qualified',
};

const formatPercent = (value: number | null, fractionDigits = 0) => {
  if (value === null) {
    return '—';
  }

  return `${value.toFixed(fractionDigits)}%`;
};

const buildRateBreakdowns = (events: DerivedEvent[]): RateBreakdown[] => {
  const dialToConnect = computeDialToConnectRate(events);
  const connectToConversation = computeConnectToConversationRate(events);
  const meetingToQualified = computeMeetingToQualifiedRate(events);

  return [
    {
      key: 'dialToConnect',
      label: RATE_LABELS.dialToConnect,
      numerator: dialToConnect.numerator,
      denominator: dialToConnect.denominator,
      value: dialToConnect.rate === null ? null : dialToConnect.rate * 100,
    },
    {
      key: 'connectToConversation',
      label: RATE_LABELS.connectToConversation,
      numerator: connectToConversation.numerator,
      denominator: connectToConversation.denominator,
      value: connectToConversation.rate === null ? null : connectToConversation.rate * 100,
    },
    {
      key: 'meetingToQualified',
      label: RATE_LABELS.meetingToQualified,
      numerator: meetingToQualified.numerator,
      denominator: meetingToQualified.denominator,
      value: meetingToQualified.rate === null ? null : meetingToQualified.rate * 100,
    },
  ];
};

const computePipelineHealthScore = (breakdowns: RateBreakdown[]) => {
  const availableValues = breakdowns
    .map((item) => item.value)
    .filter((value): value is number => value !== null);

  if (availableValues.length === 0) {
    return null;
  }

  const average =
    availableValues.reduce((sum, value) => sum + value, 0) / availableValues.length;
  return Math.round(average);
};

const createEntityPipelineHealth = (
  events: DerivedEvent[],
  getId: (event: DerivedEvent) => string,
  getLabel: (id: string, sample: DerivedEvent | undefined) => string,
): EntityPipelineHealth[] => {
  const grouped = new Map<string, DerivedEvent[]>();

  events.forEach((event) => {
    const id = getId(event);
    if (!id) {
      return;
    }

    const existing = grouped.get(id);
    if (existing) {
      existing.push(event);
    } else {
      grouped.set(id, [event]);
    }
  });

  const entities: EntityPipelineHealth[] = [];

  grouped.forEach((group, id) => {
    const breakdowns = buildRateBreakdowns(group);
    const score = computePipelineHealthScore(breakdowns);

    if (score === null) {
      return;
    }

    entities.push({
      id,
      label: getLabel(id, group[0]),
      score,
      components: breakdowns,
    });
  });

  return entities.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
};

const createBarChartConfig = (entities: EntityPipelineHealth[]) => {
  const labels = entities.map((entity) => entity.label);
  const data = entities.map((entity) => entity.score);

  return {
    data: {
      labels,
      datasets: [
        {
          label: 'Pipeline Health Score',
          data,
          backgroundColor: 'rgba(37, 99, 235, 0.8)',
          borderRadius: 6,
          maxBarThickness: 48,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y' as const,
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: (value: number | string) => `${value}`,
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.2)',
          },
        },
        y: {
          ticks: {
            color: '#1f2937',
            font: {
              size: 12,
            },
          },
          grid: {
            display: false,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const entity = entities[context.dataIndex];
              const parts = [`Score: ${entity.score}/100`];
              entity.components.forEach((component) => {
                if (component.value !== null) {
                  parts.push(`${component.label}: ${component.value.toFixed(0)}%`);
                }
              });
              return parts.join(' | ');
            },
          },
        },
      },
    },
  };
};

const PipelineHealth = () => {
  const { filteredEvents, sdrDirectory } = useStore(
    (state) => ({
      filteredEvents: state.filteredEvents,
      sdrDirectory: state.dataset.sdrs,
    }),
    shallowEqual,
  );

  const {
    overallScore,
    overallBreakdowns,
    teamEntities,
    teamChart,
    sdrEntities,
    sdrChart,
  } = useMemo(() => {
    if (filteredEvents.length === 0) {
      return {
        overallScore: null,
        overallBreakdowns: [] as RateBreakdown[],
        teamEntities: [] as EntityPipelineHealth[],
        teamChart: null as ReturnType<typeof createBarChartConfig> | null,
        sdrEntities: [] as EntityPipelineHealth[],
        sdrChart: null as ReturnType<typeof createBarChartConfig> | null,
      };
    }

    const breakdowns = buildRateBreakdowns(filteredEvents);
    const overallScore = computePipelineHealthScore(breakdowns);

    const teamEntities = createEntityPipelineHealth(
      filteredEvents,
      (event) => event.team || '—',
      (id) => id || '—',
    ).slice(0, 10);

    const sdrNameMap = new Map(sdrDirectory.map((entry) => [entry.id, entry.name] as const));
    const sdrEntities = createEntityPipelineHealth(
      filteredEvents,
      (event) => event.sdr_id,
      (id, sample) => sdrNameMap.get(id) ?? sample?.sdr_name ?? id,
    ).slice(0, 12);

    return {
      overallScore,
      overallBreakdowns: breakdowns,
      teamEntities,
      teamChart: teamEntities.length > 0 ? createBarChartConfig(teamEntities) : null,
      sdrEntities,
      sdrChart: sdrEntities.length > 0 ? createBarChartConfig(sdrEntities) : null,
    };
  }, [filteredEvents, sdrDirectory]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Pipeline Health Overview</h2>
            <p className="text-sm text-slate-500">
              Composite conversion score built from Dial→Connect, Connect→Conversation, and Meeting→Qualified
              performance.
            </p>
          </div>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-slate-500">
          No results for the current filters.
        </div>
      ) : (
        <div className="space-y-8 px-6 py-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-slate-900 p-6 text-white shadow-inner">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-200">Overall Pipeline Health</p>
                    <p className="mt-2 text-4xl font-semibold tracking-tight">
                      {overallScore === null ? '—' : overallScore}
                      <span className="ml-1 text-lg font-normal text-slate-200">/100</span>
                    </p>
                  </div>
                  <span
                    className="rounded-full border border-white/20 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-200"
                    title="Normalize each stage conversion to 0–100 and average them: round((Dial→Connect + Connect→Conversation + Meeting→Qualified) ÷ number of available stages)."
                  >
                    Formula
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {overallBreakdowns.map((item) => (
                  <div key={item.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">{formatPercent(item.value)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.denominator === 0
                        ? 'No data'
                        : `${item.numerator.toLocaleString()} of ${item.denominator.toLocaleString()}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Team Scores</h3>
              {teamChart ? (
                <div className="mt-4 h-[320px]">
                  <Bar
                    data={teamChart.data}
                    options={teamChart.options}
                    aria-label="Bar chart showing pipeline health scores by team"
                    role="img"
                  />
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Not enough team data to chart.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Top SDR Scores</h3>
              <p className="text-xs text-slate-400">Matches the Pipeline Health column in the Leadership tab.</p>
            </div>
            {sdrChart ? (
              <div className="mt-4 h-[420px]">
                <Bar
                  data={sdrChart.data}
                  options={sdrChart.options}
                  aria-label="Bar chart showing pipeline health scores for top-performing SDRs"
                  role="img"
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Not enough SDR data to chart.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default PipelineHealth;
