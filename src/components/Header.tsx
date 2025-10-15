import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, type FiltersState } from '../store';
import type { Channel } from '../types';
import { prepareDatasetFromCsv, serializeDashboardCsv } from '../utils/csv';

type FilterKey = keyof FiltersState;

type ToastTone = 'success' | 'error';

type ToastState = {
  id: number;
  message: string;
  tone: ToastTone;
};

const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: 'call', label: 'Calls' },
  { value: 'email', label: 'Emails' },
  { value: 'linkedin', label: 'LinkedIn' },
];

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
    replaceDataset,
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
    replaceDataset: state.replaceDataset,
  }));

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [toast]);

  const showToast = useCallback((message: string, tone: ToastTone) => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const teamOptions = dataset.teams;
  const sdrOptions = dataset.sdrs;
  const industryOptions = useMemo(
    () => dataset.industries.map((industry) => industry.name),
    [dataset.industries],
  );

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
      showToast('No filtered data available to export.', 'error');
      return;
    }

    const { csv, summaries } = serializeDashboardCsv(filteredEvents, dataset);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sdr-dashboard-${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(
      `Exported ${summaries.totals.totalEvents.toLocaleString()} events with dashboard summaries.`,
      'success',
    );

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('Dashboard summaries included in export', summaries);
    }
  }, [dataset, filteredEvents, showToast]);

  const handleTriggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        try {
          const { dataset: importedDataset } = prepareDatasetFromCsv(text);
          replaceDataset(importedDataset);
          showToast(
            `Imported ${importedDataset.events.length.toLocaleString()} events from CSV.`,
            'success',
          );
        } catch (error) {
          console.error(error);
          const message = error instanceof Error ? error.message : 'Failed to import CSV file.';
          showToast(message, 'error');
        } finally {
          event.target.value = '';
        }
      };
      reader.onerror = () => {
        showToast('Unable to read the selected file.', 'error');
        event.target.value = '';
      };

      reader.readAsText(file);
    },
    [replaceDataset, showToast],
  );

  const handleResetAndReseed = useCallback(() => {
    const newSeed = Math.random().toString(36).slice(2, 10);
    reseed(newSeed);
  }, [reseed]);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      {toast ? (
        <div
          className={`pointer-events-none fixed right-4 top-4 z-50 min-w-[240px] rounded-md border px-4 py-2 text-sm shadow-lg transition ${
            toast.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {toast.message}
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">SDR Analytics POC</p>
            <h1 className="text-xl font-semibold text-slate-800">Revenue Program Health</h1>
            <p className="text-xs text-slate-400">Seed: {seed}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={filteredEvents.length === 0}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              title="Export the current filtered dashboard view as a CSV file"
            >
              Export Current View CSV
            </button>
            <button
              type="button"
              onClick={handleTriggerImport}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              title="Import dashboard data from a CSV file"
            >
              Import CSV
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center rounded-md border border-transparent bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
              title="Clear all active filters"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={handleResetAndReseed}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
              title="Generate a new sample dataset and reset filters"
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
