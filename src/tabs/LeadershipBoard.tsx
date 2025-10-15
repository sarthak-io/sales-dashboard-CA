import { useMemo } from 'react';
import {
  computeConnectToConversationRate,
  computeDialToConnectRate,
  computeMeetingToQualifiedRate,
} from '../data/transforms';
import { shallowEqual, useStore } from '../store';

const formatPercent = (value: number | null, fractionDigits = 1) => {
  if (value === null) {
    return '—';
  }

  return `${(value * 100).toFixed(fractionDigits)}%`;
};

const getPipelineHealthTone = (value: number | null) => {
  if (value === null) {
    return 'border-slate-200 bg-slate-100 text-slate-600';
  }

  if (value >= 0.55) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (value >= 0.4) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-rose-200 bg-rose-50 text-rose-700';
};

const SPARKLINE_WIDTH = 120;
const SPARKLINE_HEIGHT = 36;
const SPARKLINE_PADDING = 4;

interface SparklineProps {
  values: number[];
  labels: string[];
}

const Sparkline = ({ values, labels }: SparklineProps) => {
  if (values.length === 0) {
    return <span className="text-xs text-slate-400">No data</span>;
  }

  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const verticalRange = maxValue - minValue || 1;
  const effectiveWidth = SPARKLINE_WIDTH - SPARKLINE_PADDING * 2;
  const effectiveHeight = SPARKLINE_HEIGHT - SPARKLINE_PADDING * 2;
  const stepX = values.length > 1 ? effectiveWidth / (values.length - 1) : 0;

  const points = values.map((value, index) => {
    const x = SPARKLINE_PADDING + index * stepX;
    const normalized = (value - minValue) / verticalRange;
    const y = SPARKLINE_HEIGHT - SPARKLINE_PADDING - normalized * effectiveHeight;
    return { x, y };
  });

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ');

  const fillPath = `M${SPARKLINE_PADDING},${SPARKLINE_HEIGHT - SPARKLINE_PADDING} ${points
    .map((point) => `L${point.x},${point.y}`)
    .join(' ')} L${SPARKLINE_PADDING + stepX * (values.length - 1)},${SPARKLINE_HEIGHT - SPARKLINE_PADDING} Z`;

  const ariaLabel = values
    .map((value, index) => `${labels[index] ?? `Point ${index + 1}`}: ${value}`)
    .join(', ');

  return (
    <svg
      role="img"
      aria-label={`Weekly qualified meetings trend — ${ariaLabel}`}
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      className="h-10 w-24 text-blue-500"
    >
      <path d={fillPath} className="fill-blue-100/70" />
      <path d={path} className="stroke-current" fill="none" strokeWidth={2} strokeLinecap="round" />
      {points.map((point, index) => (
        <circle
          key={`${point.x}-${point.y}-${index}`}
          cx={point.x}
          cy={point.y}
          r={1.8}
          className="fill-white stroke-current"
          strokeWidth={1.2}
        />
      ))}
    </svg>
  );
};

interface LeadershipRow {
  rank: number;
  sdrId: string;
  sdrName: string;
  team: string;
  qualified: number;
  meetingsHeld: number;
  conversations: number;
  connects: number;
  dialToConnectRate: number | null;
  connectToConversationRate: number | null;
  meetingToQualifiedRate: number | null;
  pipelineHealth: number | null;
  sparklineValues: number[];
}

