import { useMemo } from 'react';

export type FunnelStageKey =
  | 'dials'
  | 'connects'
  | 'conversations'
  | 'meetingsBooked'
  | 'meetingsHeld'
  | 'qualified';

export interface FunnelStageDatum {
  key: FunnelStageKey;
  label: string;
  count: number;
}

interface FunnelProps {
  title: string;
  entityName: string;
  stages: FunnelStageDatum[];
  onSelect?: () => void;
  isSelected?: boolean;
  description?: string;
}

const formatPercent = (value: number | null) => {
  if (value === null) {
    return '—';
  }

  return `${(value * 100).toFixed(0)}%`;
};

const Funnel = ({ title, entityName, stages, onSelect, isSelected = false, description }: FunnelProps) => {
  const { maxCount, qualifiedCount, isEmpty } = useMemo(() => {
    const counts = stages.map((stage) => stage.count);
    const max = counts.length > 0 ? Math.max(...counts) : 0;
    const qualified = stages.length > 0 ? stages[stages.length - 1]?.count ?? 0 : 0;
    return {
      maxCount: max === 0 ? 1 : max,
      qualifiedCount: qualified,
      isEmpty: counts.every((value) => value === 0),
    };
  }, [stages]);

  const handleClick = () => {
    if (onSelect) {
      onSelect();
    }
  };

  const baseClasses =
    'w-full rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-70';
  const stateClasses = isSelected
    ? ' border-blue-300 shadow-md ring-1 ring-inset ring-blue-200'
    : ' border-slate-200 hover:border-blue-200 hover:shadow-sm';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!onSelect || isEmpty}
      aria-pressed={isSelected}
      aria-label={`${title} funnel for ${entityName}. ${
        isEmpty
          ? 'No progression data available for the current filters.'
          : isSelected
            ? 'Segment is currently highlighted.'
            : 'Activate to focus other insights on this segment.'
      }`}
      title={`${title} — ${isSelected ? 'Segment selected' : 'Click to focus on this segment'}`}
      className={`${baseClasses}${stateClasses}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className="text-lg font-semibold text-slate-800">{entityName}</p>
          {description ? <p className="text-xs text-slate-500">{description}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">Qualified</p>
          <p className="text-xl font-semibold text-slate-900">{qualifiedCount.toLocaleString()}</p>
        </div>
      </div>

      <ol className="mt-4 space-y-3">
        {stages.map((stage, index) => {
          const widthPercent = Math.max(6, (stage.count / maxCount) * 100);
          const nextStage = stages[index + 1];
          const nextConversion = nextStage
            ? stage.count === 0
              ? null
              : nextStage.count / stage.count
            : null;

          return (
            <li key={stage.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium uppercase tracking-wide text-slate-600">{stage.label}</span>
                <span className="text-sm font-semibold text-slate-800">{stage.count.toLocaleString()}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                  style={{ width: `${widthPercent}%` }}
                  aria-hidden
                />
              </div>
              {nextStage ? (
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                  <span>
                    {stage.label} → {nextStage.label}
                  </span>
                  <span className="font-semibold text-slate-600">{formatPercent(nextConversion)}</span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-xs text-slate-500">
        {isEmpty
          ? 'No progression data available for the current filters.'
          : onSelect
            ? 'Click to focus the dashboard on this segment.'
            : 'Funnel overview.'}
      </p>
    </button>
  );
};

export default Funnel;
