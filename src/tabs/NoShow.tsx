import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { DerivedEvent } from '../data/transforms';

interface NoShowRow {
  key: string;
  label: string;
  booked: number;
  held: number;
  noShow: number;
  rate: number | null;
}

const formatPercent = (value: number | null) => {
  if (value === null) {
    return '—';
  }

  return `${(value * 100).toFixed(1)}%`;
};

const formatNumber = (value: number) => value.toLocaleString();

const sortRowsByRate = (rows: NoShowRow[]) =>
  [...rows].sort((a, b) => {
    const rateA = a.rate ?? -1;
    const rateB = b.rate ?? -1;

    if (rateB !== rateA) {
      return rateB - rateA;
    }

    if (b.noShow !== a.noShow) {
      return b.noShow - a.noShow;
    }

    if (b.booked !== a.booked) {
      return b.booked - a.booked;
    }

    return a.label.localeCompare(b.label);
  });

const createGroupAggregator = (
  getKey: (event: DerivedEvent) => { key: string; label: string } | null,
): ((events: DerivedEvent[]) => NoShowRow[]) => {
  return (events: DerivedEvent[]) => {
    const grouped = new Map<
      string,
      {
        label: string;
        booked: number;
        held: number;
        noShow: number;
      }
    >();

    events.forEach((event) => {
      const descriptor = getKey(event);
      if (!descriptor) {
        return;
      }

      const entry = grouped.get(descriptor.key);
      if (!entry) {
        grouped.set(descriptor.key, {
          label: descriptor.label,
          booked: event.is_meeting_booked ? 1 : 0,
          held: event.is_meeting_held ? 1 : 0,
          noShow: event.is_no_show ? 1 : 0,
        });
        return;
      }

      if (entry.label === descriptor.key && descriptor.label !== descriptor.key) {
        entry.label = descriptor.label;
      }

      if (event.is_meeting_booked) {
        entry.booked += 1;
      }
      if (event.is_meeting_held) {
        entry.held += 1;
      }
      if (event.is_no_show) {
        entry.noShow += 1;
      }
    });

    return Array.from(grouped.entries())
      .map(([key, entry]) => ({
        key,
        label: entry.label,
        booked: entry.booked,
        held: entry.held,
        noShow: entry.noShow,
        rate: entry.booked === 0 ? null : entry.noShow / entry.booked,
      }))
      .filter((row) => row.booked > 0);
  };
};

const aggregateBySdr = createGroupAggregator((event) => {
  if (!event.sdr_id && !event.sdr_name) {
    return null;
  }

  const key = event.sdr_id || event.sdr_name;
  const label = event.sdr_name || event.sdr_id;
  return { key, label };
});

const aggregateByIndustry = createGroupAggregator((event) => {
  const industry = event.industry?.trim();
  const label = industry && industry.length > 0 ? industry : 'Unknown';
  return { key: label.toLowerCase(), label };
});

interface TableProps {
  title: string;
  description: string;
  rows: NoShowRow[];
  showTopFive: boolean;
}

const Table = ({ title, description, rows, showTopFive }: TableProps) => {
  const sortedRows = sortRowsByRate(rows);
  const displayRows = showTopFive ? sortedRows.slice(0, 5) : sortedRows;

  return (
    <div className="flex-1 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {displayRows.length === 0 ? (
        <div className="px-5 py-6 text-sm text-slate-500">No meetings booked for the selected filters.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                  {title.includes('SDR') ? 'SDR' : 'Industry'}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                  Booked
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                  Held
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                  No-Show
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                  No-Show Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRows.map((row) => (
                <tr key={row.key} className="hover:bg-slate-50/70">
                  <th scope="row" className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-700">
                    {row.label}
                  </th>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">
                    {formatNumber(row.booked)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">
                    {formatNumber(row.held)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-rose-600">
                    {formatNumber(row.noShow)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-semibold text-rose-600">
                    {formatPercent(row.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const NoShow = () => {
  const filteredEvents = useStore((state) => state.filteredEvents);
  const [showTopFive, setShowTopFive] = useState(false);

  const { sdrRows, industryRows } = useMemo(() => {
    if (filteredEvents.length === 0) {
      return { sdrRows: [] as NoShowRow[], industryRows: [] as NoShowRow[] };
    }

    return {
      sdrRows: aggregateBySdr(filteredEvents),
      industryRows: aggregateByIndustry(filteredEvents),
    };
  }, [filteredEvents]);

  const handleToggle = () => {
    setShowTopFive((prev) => !prev);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Meeting No-Show Analysis</h2>
          <p className="mt-1 text-sm text-slate-500">
            Track booked versus held meetings and spot accounts with elevated no-show risk.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
            showTopFive
              ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-800'
          }`}
          aria-pressed={showTopFive}
        >
          {showTopFive ? 'Showing Top 5 by No-Show Rate' : 'Top 5 by No-Show Rate'}
        </button>
      </div>
      <div className="flex flex-col gap-6 p-6 lg:flex-row">
        <Table
          title="By SDR"
          description="Compare meeting outcomes for each rep to coach follow-up rigor."
          rows={sdrRows}
          showTopFive={showTopFive}
        />
        <Table
          title="By Industry"
          description="Identify verticals where meetings are more likely to drop."
          rows={industryRows}
          showTopFive={showTopFive}
        />
      </div>
    </section>
  );
};

export default NoShow;