const LeadershipBoard = () => {
  const { filteredEvents, sdrDirectory } = useStore(
    (state) => ({
      filteredEvents: state.filteredEvents,
      sdrDirectory: state.dataset.sdrs,
    }),
    shallowEqual,
  );

  const { rows, weekLabels } = useMemo(() => {
    if (filteredEvents.length === 0) {
      return { rows: [] as LeadershipRow[], weekLabels: [] as string[] };
    }

    const eventsBySdr = new Map<string, typeof filteredEvents>();
    filteredEvents.forEach((event) => {
      const group = eventsBySdr.get(event.sdr_id);
      if (group) {
        group.push(event);
      } else {
        eventsBySdr.set(event.sdr_id, [event]);
      }
    });

    const allWeeks = Array.from(
      new Set(filteredEvents.map((event) => event.week_start)),
    ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const focusWeeks = allWeeks.slice(-8);

    const rowData: LeadershipRow[] = Array.from(eventsBySdr.entries()).map(([sdrId, events]) => {
      const directoryEntry = sdrDirectory.find((entry) => entry.id === sdrId);
      const sdrName = directoryEntry?.name ?? events[0]?.sdr_name ?? sdrId;
      const team = directoryEntry?.team ?? events[0]?.team ?? '—';

      const qualified = events.filter((event) => event.is_qualified).length;
      const meetingsHeld = events.filter((event) => event.is_meeting_held).length;
      const conversations = events.filter((event) => event.is_conversation).length;
      const connects = events.filter((event) => event.is_connected).length;

      const dialToConnect = computeDialToConnectRate(events);
      const connectToConversation = computeConnectToConversationRate(events);
      const meetingToQualified = computeMeetingToQualifiedRate(events);

      const nonNullRates = [
        dialToConnect.rate,
        connectToConversation.rate,
        meetingToQualified.rate,
      ].filter((value): value is number => value !== null);

      const pipelineHealth =
        nonNullRates.length === 0
          ? null
          : nonNullRates.reduce((sum, value) => sum + value, 0) / nonNullRates.length;

      const sparklineValues = focusWeeks.map(
        (week) => events.filter((event) => event.week_start === week && event.is_qualified).length,
      );

      return {
        rank: 0,
        sdrId,
        sdrName,
        team,
        qualified,
        meetingsHeld,
        conversations,
        connects,
        dialToConnectRate: dialToConnect.rate,
        connectToConversationRate: connectToConversation.rate,
        meetingToQualifiedRate: meetingToQualified.rate,
        pipelineHealth,
        sparklineValues,
      };
    });

    rowData.sort((a, b) => {
      if (b.qualified !== a.qualified) {
        return b.qualified - a.qualified;
      }
      if (b.meetingsHeld !== a.meetingsHeld) {
        return b.meetingsHeld - a.meetingsHeld;
      }
      if (b.conversations !== a.conversations) {
        return b.conversations - a.conversations;
      }
      return a.sdrName.localeCompare(b.sdrName);
    });

    const rankedRows = rowData.map((row, index) => ({ ...row, rank: index + 1 }));

    return { rows: rankedRows, weekLabels: focusWeeks };
  }, [filteredEvents, sdrDirectory]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Leadership Board</h2>
            <p className="text-sm text-slate-500">
              Ranked by qualified meetings, then meetings held and conversations. Weekly sparkline shows
              qualified wins across the most recent weeks.
            </p>
          </div>
          {weekLabels.length > 0 && (
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Window: {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(weekLabels[0]))}
              {' '}–{' '}
              {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
                new Date(weekLabels[weekLabels.length - 1]),
              )}
            </p>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-slate-500">
          No results for the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Rank
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  SDR
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Team
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Qualified
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Meetings Held
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Conversations
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Connects
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Dial→Connect %
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Connect→Conversation %
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Meeting→Qualified %
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pipeline Health
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Weekly Sparkline
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.sdrId} className="hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-600">{row.rank}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{row.sdrName}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.team}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{row.qualified.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">{row.meetingsHeld.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">{row.conversations.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">{row.connects.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">{formatPercent(row.dialToConnectRate)}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">
                    {formatPercent(row.connectToConversationRate)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">
                    {formatPercent(row.meetingToQualifiedRate)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${getPipelineHealthTone(
                        row.pipelineHealth,
                      )}`}
                    >
                      <span>{formatPercent(row.pipelineHealth, 0)}</span>
                      <span className="font-medium uppercase tracking-wide text-[10px] text-slate-400">score</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Sparkline values={row.sparklineValues} labels={weekLabels} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default LeadershipBoard;
