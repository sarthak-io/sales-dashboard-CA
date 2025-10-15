import { OutreachEvent } from '../types';

type RNG = () => number;

interface SDRProfile {
  id: string;
  name: string;
  team: string;
}

interface CompanyProfile {
  id: string;
  name: string;
  industry: string;
}

interface IndustryProfile {
  name: string;
  quiet: boolean;
}

export interface GeneratedDataset {
  seed: string;
  events: OutreachEvent[];
  sdrs: SDRProfile[];
  teams: string[];
  industries: IndustryProfile[];
  companies: CompanyProfile[];
}

const TEAM_NAMES = [
  'Outbound Alpha',
  'Pipeline Pros',
  'Growth Gurus',
  'Enterprise Edge',
  'Demand Drivers',
  'Revenue Rockets',
];

const FIRST_NAMES = [
  'Jordan',
  'Taylor',
  'Morgan',
  'Avery',
  'Riley',
  'Hayden',
  'Quinn',
  'Reese',
  'Drew',
  'Casey',
  'Peyton',
  'Blair',
  'Skyler',
  'Rowan',
  'Cameron',
];

const LAST_NAMES = [
  'Lee',
  'Patel',
  'Garcia',
  'Nguyen',
  'Johnson',
  'Davis',
  'Walker',
  'Clark',
  'Simmons',
  'Morgan',
  'Keller',
  'Bryant',
  'Foster',
  'Harper',
  'Shaw',
];

const INDUSTRY_POOL: IndustryProfile[] = [
  { name: 'SaaS', quiet: false },
  { name: 'Fintech', quiet: false },
  { name: 'Healthcare', quiet: false },
  { name: 'Manufacturing', quiet: true },
  { name: 'Logistics', quiet: true },
  { name: 'Retail', quiet: false },
  { name: 'Professional Services', quiet: false },
  { name: 'Energy', quiet: true },
  { name: 'Education', quiet: false },
  { name: 'Media', quiet: false },
  { name: 'Nonprofit', quiet: true },
];

const COMPANY_PREFIXES = [
  'North',
  'Blue',
  'Prime',
  'Next',
  'Bright',
  'Summit',
  'Pinnacle',
  'River',
  'Cedar',
  'Apex',
  'Vertex',
  'Horizon',
  'Synergy',
  'Fusion',
  'Echo',
];

const COMPANY_SUFFIXES = [
  'Labs',
  'Systems',
  'Partners',
  'Solutions',
  'Logistics',
  'Dynamics',
  'Networks',
  'Consulting',
  'Ventures',
  'Industries',
  'Holdings',
  'Collective',
  'Works',
  'Group',
  'Innovations',
];

const CHANNEL_WEIGHTS = [
  { item: 'call' as const, weight: 0.62 },
  { item: 'email' as const, weight: 0.28 },
  { item: 'linkedin' as const, weight: 0.1 },
];

const CALL_OUTCOME_WEIGHTS = [
  { outcome: 'no_answer' as const, weight: 0.27 },
  { outcome: 'voicemail' as const, weight: 0.22 },
  { outcome: 'connected' as const, weight: 0.16 },
  { outcome: 'conversation' as const, weight: 0.14 },
  { outcome: 'meeting_booked' as const, weight: 0.07 },
  { outcome: 'meeting_held' as const, weight: 0.03 },
  { outcome: 'no_show' as const, weight: 0.05 },
  { outcome: 'qualified' as const, weight: 0.06 },
];

const EMAIL_OUTCOME_WEIGHTS = [
  { outcome: 'no_answer' as const, weight: 0.48 },
  { outcome: 'voicemail' as const, weight: 0 },
  { outcome: 'connected' as const, weight: 0.1 },
  { outcome: 'conversation' as const, weight: 0.18 },
  { outcome: 'meeting_booked' as const, weight: 0.08 },
  { outcome: 'meeting_held' as const, weight: 0.02 },
  { outcome: 'no_show' as const, weight: 0.04 },
  { outcome: 'qualified' as const, weight: 0.1 },
];

const LINKEDIN_OUTCOME_WEIGHTS = [
  { outcome: 'no_answer' as const, weight: 0.22 },
  { outcome: 'voicemail' as const, weight: 0 },
  { outcome: 'connected' as const, weight: 0.23 },
  { outcome: 'conversation' as const, weight: 0.24 },
  { outcome: 'meeting_booked' as const, weight: 0.12 },
  { outcome: 'meeting_held' as const, weight: 0.06 },
  { outcome: 'no_show' as const, weight: 0.04 },
  { outcome: 'qualified' as const, weight: 0.09 },
];

const OBJECTION_WEIGHTS = [
  { value: 'timing' as const, weight: 0.42 },
  { value: 'budget' as const, weight: 0.32 },
  { value: 'authority' as const, weight: 0.1 },
  { value: 'need' as const, weight: 0.08 },
  { value: 'other' as const, weight: 0.08 },
];

