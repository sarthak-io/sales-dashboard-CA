import { useMemo } from 'react';
import { useStore } from '../store';
import type { DerivedEvent } from '../data/transforms';

const formatWeekLabel = (isoWeekStart: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(isoWeekStart));

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const formatDelta = (value: number) => `${value >= 0 ? '+' : '−'}${(Math.abs(value) * 100).toFixed(1)} pts`;

type ObjectionType = NonNullable<DerivedEvent['objection']>;

const OBJECTION_ORDER: ObjectionType[] = ['budget', 'timing', 'authority', 'need', 'other'];

const OBJECTION_LABELS: Record<ObjectionType, string> = {
  budget: 'Budget',
  timing: 'Timing',
  authority: 'Authority',
  need: 'Need',
  other: 'Other',
};

interface WeeklySummary {
  weekStart: string;
  label: string;
  totalConversations: number;
  stats: Array<{
    objection: ObjectionType;
    label: string;
    count: number;
    percentage: number;
  }>;
  shareByObjection: Map<ObjectionType, number>;
}

interface TrainingFocusEntry {
  objection: ObjectionType;
  label: string;
  change: number;
  currentShare: number;
}

interface SdrRow {
  id: string;
  name: string;
  totalConversations: number;
  percentages: Record<ObjectionType, number>;
}

const createEmptyCounts = (): Record<ObjectionType, number> => ({
  budget: 0,
  timing: 0,
  authority: 0,
  need: 0,
  other: 0,
});

