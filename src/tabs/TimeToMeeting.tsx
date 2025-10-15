import { useMemo } from 'react';
import { useStore } from '../store';
import type { DerivedEvent } from '../data/transforms';

interface HistogramBucket {
  label: string;
  min: number;
  max: number;
}

interface HistogramBin extends HistogramBucket {
  count: number;
  percentage: number;
}

interface SdrTimeToMeetingStat {
  id: string;
  name: string;
  team: string;
  qualifiedCount: number;
  averageDays: number;
}

const HISTOGRAM_BUCKETS: HistogramBucket[] = [
  { label: '0-2 days', min: 0, max: 2 },
  { label: '2-4 days', min: 2, max: 4 },
  { label: '4-6 days', min: 4, max: 6 },
  { label: '6-8 days', min: 6, max: 8 },
  { label: '8-10 days', min: 8, max: 10 },
  { label: '10-14 days', min: 10, max: 14 },
  { label: '14+ days', min: 14, max: Number.POSITIVE_INFINITY },
];

const MIN_QUALIFIED_LEADS = 5;
const BADGE_THRESHOLD = 0.8; // 20% faster than org median

const formatDays = (value: number | null) => {
  if (value === null) {
    return '—';
  }

  return `${value.toFixed(1)}d`;
};

const computeMedian = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const midPoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[midPoint - 1] + sorted[midPoint]) / 2;
  }

  return sorted[midPoint];
};

const bucketEvents = (events: DerivedEvent[]): HistogramBin[] => {
  const counts = HISTOGRAM_BUCKETS.map(() => 0);
  const total = events.length;

  events.forEach((event) => {
    const days = event.time_to_meeting_days;
    if (typeof days !== 'number') {
      return;
    }

    const bucketIndex = HISTOGRAM_BUCKETS.findIndex(
      (bucket) => days >= bucket.min && days < bucket.max,
    );

    if (bucketIndex >= 0) {
      counts[bucketIndex] += 1;
    } else if (days >= HISTOGRAM_BUCKETS[HISTOGRAM_BUCKETS.length - 1].min) {
      counts[HISTOGRAM_BUCKETS.length - 1] += 1;
    }
  });

  const safeTotal = total === 0 ? 1 : total;

  return HISTOGRAM_BUCKETS.map((bucket, index) => ({
    ...bucket,
    count: counts[index],
    percentage: counts[index] / safeTotal,
  }));
};

const groupBySdr = (events: DerivedEvent[]): Map<string, DerivedEvent[]> => {
  const grouped = new Map<string, DerivedEvent[]>();

  events.forEach((event) => {
    const existing = grouped.get(event.sdr_id);
    if (existing) {
      existing.push(event);
    } else {
      grouped.set(event.sdr_id, [event]);
    }
  });

  return grouped;
};