function createRng(seedInput: string | number = 42): RNG {
  const seedString = seedInput.toString();
  const xmur3 = (str: string) => {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i += 1) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      const t = (h ^= h >>> 16) >>> 0;
      return t;
    };
  };

  const seed = xmur3(seedString);
  let a = seed();
  const mulberry32 = () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return mulberry32;
}

function pickWeighted<T>(rng: RNG, options: { item: T; weight: number }[]): T {
  const total = options.reduce((sum, opt) => sum + opt.weight, 0);
  const target = rng() * total;
  let cumulative = 0;
  for (const option of options) {
    cumulative += option.weight;
    if (target <= cumulative) {
      return option.item;
    }
  }
  return options[options.length - 1]?.item;
}

function shuffle<T>(rng: RNG, list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sample<T>(rng: RNG, list: T[]): T {
  return list[Math.floor(rng() * list.length)];
}

function createTeams(rng: RNG): string[] {
  const teamCount = 2 + Math.floor(rng() * 2); // 2 or 3 teams
  return shuffle(rng, TEAM_NAMES).slice(0, teamCount);
}

function createIndustries(rng: RNG): IndustryProfile[] {
  const count = 6 + Math.floor(rng() * 3); // 6-8 industries
  return shuffle(rng, INDUSTRY_POOL).slice(0, count);
}

function createSdrs(rng: RNG, teams: string[]): SDRProfile[] {
  const sdrCount = 10 + Math.floor(rng() * 6); // 10-15 SDRs
  const sdrs: SDRProfile[] = [];
  for (let i = 0; i < sdrCount; i += 1) {
    const name = `${sample(rng, FIRST_NAMES)} ${sample(rng, LAST_NAMES)}`;
    const team = teams[Math.floor(rng() * teams.length)];
    sdrs.push({
      id: `sdr_${i + 1}`,
      name,
      team,
    });
  }
  return sdrs;
}

function createCompanies(rng: RNG, industries: IndustryProfile[]): CompanyProfile[] {
  const companies: CompanyProfile[] = [];
  industries.forEach((industry, index) => {
    const perIndustry = 6 + Math.floor(rng() * 5); // 6-10 companies per industry
    for (let i = 0; i < perIndustry; i += 1) {
      const name = `${sample(rng, COMPANY_PREFIXES)} ${sample(rng, COMPANY_SUFFIXES)}`;
      companies.push({
        id: `co_${index + 1}_${i + 1}`,
        name: `${name} ${industry.name}`,
        industry: industry.name,
      });
    }
  });
  return companies;
}

function getOutcomeWeights(channel: 'call' | 'email' | 'linkedin') {
  switch (channel) {
    case 'call':
      return CALL_OUTCOME_WEIGHTS;
    case 'email':
      return EMAIL_OUTCOME_WEIGHTS;
    case 'linkedin':
      return LINKEDIN_OUTCOME_WEIGHTS;
    default:
      return CALL_OUTCOME_WEIGHTS;
  }
}

function adjustOutcomeForIndustry(
  industry: IndustryProfile,
  baseWeights: { outcome: OutreachEvent['outcome']; weight: number }[],
) {
  if (!industry.quiet) {
    return baseWeights;
  }
  return baseWeights.map((entry) => {
    if (entry.outcome === 'meeting_booked' || entry.outcome === 'meeting_held') {
      return { ...entry, weight: entry.weight * 0.6 };
    }
    if (entry.outcome === 'connected' || entry.outcome === 'conversation') {
      return { ...entry, weight: entry.weight * 1.2 };
    }
    return entry;
  });
}

function normalizeWeights<T>(weights: { outcome: T; weight: number }[]) {
  const total = weights.reduce((sum, option) => sum + option.weight, 0);
  return weights.map((option) => ({ ...option, weight: option.weight / (total || 1) }));
}

function randomInt(rng: RNG, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function createEventTimestamp(
  rng: RNG,
  dateOptions: Date[],
  outcome: OutreachEvent['outcome'],
  selectedDay: Date,
): Date {
  const isMeetingOutcome =
    outcome === 'meeting_booked' || outcome === 'meeting_held' || outcome === 'qualified';
  if (isMeetingOutcome) {
    const preferredDays = dateOptions.filter((date) => {
      const day = date.getUTCDay();
      return day >= 2 && day <= 4; // Tue-Thu
    });
    const selectedDayIsPreferred = (() => {
      const day = selectedDay.getUTCDay();
      return day >= 2 && day <= 4;
    })();
    const usePreferred = !selectedDayIsPreferred && preferredDays.length > 0 && rng() < 0.7;
    const chosenDay = usePreferred
      ? preferredDays[Math.floor(rng() * preferredDays.length)]
      : selectedDay;
    const base = new Date(chosenDay);
    const hour = randomInt(rng, 10, 16);
    const minute = randomInt(rng, 0, 59);
    base.setUTCHours(hour, minute, Math.floor(rng() * 60));
    return base;
  }
  const base = new Date(selectedDay);
  const hour = randomInt(rng, 8, 18);
  const minute = randomInt(rng, 0, 59);
  base.setUTCHours(hour, minute, Math.floor(rng() * 60));
  return base;
}

function startOfWeek(date: Date): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay();
  const diff = (day + 6) % 7; // convert Sunday=0 to Monday-based index
  result.setUTCDate(result.getUTCDate() - diff);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function formatIso(date: Date): string {
  return date.toISOString();
}

function formatWeekStart(date: Date): string {
  return startOfWeek(date).toISOString();
}

function shouldAddObjection(rng: RNG, outcome: OutreachEvent['outcome']) {
  if (outcome === 'conversation' || outcome === 'meeting_booked' || outcome === 'meeting_held') {
    return rng() < 0.45;
  }
  if (outcome === 'qualified') {
    return rng() < 0.25;
  }
  return false;
}

function buildDateRange(rng: RNG): Date[] {
  const totalDays = 14 + Math.floor(rng() * 8); // 14-21 days
  const start = new Date(Date.UTC(2024, 0, 8)); // fixed Monday anchor (Jan 8 2024)
  const offset = randomInt(rng, 0, 14);
  start.setUTCDate(start.getUTCDate() + offset);
  const dates: Date[] = [];
  for (let i = 0; i < totalDays; i += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + i);
    current.setUTCHours(0, 0, 0, 0);
    dates.push(current);
  }
  return dates;
}

function buildDayWeights(dates: Date[]): number[] {
  return dates.map((date) => {
    const day = date.getUTCDay();
    if (day >= 1 && day <= 4) {
      return 1.15; // Mon-Thu busier
    }
    if (day === 5) {
      return 0.9; // Friday slightly quieter
    }
    return 0.65; // Weekend quieter
  });
}

export function generateDataset(seed: string | number = 42): GeneratedDataset {
  const rng = createRng(seed);
  const teams = createTeams(rng);
  const industries = createIndustries(rng);
  const companies = createCompanies(rng, industries);
  const sdrs = createSdrs(rng, teams);
  const dates = buildDateRange(rng);
  const dayWeights = buildDayWeights(dates);
  const companiesByIndustry = new Map<string, CompanyProfile[]>();
  companies.forEach((company) => {
    const current = companiesByIndustry.get(company.industry) ?? [];
    current.push(company);
    companiesByIndustry.set(company.industry, current);
  });

  const totalEvents = randomInt(rng, 2000, 3000);
  const dayWeightSum = dayWeights.reduce((sum, weight) => sum + weight, 0);
  const events: OutreachEvent[] = [];

  for (let i = 0; i < totalEvents; i += 1) {
    const dayTarget = rng() * dayWeightSum;
    let cumulative = 0;
    let selectedDay = dates[0];
    for (let d = 0; d < dates.length; d += 1) {
      cumulative += dayWeights[d];
      if (dayTarget <= cumulative) {
        selectedDay = dates[d];
        break;
      }
    }

    const sdr = sdrs[Math.floor(rng() * sdrs.length)];
    const industry = industries[Math.floor(rng() * industries.length)];
    const companyChoices = companiesByIndustry.get(industry.name) ?? companies;
    const company = companyChoices[Math.floor(rng() * companyChoices.length)];

    const channel = pickWeighted(rng, CHANNEL_WEIGHTS);
    const industryAdjusted = adjustOutcomeForIndustry(industry, getOutcomeWeights(channel));
    const normalized = normalizeWeights(industryAdjusted).map((option) => ({
      item: option.outcome,
      weight: option.weight,
    }));
    const outcome = pickWeighted(rng, normalized);

    const timestamp = createEventTimestamp(rng, dates, outcome, selectedDay);

    const addObjection = shouldAddObjection(rng, outcome);
    const objection = addObjection ? pickWeighted(rng, OBJECTION_WEIGHTS.map((o) => ({
      item: o.value,
      weight: o.weight,
    }))) : null;

    const eventId = `evt_${(i + 1).toString().padStart(5, '0')}`;
    const leadId = `lead_${Math.floor(rng() * 900000 + 100000)}`;

    events.push({
      event_id: eventId,
      lead_id: leadId,
      timestamp: formatIso(timestamp),
      week_start: formatWeekStart(timestamp),
      sdr_id: sdr.id,
      sdr_name: sdr.name,
      team: sdr.team,
      company: company.name,
      industry: industry.name,
      channel,
      outcome,
      objection,
    });
  }

  return {
    seed: seed.toString(),
    events,
    sdrs,
    teams,
    industries,
    companies,
  };
}

