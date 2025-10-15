import { useMemo } from 'react';
import { useStore } from '../store';
import type { DerivedEvent } from '../data/transforms';

const DAYS: { label: string; value: number }[] = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
];

const HOURS = Array.from({ length: 12 }, (_, index) => index + 8); // 08:00 - 19:00

interface GridCell {
  dials: number;
  connects: number;
  rate: number | null;
}

interface GridMap {
  [key: string]: GridCell;
}

const getWeekLabel = (isoWeekStart: string | null) => {
  if (!isoWeekStart) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(isoWeekStart));
};

const formatHour = (hour: number) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = ((hour + 11) % 12) + 1;
  return `${hour12} ${period}`;
};

const toGridKey = (dayValue: number, hour: number) => `${dayValue}-${hour}`;

const buildWeekGrid = (events: DerivedEvent[], weekStart: string | null): GridMap => {
  if (!weekStart) {
    return {};
  }

  const grid: GridMap = {};

  events.forEach((event) => {
    if (event.week_start !== weekStart || !event.is_dial) {
      return;
    }

    const eventTime = new Date(event.timestamp);
    const dayValue = eventTime.getUTCDay();
    const hour = eventTime.getUTCHours();

    if (!HOURS.includes(hour)) {
      return;
    }

    const adjustedDay = dayValue === 0 ? 0 : dayValue; // keep Sunday as 0
    const key = toGridKey(adjustedDay, hour);

    if (!grid[key]) {
      grid[key] = { dials: 0, connects: 0, rate: null };
    }

    const cell = grid[key];
    cell.dials += 1;
    if (event.is_connected) {
      cell.connects += 1;
    }
    cell.rate = cell.dials === 0 ? null : cell.connects / cell.dials;
  });

  return grid;
};

const createEmptyCell = (): GridCell => ({ dials: 0, connects: 0, rate: null });

const getCellStyle = (rate: number | null) => {
  if (rate === null) {
    return {
      backgroundColor: '#e2e8f0',
      color: '#1e293b',
    };
  }

  const clamped = Math.min(Math.max(rate, 0), 1);
  const alpha = 0.15 + clamped * 0.75;
  const textColor = clamped > 0.55 ? '#f8fafc' : '#0f172a';

  return {
    backgroundColor: `rgba(37, 99, 235, ${alpha.toFixed(2)})`,
    color: textColor,
  };
};

interface HeatmapProps {
  title: string;
  grid: GridMap;
  weekLabel: string | null;
}

