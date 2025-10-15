import { ChangeEvent, useCallback, useMemo } from 'react';
import { useStore, type FiltersState } from '../store';
import type { Channel, OutreachEvent } from '../types';

type FilterKey = keyof FiltersState;

const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: 'call', label: 'Calls' },
  { value: 'email', label: 'Emails' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const CSV_COLUMNS: Array<keyof OutreachEvent> = [
  'event_id',
  'lead_id',
  'timestamp',
  'week_start',
  'sdr_id',
  'sdr_name',
  'team',
  'company',
  'industry',
  'channel',
  'outcome',
  'objection',
];

const formatCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value).replace(/"/g, '""');
  return `"${stringValue}"`;
};

const Header = () => {
  const {
    dataset,
    filters,
    setFilters,
    resetFilters,
    dateRange,
    setDateRange,
    reseed,
    filteredEvents,
    seed,
  } = useStore((state) => ({
    dataset: state.dataset,
    filters: state.filters,
    setFilters: state.setFilters,
    resetFilters: state.resetFilters,
    dateRange: state.dateRange,
    setDateRange: state.setDateRange,
    reseed: state.reseed,
    filteredEvents: state.filteredEvents,
    seed: state.seed,
  }));

  const teamOptions = dataset.teams;
  const sdrOptions = dataset.sdrs;
  const industryOptions = useMemo(() => dataset.industries.map((industry) => industry.name), [
    dataset.industries,
  ]);

  const handleMultiSelectChange = useCallback(
    (key: FilterKey) => (event: ChangeEvent<HTMLSelectElement>) => {
      const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
      setFilters({ [key]: selected } as Partial<FiltersState>);
    },
    [setFilters],
  );

  const handleDateChange = useCallback(
    (boundary: 'start' | 'end') => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value || null;
      setDateRange({
        start: boundary === 'start' ? value : dateRange.start,
        end: boundary === 'end' ? value : dateRange.end,
      });
    },
    [dateRange.end, dateRange.start, setDateRange],
  );

  const handleDownloadCsv = useCallback(() => {
    if (filteredEvents.length === 0) {
      return;
    }

    const headerRow = CSV_COLUMNS.map((column) => formatCsvValue(column)).join(',');
    const dataRows = filteredEvents.map((event) =>
      CSV_COLUMNS.map((column) => formatCsvValue(event[column])).join(','),
    );

    const csvContent = [headerRow, ...dataRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sdr-dashboard-${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredEvents]);

  const handleResetAndReseed = useCallback(() => {
    const newSeed = Math.random().toString(36).slice(2, 10);
    reseed(newSeed);
  }, [reseed]);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">SDR Analytics POC</p>
            <h1 className="text-xl font-semibold text-slate-800">Revenue Program Health</h1>
            <p className="text-xs text-slate-400">Seed: {seed}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={filteredEvents.length === 0}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Download Current View CSV
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center rounded-md border border-transparent bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={handleResetAndReseed}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500"
            >
              Reset &amp; Reseed
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white/80 p-3">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Date Range</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.start ?? ''}
                onChange={handleDateChange('start')}
                className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={dateRange.end ?? ''}
                onChange={handleDateChange('end')}
                className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white/80 p-3">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Teams</label>
            <select
              multiple
              value={filters.teams}
              onChange={handleMultiSelectChange('teams')}
              className="h-20 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {teamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white/80 p-3">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">SDRs</label>
            <select
              multiple
              value={filters.sdrs}
              onChange={handleMultiSelectChange('sdrs')}
              className="h-20 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {sdrOptions.map((sdr) => (
                <option key={sdr.id} value={sdr.id}>
                  {sdr.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white/80 p-3">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Industries</label>
            <select
              multiple
              value={filters.industries}
              onChange={handleMultiSelectChange('industries')}
              className="h-20 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {industryOptions.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white/80 p-3">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Channels</label>
            <select
              multiple
              value={filters.channels}
              onChange={handleMultiSelectChange('channels')}
              className="h-20 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {CHANNEL_OPTIONS.map((channel) => (
                <option key={channel.value} value={channel.value}>
                  {channel.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