const TimeToMeeting = () => {
  const { filteredEvents, sdrDirectory } = useStore((state) => ({
    filteredEvents: state.filteredEvents,
    sdrDirectory: state.dataset.sdrs,
  }));

  const qualifiedMeetingEvents = useMemo(
    () =>
      filteredEvents.filter(
        (event) => event.is_qualified && typeof event.time_to_meeting_days === 'number',
      ),
    [filteredEvents],
  );

  const histogramBins = useMemo(() => bucketEvents(qualifiedMeetingEvents), [qualifiedMeetingEvents]);

  const organisationMedian = useMemo(
    () =>
      computeMedian(
        qualifiedMeetingEvents
          .map((event) => event.time_to_meeting_days)
          .filter((value): value is number => typeof value === 'number'),
      ),
    [qualifiedMeetingEvents],
  );

  const sdrStats = useMemo(() => {
    const grouped = groupBySdr(qualifiedMeetingEvents);

    const stats: SdrTimeToMeetingStat[] = Array.from(grouped.entries()).map(([sdrId, events]) => {
      const directoryEntry = sdrDirectory.find((entry) => entry.id === sdrId);
      const name = directoryEntry?.name ?? events[0]?.sdr_name ?? sdrId;
      const team = directoryEntry?.team ?? events[0]?.team ?? '—';

      const qualifiedCount = events.length;
      const totalDays = events.reduce((sum, event) => sum + (event.time_to_meeting_days ?? 0), 0);
      const averageDays = qualifiedCount === 0 ? 0 : totalDays / qualifiedCount;

      return {
        id: sdrId,
        name,
        team,
        qualifiedCount,
        averageDays,
      };
    });

    return stats.filter((stat) => stat.qualifiedCount >= MIN_QUALIFIED_LEADS);
  }, [qualifiedMeetingEvents, sdrDirectory]);

  const topTen = useMemo(
    () =>
      [...sdrStats]
        .sort((a, b) => a.averageDays - b.averageDays)
        .slice(0, 10),
    [sdrStats],
  );

  const bottomTen = useMemo(
    () =>
      [...sdrStats]
        .sort((a, b) => b.averageDays - a.averageDays)
        .slice(0, 10),
    [sdrStats],
  );

  const maxCount = useMemo(
    () => Math.max(1, ...histogramBins.map((bin) => bin.count)),
    [histogramBins],
  );

  const totalQualified = qualifiedMeetingEvents.length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-800">Time-to-Meeting</h2>
        <p className="mt-1 text-sm text-slate-500">
          How quickly qualified opportunities convert from first touch to first meeting. Includes leads with a
          qualified outcome and at least {MIN_QUALIFIED_LEADS} per SDR for the leaderboard.
        </p>
      </div>

      <div className="flex flex-col gap-6 px-6 py-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Qualified Lead Time Distribution</h3>
              <p className="text-sm text-slate-500">
                {totalQualified === 0
                  ? 'No qualified meetings found for the selected filters.'
                  : `${totalQualified.toLocaleString()} qualified leads with a median time-to-meeting of ${formatDays(
                      organisationMedian,
                    )}.`}
              </p>
            </div>
            {organisationMedian !== null && (
              <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                Org median: {formatDays(organisationMedian)}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {histogramBins.map((bin) => (
              <div key={bin.label} className="flex items-center gap-4">
                <span className="w-24 text-sm font-medium text-slate-600">{bin.label}</span>
                <div className="relative h-8 flex-1 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-blue-500/80"
                    style={{ width: `${(bin.count / maxCount) * 100}%` }}
                    aria-hidden
                  />
                </div>
                <span className="w-16 text-right text-sm font-semibold text-slate-700">{bin.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-base font-semibold text-slate-800">Fastest SDRs</h3>
              <p className="text-sm text-slate-500">Top 10 by lowest average time-to-meeting.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                      SDR
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                      Team
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                      Qualified
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                      Avg TTM
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topTen.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                        Not enough qualified leads to rank SDRs.
                      </td>
                    </tr>
                  ) : (
                    topTen.map((row) => {
                      const qualifiesForBadge =
                        organisationMedian !== null && row.averageDays <= organisationMedian * BADGE_THRESHOLD;

                      return (
                        <tr key={row.id} className="hover:bg-slate-50/70">
                          <th scope="row" className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-700">
                            <div className="flex items-center gap-2">
                              <span>{row.name}</span>
                              {qualifiesForBadge && (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                  Beats org median by ≥20%
                                </span>
                              )}
                            </div>
                          </th>
                          <td className="whitespace-nowrap px-4 py-3 text-left text-slate-600">{row.team}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">
                            {row.qualifiedCount.toLocaleString()}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                            {formatDays(row.averageDays)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-base font-semibold text-slate-800">Slowest SDRs</h3>
              <p className="text-sm text-slate-500">Bottom 10 by highest average time-to-meeting.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                      SDR
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                      Team
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                      Qualified
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                      Avg TTM
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bottomTen.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                        Not enough qualified leads to rank SDRs.
                      </td>
                    </tr>
                  ) : (
                    bottomTen.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <th scope="row" className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-700">
                          {row.name}
                        </th>
                        <td className="whitespace-nowrap px-4 py-3 text-left text-slate-600">{row.team}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">
                          {row.qualifiedCount.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                          {formatDays(row.averageDays)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TimeToMeeting;