const Heatmap = ({ title, grid, weekLabel }: HeatmapProps) => (
  <div>
    <div className="mb-3">
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500">
        Connect rate per hour block {weekLabel ? `for week of ${weekLabel}` : '(insufficient weeks)'}
      </p>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-16 px-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Day
            </th>
            {HOURS.map((hour) => (
              <th key={hour} className="min-w-[4.5rem] px-2 text-center text-[11px] font-semibold uppercase text-slate-500">
                {formatHour(hour)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day) => (
            <tr key={day.value}>
              <th className="px-2 text-left text-xs font-semibold text-slate-600">{day.label}</th>
              {HOURS.map((hour) => {
                const key = toGridKey(day.value, hour);
                const cell = grid[key] ?? createEmptyCell();
                const style = getCellStyle(cell.rate);
                const displayRate = cell.rate === null ? '--' : `${Math.round(cell.rate * 100)}%`;
                return (
                  <td key={key} style={style} className="rounded-md px-2 py-2 text-center text-xs">
                    <div className="font-semibold">{displayRate}</div>
                    <div className="text-[10px] opacity-80">{cell.dials} dials</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

interface WindowRecommendation {
  day: { label: string; value: number };
  hour: number;
  delta: number;
  currentRate: number | null;
  previousRate: number | null;
  dials: number;
  lastWeekDials: number;
}

const buildRecommendations = (thisWeek: GridMap, lastWeek: GridMap): WindowRecommendation[] => {
  const recommendations: WindowRecommendation[] = [];

  DAYS.forEach((day) => {
    HOURS.forEach((hour) => {
      const key = toGridKey(day.value, hour);
      const current = thisWeek[key] ?? createEmptyCell();
      const previous = lastWeek[key] ?? createEmptyCell();

      const currentRate = current.rate ?? 0;
      const previousRate = previous.rate ?? 0;
      const delta = currentRate - previousRate;

      if (current.dials >= 20 && delta > 0) {
        recommendations.push({
          day,
          hour,
          delta,
          currentRate: current.rate,
          previousRate: previous.rate,
          dials: current.dials,
          lastWeekDials: previous.dials,
        });
      }
    });
  });

  recommendations.sort((a, b) => {
    if (b.delta !== a.delta) {
      return b.delta - a.delta;
    }

    if ((b.currentRate ?? 0) !== (a.currentRate ?? 0)) {
      return (b.currentRate ?? 0) - (a.currentRate ?? 0);
    }

    if (b.dials !== a.dials) {
      return b.dials - a.dials;
    }

    return a.day.label.localeCompare(b.day.label) || a.hour - b.hour;
  });

  return recommendations.slice(0, 5);
};

const formatRate = (rate: number | null) => {
  if (rate === null) {
    return '–';
  }
  return `${Math.round(rate * 100)}%`;
};

const BestTime = () => {
  const filteredEvents = useStore((state) => state.filteredEvents);

  const { thisWeekId, lastWeekId } = useMemo(() => {
    const weekIds = Array.from(new Set(filteredEvents.map((event) => event.week_start))).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );

    const latest = weekIds[weekIds.length - 1] ?? null;
    const previous = weekIds[weekIds.length - 2] ?? null;

    return { thisWeekId: latest ?? null, lastWeekId: previous ?? null };
  }, [filteredEvents]);

  const grids = useMemo(() => {
    const thisWeek = buildWeekGrid(filteredEvents, thisWeekId);
    const lastWeek = buildWeekGrid(filteredEvents, lastWeekId);
    return { thisWeek, lastWeek };
  }, [filteredEvents, thisWeekId, lastWeekId]);

  const recommendations = useMemo(
    () => buildRecommendations(grids.thisWeek, grids.lastWeek),
    [grids],
  );

  const thisWeekLabel = getWeekLabel(thisWeekId);
  const lastWeekLabel = getWeekLabel(lastWeekId);

  const hasEnoughWeeks = Boolean(thisWeekId && lastWeekId);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-800">Best Time to Call</h2>
        <p className="text-sm text-slate-500">
          Compare connect rates by day and hour to spot the best windows to call.
        </p>
      </div>
      <div className="px-6 py-6">
        {!hasEnoughWeeks ? (
          <p className="text-sm text-slate-500">
            Need at least two weeks of data to compare connect rates. Adjust filters or reseed the dataset.
          </p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(16rem,22rem)]">
            <Heatmap title="This Week" grid={grids.thisWeek} weekLabel={thisWeekLabel} />
            <Heatmap title="Last Week" grid={grids.lastWeek} weekLabel={lastWeekLabel} />
            <aside>
              <div className="mb-3">
                <h3 className="text-base font-semibold text-slate-800">Top 5 Windows to Test</h3>
                <p className="text-xs text-slate-500">
                  Positive connect rate change week-over-week with at least 20 dials this week.
                </p>
              </div>
              {recommendations.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No windows meet the minimum dial volume. Try widening your filters.
                </p>
              ) : (
                <ol className="space-y-3 text-sm text-slate-700">
                  {recommendations.map((item) => {
                    const deltaPct = Math.round(item.delta * 100);
                    const directionColor = deltaPct > 0 ? 'text-emerald-600' : 'text-slate-500';
                    return (
                      <li key={`${item.day.value}-${item.hour}`} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{`${item.day.label} ${formatHour(item.hour)}`}</span>
                          <span className={`text-xs font-semibold ${directionColor}`}>+{deltaPct} pts</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatRate(item.currentRate)} this week ({item.dials} dials) vs {formatRate(item.previousRate)} last week ({item.lastWeekDials} dials)
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
};

export default BestTime;
