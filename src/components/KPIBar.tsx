import { useMemo } from 'react';
import {
  computeConnectToConversationRate,
  computeDialToConnectRate,
  computeMeetingToQualifiedRate,
  computeNoShowRate,
} from '../data/transforms';
import { useStore } from '../store';

const formatRate = (rate: number | null): string => {
  if (rate === null) {
    return '—';
  }

  return `${(rate * 100).toFixed(1)}%`;
};

const formatRateDetail = (numerator: number, denominator: number, emptyLabel: string) => {
  if (denominator === 0) {
    return emptyLabel;
  }

  return `${numerator.toLocaleString()} / ${denominator.toLocaleString()}`;
};

const KPIBar = () => {
  const filteredEvents = useStore((state) => state.filteredEvents);

  const metrics = useMemo(() => {
    const dialToConnect = computeDialToConnectRate(filteredEvents);
    const connectToConversation = computeConnectToConversationRate(filteredEvents);
    const meetingToQualified = computeMeetingToQualifiedRate(filteredEvents);
    const noShowRate = computeNoShowRate(filteredEvents);

    const meetingDurations = filteredEvents
      .map((event) => event.time_to_meeting_days)
      .filter((value): value is number => typeof value === 'number');

    const averageTimeToMeeting =
      meetingDurations.length === 0
        ? null
        : meetingDurations.reduce((sum, value) => sum + value, 0) / meetingDurations.length;

    return [
      {
        key: 'dial-connect',
        label: 'Dial→Connect %',
        value: formatRate(dialToConnect.rate),
        detail: formatRateDetail(dialToConnect.numerator, dialToConnect.denominator, 'No dials'),
      },
      {
        key: 'connect-conversation',
        label: 'Connect→Conversation %',
        value: formatRate(connectToConversation.rate),
        detail: formatRateDetail(
          connectToConversation.numerator,
          connectToConversation.denominator,
          'No connects',
        ),
      },
      {
        key: 'meeting-qualified',
        label: 'Meeting→Qualified %',
        value: formatRate(meetingToQualified.rate),
        detail: formatRateDetail(
          meetingToQualified.numerator,
          meetingToQualified.denominator,
          'No meetings held',
        ),
      },
      {
        key: 'no-show-rate',
        label: 'No-Show Rate',
        value: formatRate(noShowRate.rate),
        detail: formatRateDetail(noShowRate.numerator, noShowRate.denominator, 'No meetings booked'),
      },
      {
        key: 'avg-time-meeting',
        label: 'Avg Time-to-Meeting',
        value:
          averageTimeToMeeting === null ? '—' : `${averageTimeToMeeting.toFixed(1)} days`,
        detail:
          meetingDurations.length === 0
            ? 'No first meetings'
            : `${meetingDurations.length.toLocaleString()} leads`,
      },
    ];
  }, [filteredEvents]);

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => (
        <div
          key={metric.key}
          className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {metric.label}
          </span>
          <span className="text-2xl font-semibold text-slate-800">{metric.value}</span>
          <span className="text-xs text-slate-400">{metric.detail}</span>
        </div>
      ))}
    </section>
  );
};

export default KPIBar;