const Objections = () => {
  const filteredEvents = useStore((state) => state.filteredEvents);

  const { weeklySummaries, trainingFocus, sdrRows } = useMemo(() => {
    const conversationEvents = filteredEvents.filter((event) => event.is_conversation);

    if (conversationEvents.length === 0) {
      return { weeklySummaries: [] as WeeklySummary[], trainingFocus: [] as TrainingFocusEntry[], sdrRows: [] as SdrRow[] };
    }

    const eventsByWeek = new Map<string, DerivedEvent[]>();
    conversationEvents.forEach((event) => {
      const existing = eventsByWeek.get(event.week_start) ?? [];
      existing.push(event);
      eventsByWeek.set(event.week_start, existing);
    });

    const sortedWeeks = Array.from(eventsByWeek.keys()).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );

    const allWeekSummaries: WeeklySummary[] = sortedWeeks.map((weekStart) => {
      const events = eventsByWeek.get(weekStart) ?? [];
      const totalConversations = events.length;
      const counts = new Map<ObjectionType, number>();

      events.forEach((event) => {
        if (event.objection) {
          const key = event.objection as ObjectionType;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      });

      const stats = Array.from(counts.entries())
        .map(([objection, count]) => ({
          objection,
          label: OBJECTION_LABELS[objection],
          count,
          percentage: totalConversations === 0 ? 0 : count / totalConversations,
        }))
        .sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count;
          }
          if (b.percentage !== a.percentage) {
            return b.percentage - a.percentage;
          }
          return a.label.localeCompare(b.label);
        })
        .slice(0, 3);

      const shareByObjection = new Map<ObjectionType, number>();
      counts.forEach((count, objection) => {
        shareByObjection.set(objection, totalConversations === 0 ? 0 : count / totalConversations);
      });

      return {
        weekStart,
        label: formatWeekLabel(weekStart),
        totalConversations,
        stats,
        shareByObjection,
      };
    });

    const weeklySummaries = allWeekSummaries.slice(0, 6);

    let trainingFocus: TrainingFocusEntry[] = [];
    if (allWeekSummaries.length >= 2) {
      const [currentWeek, previousWeek] = allWeekSummaries;
      const objections = new Set<ObjectionType>();
      currentWeek.shareByObjection.forEach((_, objection) => objections.add(objection));
      previousWeek.shareByObjection.forEach((_, objection) => objections.add(objection));

      trainingFocus = Array.from(objections)
        .map((objection) => {
          const currentShare = currentWeek.shareByObjection.get(objection) ?? 0;
          const previousShare = previousWeek.shareByObjection.get(objection) ?? 0;
          return {
            objection,
            label: OBJECTION_LABELS[objection],
            change: currentShare - previousShare,
            currentShare,
          };
        })
        .filter((entry) => entry.change > 0)
        .sort((a, b) => b.change - a.change)
        .slice(0, 3);
    }

    const sdrMap = new Map<string, { name: string; total: number; counts: Record<ObjectionType, number> }>();

    conversationEvents.forEach((event) => {
      const key = event.sdr_id || event.sdr_name;
      if (!key) {
        return;
      }

      if (!sdrMap.has(key)) {
        sdrMap.set(key, {
          name: event.sdr_name || event.sdr_id || key,
          total: 0,
          counts: createEmptyCounts(),
        });
      }

      const entry = sdrMap.get(key);
      if (!entry) {
        return;
      }

      entry.total += 1;
      if (event.objection) {
        entry.counts[event.objection as ObjectionType] += 1;
      }
    });

    const sdrRows = Array.from(sdrMap.entries())
      .map(([id, entry]) => {
        const percentages = createEmptyCounts();
        OBJECTION_ORDER.forEach((objection) => {
          percentages[objection] = entry.total === 0 ? 0 : entry.counts[objection] / entry.total;
        });

        return {
          id,
          name: entry.name,
          totalConversations: entry.total,
          percentages,
        };
      })
      .filter((row) => row.totalConversations > 0)
      .sort((a, b) => {
        if (b.totalConversations !== a.totalConversations) {
          return b.totalConversations - a.totalConversations;
        }
        return a.name.localeCompare(b.name);
      });

    return { weeklySummaries, trainingFocus, sdrRows };
  }, [filteredEvents]);

  const hasWeeklyData = weeklySummaries.length > 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-800">Objection Tracker</h2>
        <p className="mt-1 text-sm text-slate-500">
          Surface the objection themes slowing conversion and coach reps on the biggest movers week-over-week.
        </p>
      </div>

      <div className="flex flex-col gap-6 p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700">Training Focus</h3>
            {trainingFocus.length === 0 ? (
              <p className="mt-3 text-sm text-amber-800">
                No objections increased versus last week. Maintain current enablement playbooks.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {trainingFocus.map((entry) => (
                  <li key={entry.objection} className="flex items-center justify-between">
                    <span className="font-medium text-amber-900">{entry.label}</span>
                    <span className="tabular-nums text-amber-800">
                      {formatPercent(entry.currentShare)}
                      <span className="ml-2 text-xs text-amber-700">{formatDelta(entry.change)} WoW</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-amber-700">Compared to the immediate prior week.</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white lg:col-span-2">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Weekly Top Objections
              </h3>
              <p className="mt-1 text-xs text-slate-400">Share of conversations citing an objection (Top 3 per week).</p>
            </div>
            {hasWeeklyData ? (
              <div className="divide-y divide-slate-100">
                {weeklySummaries.map((summary) => (
                  <div key={summary.weekStart} className="px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="text-sm font-medium text-slate-700">Week of {summary.label}</h4>
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        {summary.totalConversations.toLocaleString()} conversations
                      </span>
                    </div>
                    {summary.stats.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">No objections logged this week.</p>
                    ) : (
                      <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                        {summary.stats.map((stat) => (
                          <div key={stat.objection} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {stat.label}
                            </dt>
                            <dd className="mt-1 text-sm font-semibold text-slate-800">
                              {stat.count.toLocaleString()}{' '}
                              <span className="text-xs font-normal text-slate-500">({formatPercent(stat.percentage)})</span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-sm text-slate-500">No conversation activity for the selected filters.</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              SDR Objection Mix
            </h3>
            <p className="mt-1 text-xs text-slate-400">Percent of conversations where each objection surfaces.</p>
          </div>
          {sdrRows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">No conversations to analyze for the selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                      SDR
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                      Conversations
                    </th>
                    {OBJECTION_ORDER.map((objection) => (
                      <th
                        key={objection}
                        scope="col"
                        className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {OBJECTION_LABELS[objection]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sdrRows.map((row) => {
                    const highestObjection = OBJECTION_ORDER.reduce<ObjectionType | null>((best, objection) => {
                      if (best === null) {
                        return row.percentages[objection] > 0 ? objection : null;
                      }
                      return row.percentages[objection] > row.percentages[best] ? objection : best;
                    }, null);

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <th scope="row" className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-700">
                          {row.name}
                        </th>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">
                          {row.totalConversations.toLocaleString()}
                        </td>
                        {OBJECTION_ORDER.map((objection) => {
                          const value = row.percentages[objection];
                          const isHighlight = highestObjection === objection && value > 0;

                          return (
                            <td
                              key={objection}
                              className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${
                                isHighlight ? 'font-semibold text-rose-600' : 'text-slate-600'
                              }`}
                            >
                              {formatPercent(value)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Objections;
