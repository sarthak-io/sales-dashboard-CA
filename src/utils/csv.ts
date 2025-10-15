import type { GeneratedDataset } from '../data/generator';
import {
  computeConnectToConversationRate,
  computeDialToConnectRate,
  computeMeetingToQualifiedRate,
  computeNoShowRate,
  deriveEvents,
  type DerivedEvent,
} from '../data/transforms';
import type { Channel, Outcome, OutreachEvent } from '../types';

export const CSV_COLUMNS: Array<keyof OutreachEvent> = [
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

const VALID_CHANNELS: Channel[] = ['call', 'email', 'linkedin'];
const VALID_OUTCOMES: Outcome[] = [
  'no_answer',
  'voicemail',
  'connected',
  'conversation',
  'meeting_booked',
  'meeting_held',
  'no_show',
  'qualified',
];
const VALID_OBJECTIONS: Array<NonNullable<OutreachEvent['objection']>> = [
  'budget',
  'timing',
  'authority',
  'need',
  'other',
];

type Nullable<T> = T | null;

type RateRecord = {
  label: string;
  numerator: number;
  denominator: number;
  rate: Nullable<number>;
};

type FunnelStageKey =
  | 'dials'
  | 'connects'
  | 'conversations'
  | 'meetingsBooked'
  | 'meetingsHeld'
  | 'qualified';

type FunnelSummary = {
  id: string;
  name: string;
  stages: Array<{
    key: FunnelStageKey;
    label: string;
    count: number;
  }>;
};

type PipelineHealthSummary = {
  id: string;
  label: string;
  score: number;
  components: RateRecord[];
};

type IndustrySummary = {
  industry: string;
  dials: number;
  connects: number;
  meetingsBooked: number;
  qualified: number;
  answerRate: number;
  meetingsPer100Dials: number;
};

type HeatmapSummaryRow = {
  channel: Channel;
  totals: number;
  outcomes: Record<Outcome, number>;
};

type ObjectionSummary = {
  objection: OutreachEvent['objection'];
  count: number;
};

type NoShowSummary = {
  meetingsBooked: number;
  meetingsHeld: number;
  noShows: number;
  rate: Nullable<number>;
};

type TimeToMeetingSummary = {
  averageDays: Nullable<number>;
  medianDays: Nullable<number>;
  sampleSize: number;
};

type FrequencyDatum = {
  label: string;
  count: number;
};

type LeaderboardEntry = {
  sdrId: string;
  sdrName: string;
  connects: number;
  meetingsHeld: number;
  qualified: number;
};

export interface DashboardSummaries {
  generatedAt: string;
  seed: string;
  totals: {
    totalEvents: number;
    uniqueLeads: number;
    dateRange: { start: Nullable<string>; end: Nullable<string> };
    channelTotals: Record<Channel, number>;
    outcomeTotals: Record<Outcome, number>;
  };
  kpis: RateRecord[];
  pipelineHealth: {
    overallAverage: Nullable<number>;
    topTeams: PipelineHealthSummary[];
  };
  funnels: {
    companies: FunnelSummary[];
    teams: FunnelSummary[];
    sdrs: FunnelSummary[];
  };
  industries: IndustrySummary[];
  outreachHeatmap: HeatmapSummaryRow[];
  objections: ObjectionSummary[];
  noShow: NoShowSummary;
  timeToMeeting: TimeToMeetingSummary;
  bestTime: {
    topDays: FrequencyDatum[];
    topHours: FrequencyDatum[];
  };
  leaderboard: LeaderboardEntry[];
}

const formatCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value).replace(/"/g, '""');
  return `"${stringValue}"`;
};

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = false;
        continue;
      }

      current += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
};

const buildRateRecord = (label: string, numerator: number, denominator: number, rate: Nullable<number>): RateRecord => ({
  label,
  numerator,
  denominator,
  rate,
});

