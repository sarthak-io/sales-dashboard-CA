import { useMemo } from 'react';
import type { Channel, Outcome } from '../types';
import { useStore } from '../store';

interface HeatmapCell {
  outcome: Outcome;
  count: number;
  percentOfChannel: number | null;
}

interface HeatmapRow {
  channel: Channel;
  label: string;
  total: number;
  cells: HeatmapCell[];
}

const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'call', label: 'Call' },
  { key: 'email', label: 'Email' },
  { key: 'linkedin', label: 'LinkedIn' },
];

const OUTCOMES: { key: Outcome; label: string }[] = [
  { key: 'no_answer', label: 'No Answer' },
  { key: 'voicemail', label: 'Voicemail' },
  { key: 'connected', label: 'Connected' },
  { key: 'conversation', label: 'Conversation' },
  { key: 'meeting_booked', label: 'Meeting Booked' },
  { key: 'meeting_held', label: 'Meeting Held' },
  { key: 'no_show', label: 'No Show' },
  { key: 'qualified', label: 'Qualified' },
];

const formatPercent = (value: number | null) => {
  if (value === null) {
    return '—';
  }

  return `${(value * 100).toFixed(1)}%`;
};

const formatCount = (value: number) => value.toLocaleString();

const getCellOpacity = (value: number, maxValue: number) => {
  if (maxValue === 0 || value === 0) {
    return 0;
  }

  const normalized = value / maxValue;
  return Math.min(0.85, Math.max(0.15, normalized));
};

const OutreachHeatmap = () => {
  const filteredEvents = useStore((state) => state.filteredEvents);

  const { rows, maxValue } = useMemo(() => {
    const totalsByChannel = new Map<Channel, number>();
    const countsByChannelAndOutcome = new Map<Channel, Map<Outcome, number>>();
    let largestValue = 0;

    CHANNELS.forEach(({ key }) => {
      totalsByChannel.set(key, 0);
      countsByChannelAndOutcome.set(key, new Map());
    });

    filteredEvents.forEach((event) => {
      const channelCounts = countsByChannelAndOutcome.get(event.channel);
      if (!channelCounts) {
        return;
      }

      const outcomeCount = (channelCounts.get(event.outcome) ?? 0) + 1;
      channelCounts.set(event.outcome, outcomeCount);

      const nextChannelTotal = (totalsByChannel.get(event.channel) ?? 0) + 1;
      totalsByChannel.set(event.channel, nextChannelTotal);

      if (outcomeCount > largestValue) {
        largestValue = outcomeCount;
      }
    });

    const rows: HeatmapRow[] = CHANNELS.map(({ key, label }) => {
      const total = totalsByChannel.get(key) ?? 0;
      const outcomeCounts = countsByChannelAndOutcome.get(key) ?? new Map();

      const cells = OUTCOMES.map(({ key: outcome }) => {
        const count = outcomeCounts.get(outcome) ?? 0;
        const percentOfChannel = total === 0 ? null : count / total;
        return { outcome, count, percentOfChannel };
      });

      return { channel: key, label, total, cells };
    });

    return { rows, maxValue: largestValue };
  }, [filteredEvents]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-800">Outreach Outcome Mix</h2>
        <p className="text-sm text-slate-500">
          Explore how outcomes vary by outreach channel. Hover to view counts and channel share.
        </p>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="px-6 py-12 text-sm text-slate-500">
          No outreach events match the selected filters.
        </div>
      ) : (
        <div className="overflow-x-auto px-6 py-6">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr>
                <th className="bg-slate-50 px-3 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                  Channel
                </th>
                {OUTCOMES.map(({ key, label }) => (
                  <th
                    key={key}
                    className="bg-slate-50 px-3 py-3 text-center font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.channel}>
                  <th scope="row" className="whitespace-nowrap px-3 py-3 text-left font-medium text-slate-700">
                    {row.label}
                    <div className="text-xs font-normal text-slate-500">{formatCount(row.total)} events</div>
                  </th>
                  {row.cells.map((cell) => {
                    const opacity = getCellOpacity(cell.count, maxValue);
                    const backgroundColor = `rgba(59, 130, 246, ${opacity})`;
                    const tooltipLines = [
                      `${row.label} → ${OUTCOMES.find((outcome) => outcome.key === cell.outcome)?.label ?? ''}`,
                      `Count: ${formatCount(cell.count)}`,
                      `Share: ${formatPercent(cell.percentOfChannel)}`,
                    ];

                    return (
                      <td key={cell.outcome} className="px-3 py-3 text-center">
                        <div
                          className="rounded-md px-2 py-2 text-sm font-medium text-slate-800 shadow-sm"
                          style={{ backgroundColor, color: opacity === 0 ? '#64748b' : undefined }}
                          title={tooltipLines.join('\n')}
                        >
                          {formatCount(cell.count)}
                          <div className="mt-1 text-[11px] font-normal text-slate-700">
                            {formatPercent(cell.percentOfChannel)}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default OutreachHeatmap;
