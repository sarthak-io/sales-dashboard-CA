import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { computeConnectToConversationRate, type DerivedEvent } from '../data/transforms';
import { useStore } from '../store';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const COLOR_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#db2777',
  '#9333ea',
  '#0ea5e9',
  '#d946ef',
  '#ca8a04',
];

const withAlpha = (hex: string, alpha: number) => {
  const sanitized = hex.replace('#', '');
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const formatWeekLabel = (isoWeekStart: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(isoWeekStart));

type WeekMap = Map<string, DerivedEvent[]>;

interface SdrSeries {
  id: string;
  name: string;
  weeks: (number | null)[];
  totalConnects: number;
}

const buildSdrSeries = (
  events: DerivedEvent[],
  weeks: string[],
  sdrNameFallback: (sdrId: string) => string,
) => {
  const eventsBySdr = new Map<string, WeekMap>();

  events.forEach((event) => {
    const sdrMap = eventsBySdr.get(event.sdr_id) ?? new Map<string, DerivedEvent[]>();
    const weekEvents = sdrMap.get(event.week_start) ?? [];
    weekEvents.push(event);
    sdrMap.set(event.week_start, weekEvents);
    eventsBySdr.set(event.sdr_id, sdrMap);
  });

  const series: SdrSeries[] = [];

  eventsBySdr.forEach((weekMap, sdrId) => {
    const sdrWeeks = weeks.map((week) => {
      const weekEvents = weekMap.get(week) ?? [];
      const rateSummary = computeConnectToConversationRate(weekEvents);
      return rateSummary.rate;
    });

    let totalConnects = 0;
    weekMap.forEach((weekEvents) => {
      totalConnects += weekEvents.filter((event) => event.is_connected).length;
    });

    series.push({
      id: sdrId,
      name: sdrNameFallback(sdrId),
      weeks: sdrWeeks,
      totalConnects,
    });
  });

  series.sort((a, b) => {
    if (b.totalConnects !== a.totalConnects) {
      return b.totalConnects - a.totalConnects;
    }
    return a.name.localeCompare(b.name);
  });

  return series;
};

const C2CTrends = () => {
  const { filteredEvents, sdrDirectory } = useStore((state) => ({
    filteredEvents: state.filteredEvents,
    sdrDirectory: state.dataset.sdrs,
  }));

  const paletteIndexBySdr = useMemo(() => {
    const map = new Map<string, number>();
    sdrDirectory.forEach((sdr, index) => {
      map.set(sdr.id, index % COLOR_PALETTE.length);
    });
    return map;
  }, [sdrDirectory]);

  const { weeks, labels, series } = useMemo(() => {
    if (filteredEvents.length === 0) {
      return { weeks: [] as string[], labels: [] as string[], series: [] as SdrSeries[] };
    }

    const weekSet = Array.from(new Set(filteredEvents.map((event) => event.week_start))).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );

    const formattedLabels = weekSet.map(formatWeekLabel);

    const nameLookup = new Map(sdrDirectory.map((sdr) => [sdr.id, sdr.name] as const));
    const seriesData = buildSdrSeries(
      filteredEvents,
      weekSet,
      (sdrId) => nameLookup.get(sdrId) ?? filteredEvents.find((event) => event.sdr_id === sdrId)?.sdr_name ?? sdrId,
    );

    return { weeks: weekSet, labels: formattedLabels, series: seriesData };
  }, [filteredEvents, sdrDirectory]);

  const [selectedSdrs, setSelectedSdrs] = useState<string[]>([]);

  const activeSdrNames = useMemo(
    () =>
      selectedSdrs
        .map((id) => series.find((item) => item.id === id)?.name)
        .filter((name): name is string => Boolean(name)),
    [selectedSdrs, series],
  );

  useEffect(() => {
    if (series.length === 0) {
      setSelectedSdrs([]);
      return;
    }

    setSelectedSdrs((prev) => {
      const availableIds = series.map((item) => item.id);
      const preserved = prev.filter((id) => availableIds.includes(id));

      if (preserved.length > 0) {
        return preserved;
      }

      return availableIds.slice(0, 3);
    });
  }, [series]);

  const chartData = useMemo(() => {
    if (weeks.length === 0 || selectedSdrs.length === 0) {
      return { labels, datasets: [] };
    }

    const datasets = selectedSdrs
      .map((sdrId) => series.find((item) => item.id === sdrId))
      .filter((item): item is SdrSeries => Boolean(item))
      .map((item) => {
        const fallbackIndex = series.findIndex((seriesItem) => seriesItem.id === item.id);
        const colorIndex = paletteIndexBySdr.get(item.id) ?? fallbackIndex;
        const paletteIndex = colorIndex >= 0 ? colorIndex : 0;
        const borderColor = COLOR_PALETTE[paletteIndex % COLOR_PALETTE.length];
        return {
          label: item.name,
          data: item.weeks.map((value) => (value === null ? null : value * 100)),
          borderColor,
          backgroundColor: withAlpha(borderColor, 0.18),
          fill: false,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 4,
          pointBackgroundColor: '#fff',
          pointBorderWidth: 2,
          pointBorderColor: borderColor,
          spanGaps: true,
        };
      });

    return { labels, datasets };
  }, [labels, weeks, selectedSdrs, series, paletteIndexBySdr]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label ?? '';
              const value = context.parsed.y;
              if (value === null || Number.isNaN(value)) {
                return `${label}: No connects`;
              }
              return `${label}: ${value.toFixed(1)}%`;
            },
          },
        },
      },
      interaction: { mode: 'index' as const, intersect: false },
      scales: {
        x: {
          ticks: {
            maxRotation: 0,
            autoSkipPadding: 12,
            color: '#475569',
          },
          grid: { display: false },
        },
        y: {
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            callback: (value: string | number) => `${value}%`,
            color: '#475569',
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.2)',
            drawBorder: false,
          },
        },
      },
    }),
    [],
  );

  const handleToggle = (sdrId: string) => {
    setSelectedSdrs((prev) => {
      if (prev.includes(sdrId)) {
        return prev.filter((id) => id !== sdrId);
      }

      if (prev.length >= 3) {
        return prev;
      }

      return [...prev, sdrId];
    });
  };

  const canSelectMore = selectedSdrs.length < 3;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-800">Connect → Conversation Trends</h2>
        <p className="text-sm text-slate-500">
          Weekly conversation rate by SDR (conversations ÷ connects)
        </p>
      </div>
      <div className="flex flex-col gap-6 px-6 py-6">
        {series.length > 0 ? (
          <>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Focus up to 3 SDRs</span>
                <span className="text-xs text-slate-400">{selectedSdrs.length} selected</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {series.map((item) => {
                  const fallbackIndex = series.findIndex((seriesItem) => seriesItem.id === item.id);
                  const colorIndex = paletteIndexBySdr.get(item.id) ?? fallbackIndex;
                  const paletteIndex = colorIndex >= 0 ? colorIndex : 0;
                  const baseColor = COLOR_PALETTE[paletteIndex % COLOR_PALETTE.length];
                  const isActive = selectedSdrs.includes(item.id);
                  const disabled = !isActive && !canSelectMore;

                  const classes = [
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-500',
                    isActive
                      ? 'text-slate-900 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-100',
                  ];

                  if (disabled) {
                    classes.push('cursor-not-allowed opacity-50');
                  }

                  const buttonStyle = isActive
                    ? {
                        background: withAlpha(baseColor, 0.18),
                        borderColor: withAlpha(baseColor, 0.4),
                        boxShadow: `0 1px 2px ${withAlpha('#0f172a', 0.12)}`,
                      }
                    : undefined;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToggle(item.id)}
                      disabled={disabled}
                      className={classes.join(' ')}
                      style={buttonStyle}
                      aria-pressed={isActive}
                      title={`${isActive ? 'Remove' : 'Add'} ${item.name} from the comparison`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: baseColor }}
                        aria-hidden
                      />
                      <span className="font-medium">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="h-80">
              {selectedSdrs.length > 0 ? (
                <Line
                  data={chartData}
                  options={chartOptions}
                  aria-label={
                    activeSdrNames.length > 0
                      ? `Line chart showing connect to conversation rates over time for ${activeSdrNames.join(', ')}`
                      : 'Line chart showing connect to conversation rates over time'
                  }
                  role="img"
                />
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                  Select an SDR to visualize trends
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-slate-500">
            No events match the current filters.
          </div>
        )}
      </div>
    </section>
  );
};

export default C2CTrends;