const STAGE_DEFINITIONS: Array<{
  key: FunnelStageKey;
  label: string;
  predicate: (event: DerivedEvent) => boolean;
}> = [
  { key: 'dials', label: 'Dials', predicate: () => true },
  { key: 'connects', label: 'Connects', predicate: (event) => event.is_connected },
  { key: 'conversations', label: 'Conversations', predicate: (event) => event.is_conversation },
  { key: 'meetingsBooked', label: 'Meetings Booked', predicate: (event) => event.is_meeting_booked },
  { key: 'meetingsHeld', label: 'Meetings Held', predicate: (event) => event.is_meeting_held },
  { key: 'qualified', label: 'Qualified', predicate: (event) => event.is_qualified },
];

const MAX_ENTITY_COUNT = 5;

const buildFunnels = (
  events: DerivedEvent[],
  getId: (event: DerivedEvent) => string | null,
  getName: (id: string, sample: DerivedEvent | undefined) => string,
): FunnelSummary[] => {
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

  const funnels = Array.from(grouped.entries()).map<FunnelSummary>(([id, entityEvents]) => {
    const stages = STAGE_DEFINITIONS.map((stage) => {
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

  return funnels.slice(0, MAX_ENTITY_COUNT);
};

const computeMedian = (values: number[]): Nullable<number> => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
};

const buildIndustrySummaries = (events: DerivedEvent[]): IndustrySummary[] => {
  const grouped = new Map<
    string,
    {
      dials: number;
      connects: number;
      meetings: Set<string>;
      qualified: Set<string>;
    }
  >();

  events.forEach((event) => {
    if (!event.is_dial) {
      return;
    }

    const key = event.industry?.trim() || 'Unknown';
    const record = grouped.get(key);

    if (!record) {
      grouped.set(key, {
        dials: 1,
        connects: event.is_connected ? 1 : 0,
        meetings: event.is_meeting_booked ? new Set([event.lead_id]) : new Set(),
        qualified: event.is_qualified ? new Set([event.lead_id]) : new Set(),
      });
      return;
    }

    record.dials += 1;
    if (event.is_connected) {
      record.connects += 1;
    }
    if (event.is_meeting_booked) {
      record.meetings.add(event.lead_id);
    }
    if (event.is_qualified) {
      record.qualified.add(event.lead_id);
    }
  });

  return Array.from(grouped.entries())
    .map(([industry, data]) => {
      const meetingsBooked = data.meetings.size;
      const qualified = data.qualified.size;
      const answerRate = data.dials === 0 ? 0 : data.connects / data.dials;
      const meetingsPer100Dials = data.dials === 0 ? 0 : (meetingsBooked / data.dials) * 100;

      return {
        industry,
        dials: data.dials,
        connects: data.connects,
        meetingsBooked,
        qualified,
        answerRate,
        meetingsPer100Dials,
      };
    })
    .filter((item) => item.dials > 0)
    .sort((a, b) => b.meetingsBooked - a.meetingsBooked || b.qualified - a.qualified);
};

const buildHeatmapSummary = (events: DerivedEvent[]): HeatmapSummaryRow[] => {
  const channelTotals: Record<Channel, number> = {
    call: 0,
    email: 0,
    linkedin: 0,
  };

  const matrix: Record<Channel, Record<Outcome, number>> = {
    call: {
      no_answer: 0,
      voicemail: 0,
      connected: 0,
      conversation: 0,
      meeting_booked: 0,
      meeting_held: 0,
      no_show: 0,
      qualified: 0,
    },
    email: {
      no_answer: 0,
      voicemail: 0,
      connected: 0,
      conversation: 0,
      meeting_booked: 0,
      meeting_held: 0,
      no_show: 0,
      qualified: 0,
    },
    linkedin: {
      no_answer: 0,
      voicemail: 0,
      connected: 0,
      conversation: 0,
      meeting_booked: 0,
      meeting_held: 0,
      no_show: 0,
      qualified: 0,
    },
  };

  events.forEach((event) => {
    channelTotals[event.channel] += 1;
    matrix[event.channel][event.outcome] += 1;
  });

  return (Object.keys(matrix) as Channel[]).map((channel) => ({
    channel,
    totals: channelTotals[channel],
    outcomes: matrix[channel],
  }));
};

const buildObjectionSummary = (events: DerivedEvent[]): ObjectionSummary[] => {
  const counts = new Map<OutreachEvent['objection'], number>();

  events.forEach((event) => {
    const objection = event.objection ?? null;
    if (!objection) {
      return;
    }

    counts.set(objection, (counts.get(objection) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([objection, count]) => ({ objection, count }))
    .sort((a, b) => b.count - a.count);
};

const buildNoShowSummary = (events: DerivedEvent[]): NoShowSummary => {
  const meetingsBooked = events.filter((event) => event.is_meeting_booked).length;
  const meetingsHeld = events.filter((event) => event.is_meeting_held).length;
  const noShows = events.filter((event) => event.is_no_show).length;
  const rate = meetingsBooked === 0 ? null : noShows / meetingsBooked;
  return { meetingsBooked, meetingsHeld, noShows, rate };
};

const buildTimeToMeetingSummary = (events: DerivedEvent[]): TimeToMeetingSummary => {
  const durations = events
    .map((event) => event.time_to_meeting_days)
    .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));

  if (durations.length === 0) {
    return { averageDays: null, medianDays: null, sampleSize: 0 };
  }

  const total = durations.reduce((sum, value) => sum + value, 0);
  return {
    averageDays: total / durations.length,
    medianDays: computeMedian(durations),
    sampleSize: durations.length,
  };
};

const buildFrequencySummary = (values: string[], topN = 3): FrequencyDatum[] => {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, topN);
};

const buildLeaderboard = (events: DerivedEvent[]): LeaderboardEntry[] => {
  const grouped = new Map<
    string,
    {
      name: string;
      connects: number;
      meetingsHeld: number;
      qualified: number;
    }
  >();

  events.forEach((event) => {
    const key = event.sdr_id || event.sdr_name || 'unknown';
    const record = grouped.get(key);
    const connectsIncrement = event.is_connected ? 1 : 0;
    const meetingsHeldIncrement = event.is_meeting_held ? 1 : 0;
    const qualifiedIncrement = event.is_qualified ? 1 : 0;

    if (!record) {
      grouped.set(key, {
        name: event.sdr_name || event.sdr_id || 'Unknown SDR',
        connects: connectsIncrement,
        meetingsHeld: meetingsHeldIncrement,
        qualified: qualifiedIncrement,
      });
      return;
    }

    record.connects += connectsIncrement;
    record.meetingsHeld += meetingsHeldIncrement;
    record.qualified += qualifiedIncrement;
  });

  return Array.from(grouped.entries())
    .map(([sdrId, stats]) => ({
      sdrId,
      sdrName: stats.name,
      connects: stats.connects,
      meetingsHeld: stats.meetingsHeld,
      qualified: stats.qualified,
    }))
    .sort((a, b) => b.qualified - a.qualified || b.meetingsHeld - a.meetingsHeld || b.connects - a.connects)
    .slice(0, 10);
};

export const buildDashboardSummaries = (
  events: DerivedEvent[],
  dataset: GeneratedDataset,
): DashboardSummaries => {
  const totals = {
    totalEvents: events.length,
    uniqueLeads: new Set(events.map((event) => event.lead_id)).size,
    dateRange: (() => {
      if (events.length === 0) {
        return { start: null, end: null } as const;
      }
      const timestamps = events.map((event) => new Date(event.timestamp).getTime()).filter((time) => !Number.isNaN(time));
      if (timestamps.length === 0) {
        return { start: null, end: null } as const;
      }
      const start = new Date(Math.min(...timestamps)).toISOString();
      const end = new Date(Math.max(...timestamps)).toISOString();
      return { start, end } as const;
    })(),
    channelTotals: events.reduce(
      (acc, event) => {
        acc[event.channel] += 1;
        return acc;
      },
      { call: 0, email: 0, linkedin: 0 } as Record<Channel, number>,
    ),
    outcomeTotals: events.reduce(
      (acc, event) => {
        acc[event.outcome] += 1;
        return acc;
      },
      {
        no_answer: 0,
        voicemail: 0,
        connected: 0,
        conversation: 0,
        meeting_booked: 0,
        meeting_held: 0,
        no_show: 0,
        qualified: 0,
      } as Record<Outcome, number>,
    ),
  };

  const dialToConnect = computeDialToConnectRate(events);
  const connectToConversation = computeConnectToConversationRate(events);
  const meetingToQualified = computeMeetingToQualifiedRate(events);
  const noShow = computeNoShowRate(events);

  const kpis: RateRecord[] = [
    buildRateRecord('Dial→Connect', dialToConnect.numerator, dialToConnect.denominator, dialToConnect.rate),
    buildRateRecord(
      'Connect→Conversation',
      connectToConversation.numerator,
      connectToConversation.denominator,
      connectToConversation.rate,
    ),
    buildRateRecord(
      'Meeting→Qualified',
      meetingToQualified.numerator,
      meetingToQualified.denominator,
      meetingToQualified.rate,
    ),
    buildRateRecord('No-Show Rate', noShow.numerator, noShow.denominator, noShow.rate),
  ];

  const pipelineByTeam = (() => {
    const grouped = new Map<string, DerivedEvent[]>();
    events.forEach((event) => {
      if (!event.team) {
        return;
      }
      const teamEvents = grouped.get(event.team) ?? [];
      teamEvents.push(event);
      grouped.set(event.team, teamEvents);
    });

    const summaries: PipelineHealthSummary[] = [];
    grouped.forEach((group, team) => {
      const dialToConnectTeam = computeDialToConnectRate(group);
      const connectToConversationTeam = computeConnectToConversationRate(group);
      const meetingToQualifiedTeam = computeMeetingToQualifiedRate(group);

      const breakdowns = [
        buildRateRecord(
          'Dial→Connect',
          dialToConnectTeam.numerator,
          dialToConnectTeam.denominator,
          dialToConnectTeam.rate,
        ),
        buildRateRecord(
          'Connect→Conversation',
          connectToConversationTeam.numerator,
          connectToConversationTeam.denominator,
          connectToConversationTeam.rate,
        ),
        buildRateRecord(
          'Meeting→Qualified',
          meetingToQualifiedTeam.numerator,
          meetingToQualifiedTeam.denominator,
          meetingToQualifiedTeam.rate,
        ),
      ];

      const available = breakdowns
        .map((item) => item.rate)
        .filter((value): value is number => typeof value === 'number');
      if (available.length === 0) {
        return;
      }

      const score = Math.round(
        (available.reduce((sum, value) => sum + value, 0) / available.length) * 100,
      );

      summaries.push({
        id: team,
        label: team,
        score,
        components: breakdowns,
      });
    });

    summaries.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
    const overallAverage = summaries.length === 0
      ? null
      : summaries.reduce((sum, item) => sum + item.score, 0) / summaries.length;

    return {
      overallAverage,
      topTeams: summaries.slice(0, MAX_ENTITY_COUNT),
    };
  })();

  const companyFunnels = buildFunnels(
    events,
    (event) => (event.company ? event.company : null),
    (id) => id,
  );

  const teamFunnels = buildFunnels(
    events,
    (event) => (event.team ? event.team : null),
    (id) => id,
  );

  const sdrNameLookup = new Map(dataset.sdrs.map((sdr) => [sdr.id, sdr.name] as const));
  const sdrFunnels = buildFunnels(
    events,
    (event) => (event.sdr_id ? event.sdr_id : null),
    (id, sample) => sdrNameLookup.get(id) ?? sample?.sdr_name ?? id,
  );

  const industries = buildIndustrySummaries(events);
  const outreachHeatmap = buildHeatmapSummary(events);
  const objections = buildObjectionSummary(events);
  const noShowSummary = buildNoShowSummary(events);
  const timeToMeeting = buildTimeToMeetingSummary(events);

  const bestTime = (() => {
    const dayCounts = buildFrequencySummary(
      events.map((event) => new Date(event.timestamp).toLocaleDateString('en-US', { weekday: 'short' })),
      5,
    );
    const hourCounts = buildFrequencySummary(
      events.map((event) => new Date(event.timestamp).getUTCHours().toString().padStart(2, '0')),
      5,
    );
    return {
      topDays: dayCounts,
      topHours: hourCounts,
    };
  })();

  const leaderboard = buildLeaderboard(events);

  return {
    generatedAt: new Date().toISOString(),
    seed: dataset.seed,
    totals,
    kpis,
    pipelineHealth: {
      overallAverage: pipelineByTeam.overallAverage,
      topTeams: pipelineByTeam.topTeams,
    },
    funnels: {
      companies: companyFunnels,
      teams: teamFunnels,
      sdrs: sdrFunnels,
    },
    industries,
    outreachHeatmap,
    objections,
    noShow: noShowSummary,
    timeToMeeting,
    bestTime,
    leaderboard,
  };
};

export interface SerializedCsvResult {
  csv: string;
  summaries: DashboardSummaries;
}

export const serializeDashboardCsv = (
  events: DerivedEvent[],
  dataset: GeneratedDataset,
): SerializedCsvResult => {
  const summaries = buildDashboardSummaries(events, dataset);
  const metadataLines = [
    `# DASHBOARD_SUMMARY_JSON=${JSON.stringify(summaries)}`,
    `# DATASET_SEED=${dataset.seed}`,
    `# GENERATED_AT=${summaries.generatedAt}`,
  ];

  const headerRow = CSV_COLUMNS.map((column) => formatCsvValue(column)).join(',');
  const dataRows = events.map((event) =>
    CSV_COLUMNS.map((column) => formatCsvValue(event[column])).join(','),
  );

  return {
    csv: [...metadataLines, headerRow, ...dataRows].join('\n'),
    summaries,
  };
};

export interface ParsedDashboardCsv {
  events: OutreachEvent[];
  summaries: DashboardSummaries | null;
  seed: string | null;
}

const sanitizeHeader = (header: string) => header.trim().replace(/^"|"$/g, '');

export const parseDashboardCsv = (content: string): ParsedDashboardCsv => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error('CSV file is empty.');
  }

  let headerColumns: string[] | null = null;
  const events: OutreachEvent[] = [];
  let summaries: DashboardSummaries | null = null;
  let seed: string | null = null;

  lines.forEach((line) => {
    if (line.startsWith('#')) {
      const payload = line.slice(1).trim();
      if (payload.startsWith('DASHBOARD_SUMMARY_JSON=')) {
        const json = payload.replace('DASHBOARD_SUMMARY_JSON=', '');
        try {
          summaries = JSON.parse(json) as DashboardSummaries;
        } catch (error) {
          throw new Error('Unable to parse dashboard summaries metadata.');
        }
      } else if (payload.startsWith('DATASET_SEED=')) {
        seed = payload.replace('DATASET_SEED=', '').trim();
      }
      return;
    }

    if (!headerColumns) {
      headerColumns = parseCsvLine(line).map(sanitizeHeader);
      const missing = CSV_COLUMNS.filter((column) => !headerColumns?.includes(column));
      if (missing.length > 0) {
        throw new Error(`Missing required columns: ${missing.join(', ')}`);
      }
      return;
    }

    const values = parseCsvLine(line);
    if (values.length === 0) {
      return;
    }

    const row: Partial<OutreachEvent> = {};
    headerColumns.forEach((header, index) => {
      const normalized = sanitizeHeader(header) as keyof OutreachEvent;
      if (!CSV_COLUMNS.includes(normalized)) {
        return;
      }

      const rawValue = (values[index] ?? '').trim();

      if (normalized === 'channel') {
        if (!VALID_CHANNELS.includes(rawValue as Channel)) {
          throw new Error(`Invalid channel value "${rawValue}" in CSV.`);
        }
        row[normalized] = rawValue as OutreachEvent[typeof normalized];
        return;
      }

      if (normalized === 'outcome') {
        if (!VALID_OUTCOMES.includes(rawValue as Outcome)) {
          throw new Error(`Invalid outcome value "${rawValue}" in CSV.`);
        }
        row[normalized] = rawValue as OutreachEvent[typeof normalized];
        return;
      }

      if (normalized === 'objection') {
        if (rawValue === '') {
          row[normalized] = null as OutreachEvent[typeof normalized];
          return;
        }

        if (!VALID_OBJECTIONS.includes(rawValue as NonNullable<OutreachEvent['objection']>)) {
          throw new Error(`Invalid objection value "${rawValue}" in CSV.`);
        }

        row[normalized] = rawValue as OutreachEvent[typeof normalized];
        return;
      }

      row[normalized] = rawValue as OutreachEvent[typeof normalized];
    });

    const hasAllRequired = CSV_COLUMNS.every((column) => {
      if (column === 'objection') {
        return column in row;
      }

      const value = row[column];
      return typeof value === 'string' && value.trim().length > 0;
    });
    if (!hasAllRequired) {
      throw new Error('One or more rows are missing required values.');
    }

    events.push(row as OutreachEvent);
  });

  if (!headerColumns) {
    throw new Error('CSV header row is missing.');
  }

  return { events, summaries, seed };
};

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';

export const buildDatasetFromEvents = (
  events: OutreachEvent[],
  seed = 'imported-dataset',
): GeneratedDataset => {
  const sdrMap = new Map<string, { id: string; name: string; team: string }>();
  const teamSet = new Set<string>();
  const industryMap = new Map<string, { name: string; quiet: boolean }>();
  const companyMap = new Map<string, { id: string; name: string; industry: string }>();

  events.forEach((event) => {
    if (event.team) {
      teamSet.add(event.team);
    }

    if (event.industry) {
      const key = event.industry.trim();
      if (!industryMap.has(key)) {
        industryMap.set(key, { name: key, quiet: false });
      }
    }

    if (event.company) {
      const key = event.company.trim();
      if (!companyMap.has(key)) {
        companyMap.set(key, { id: toSlug(key), name: key, industry: event.industry ?? 'Unknown' });
      }
    }

    const sdrId = event.sdr_id?.trim();
    const sdrName = event.sdr_name?.trim();
    if (sdrId || sdrName) {
      const id = sdrId || toSlug(sdrName ?? 'sdr');
      const name = sdrName || sdrId || 'Unknown SDR';
      const team = event.team || 'Unknown Team';
      if (!sdrMap.has(id)) {
        sdrMap.set(id, { id, name, team });
      }
    }
  });

  const teams = Array.from(teamSet).sort((a, b) => a.localeCompare(b));
  const sdrs = Array.from(sdrMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const industries = Array.from(industryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const companies = Array.from(companyMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  return {
    seed,
    events,
    sdrs,
    teams,
    industries,
    companies,
  };
};

export const prepareDatasetFromCsv = (
  content: string,
): { dataset: GeneratedDataset; summaries: DashboardSummaries | null } => {
  const { events, summaries, seed } = parseDashboardCsv(content);
  const dataset = buildDatasetFromEvents(events, seed ?? 'imported-dataset');
  const derivedEvents = deriveEvents(dataset.events);
  const nextSummaries = summaries ?? buildDashboardSummaries(derivedEvents, dataset);
  return { dataset, summaries: nextSummaries };
};
