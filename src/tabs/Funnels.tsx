import { useMemo, useCallback } from 'react';
import Funnel, { FunnelStageDatum, FunnelStageKey } from '../components/Funnel';
import { useStore } from '../store';
import type { DerivedEvent } from '../data/transforms';

interface StageDefinition {
  key: FunnelStageKey;
  label: string;
  predicate: (event: DerivedEvent) => boolean;
}

interface EntityFunnel {
  id: string;
  name: string;
  stages: FunnelStageDatum[];
}

const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    key: 'dials',
    label: 'Dials',
    predicate: () => true,
  },
  {
    key: 'connects',
    label: 'Connects',
    predicate: (event) => event.is_connected,
  },
  {
    key: 'conversations',
    label: 'Conversations',
    predicate: (event) => event.is_conversation,
  },
  {
    key: 'meetingsBooked',
    label: 'Meetings Booked',
    predicate: (event) => event.is_meeting_booked,
  },
  {
    key: 'meetingsHeld',
    label: 'Meetings Held',
    predicate: (event) => event.is_meeting_held,
  },
  {
    key: 'qualified',
    label: 'Qualified',
    predicate: (event) => event.is_qualified,
  },
];

const MAX_ENTITIES = 5;

const buildEntityFunnels = (
  events: DerivedEvent[],
  getId: (event: DerivedEvent) => string,
  getName: (id: string, sampleEvent: DerivedEvent | undefined) => string,
): EntityFunnel[] => {
  const grouped = new Map<string, DerivedEvent[]>();

  events.forEach((event) => {
    const id = getId(event);
    if (!id) {
      return;
    }

    const existing = grouped.get(id);
    if (existing) {
      existing.push(event);
    } else {
      grouped.set(id, [event]);
    }
  });

  const funnels = Array.from(grouped.entries()).map<EntityFunnel>(([id, entityEvents]) => {
    const stages: FunnelStageDatum[] = STAGE_DEFINITIONS.map((stage) => {
      const leads = new Set<string>();
      entityEvents.forEach((event) => {
        if (stage.predicate(event)) {
          leads.add(event.lead_id);
        }
      });

      return {
        key: stage.key,
        label: stage.label,
        count: leads.size,
      };
    });

    return {
      id,
      name: getName(id, entityEvents[0]),
      stages,
    };
  });

  funnels.sort((a, b) => {
    const aQualified = a.stages[a.stages.length - 1]?.count ?? 0;
    const bQualified = b.stages[b.stages.length - 1]?.count ?? 0;
    if (bQualified !== aQualified) {
      return bQualified - aQualified;
    }

    const aFirst = a.stages[0]?.count ?? 0;
    const bFirst = b.stages[0]?.count ?? 0;
    if (bFirst !== aFirst) {
      return bFirst - aFirst;
    }

    return a.name.localeCompare(b.name);
  });

  return funnels.slice(0, MAX_ENTITIES);
};

const formatSubtitle = (total: number) => `${total.toLocaleString()} total leads`; // first stage count

const Funnels = () => {
  const { filteredEvents, setFilters, filters, dataset } = useStore((state) => ({
    filteredEvents: state.filteredEvents,
    setFilters: state.setFilters,
    filters: state.filters,
    dataset: state.dataset,
  }));

  const sdrNameMap = useMemo(() => {
    const entries = dataset.sdrs.map((sdr) => [sdr.id, sdr.name] as const);
    return new Map(entries);
  }, [dataset.sdrs]);

  const companyFunnels = useMemo(
    () =>
      buildEntityFunnels(
        filteredEvents,
        (event) => event.company,
        (id) => id,
      ),
    [filteredEvents],
  );

  const teamFunnels = useMemo(
    () =>
      buildEntityFunnels(
        filteredEvents,
        (event) => event.team,
        (id) => id,
      ),
    [filteredEvents],
  );

  const sdrFunnels = useMemo(
    () =>
      buildEntityFunnels(
        filteredEvents,
        (event) => event.sdr_id,
        (id, sample) => sdrNameMap.get(id) ?? sample?.sdr_name ?? id,
      ),
    [filteredEvents, sdrNameMap],
  );

  const toggleCompany = useCallback(
    (company: string) => {
      const isActive = filters.companies.length === 1 && filters.companies[0] === company;
      setFilters({ companies: isActive ? [] : [company] });
    },
    [filters.companies, setFilters],
  );

  const toggleTeam = useCallback(
    (team: string) => {
      const isActive = filters.teams.length === 1 && filters.teams[0] === team;
      setFilters({ teams: isActive ? [] : [team] });
    },
    [filters.teams, setFilters],
  );

  const toggleSdr = useCallback(
    (sdrId: string) => {
      const isActive = filters.sdrs.length === 1 && filters.sdrs[0] === sdrId;
      setFilters({ sdrs: isActive ? [] : [sdrId] });
    },
    [filters.sdrs, setFilters],
  );

  const renderFunnelGroup = (
    title: string,
    funnels: EntityFunnel[],
    isSelected: (id: string) => boolean,
    onSelect: (id: string) => void,
  ) => {
    if (filteredEvents.length === 0) {
      return <p className="text-sm text-slate-500">No results for the current filters.</p>;
    }

    if (funnels.length === 0) {
      return <p className="text-sm text-slate-500">No funnel data found for this grouping.</p>;
    }

    return (
      <div className="mt-4 space-y-4">
        {funnels.map((funnel) => {
          const subtitle = formatSubtitle(funnel.stages[0]?.count ?? 0);
          return (
            <Funnel
              key={funnel.id}
              title={title}
              entityName={funnel.name}
              stages={funnel.stages}
              description={subtitle}
              isSelected={isSelected(funnel.id)}
              onSelect={() => onSelect(funnel.id)}
            />
          );
        })}
      </div>
    );
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-800">Sales Funnels</h2>
        <p className="text-sm text-slate-500">
          Progression from first touches through qualified outcomes. Click any funnel to focus on that company, team, or SDR.
        </p>
      </div>
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Company</h3>
          {renderFunnelGroup('Company', companyFunnels, (id) => filters.companies.includes(id), toggleCompany)}
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Team</h3>
          {renderFunnelGroup('Team', teamFunnels, (id) => filters.teams.includes(id), toggleTeam)}
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">SDR</h3>
          {renderFunnelGroup('SDR', sdrFunnels, (id) => filters.sdrs.includes(id), toggleSdr)}
        </div>
      </div>
    </section>
  );
};

export default Funnels;
