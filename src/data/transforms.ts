import type { Outcome, OutreachEvent } from '../types';

export interface DerivedEvent extends OutreachEvent {
  is_connected: boolean;
  is_conversation: boolean;
  is_meeting_booked: boolean;
  is_meeting_held: boolean;
  is_qualified: boolean;
  is_no_show: boolean;
  is_dial: boolean;
  is_first_contact: boolean;
  time_to_meeting_days: number | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const OUTCOME_FLAG_MAP: Record<Outcome, Omit<DerivedEvent, keyof OutreachEvent | 'is_first_contact' | 'time_to_meeting_days'>> = {
  no_answer: {
    is_connected: false,
    is_conversation: false,
    is_meeting_booked: false,
    is_meeting_held: false,
    is_qualified: false,
    is_no_show: false,
    is_dial: true,
  },
  voicemail: {
    is_connected: false,
    is_conversation: false,
    is_meeting_booked: false,
    is_meeting_held: false,
    is_qualified: false,
    is_no_show: false,
    is_dial: true,
  },
  connected: {
    is_connected: true,
    is_conversation: false,
    is_meeting_booked: false,
    is_meeting_held: false,
    is_qualified: false,
    is_no_show: false,
    is_dial: true,
  },
  conversation: {
    is_connected: true,
    is_conversation: true,
    is_meeting_booked: false,
    is_meeting_held: false,
    is_qualified: false,
    is_no_show: false,
    is_dial: true,
  },
  meeting_booked: {
    is_connected: true,
    is_conversation: true,
    is_meeting_booked: true,
    is_meeting_held: false,
    is_qualified: false,
    is_no_show: false,
    is_dial: true,
  },
  meeting_held: {
    is_connected: true,
    is_conversation: true,
    is_meeting_booked: true,
    is_meeting_held: true,
    is_qualified: false,
    is_no_show: false,
    is_dial: true,
  },
  no_show: {
    is_connected: true,
    is_conversation: true,
    is_meeting_booked: true,
    is_meeting_held: false,
    is_qualified: false,
    is_no_show: true,
    is_dial: true,
  },
  qualified: {
    is_connected: true,
    is_conversation: true,
    is_meeting_booked: true,
    is_meeting_held: true,
    is_qualified: true,
    is_no_show: false,
    is_dial: true,
  },
};

export const deriveOutcomeFlags = (event: OutreachEvent) => {
  const flags = OUTCOME_FLAG_MAP[event.outcome];
  return {
    ...flags,
    is_dial: event.channel === 'call',
  };
};

export const deriveEvents = (events: OutreachEvent[]): DerivedEvent[] => {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const firstContactEventIdByLead = new Map<string, string>();
  const firstContactTimeByLead = new Map<string, number>();
  const firstMeetingEventIdByLead = new Map<string, string>();
  const firstMeetingTimeByLead = new Map<string, number>();

  sortedEvents.forEach((event) => {
    const lead = event.lead_id;
    const eventTime = new Date(event.timestamp).getTime();

    if (!firstContactEventIdByLead.has(lead)) {
      firstContactEventIdByLead.set(lead, event.event_id);
      firstContactTimeByLead.set(lead, eventTime);
    }

    const flags = deriveOutcomeFlags(event);
    const isMeetingOutcome = flags.is_meeting_booked || flags.is_meeting_held || flags.is_qualified;

    if (isMeetingOutcome && !firstMeetingEventIdByLead.has(lead)) {
      firstMeetingEventIdByLead.set(lead, event.event_id);
      firstMeetingTimeByLead.set(lead, eventTime);
    }
  });

  return events.map((event) => {
    const flags = deriveOutcomeFlags(event);
    const lead = event.lead_id;
    const firstContactId = firstContactEventIdByLead.get(lead) ?? null;
    const firstContactTime = firstContactTimeByLead.get(lead) ?? null;
    const firstMeetingEventId = firstMeetingEventIdByLead.get(lead) ?? null;
    const firstMeetingTime = firstMeetingTimeByLead.get(lead) ?? null;

    const isFirstContact = firstContactId === event.event_id;
    const isFirstMeeting = firstMeetingEventId === event.event_id;

    let timeToMeeting: number | null = null;
    if (isFirstMeeting && firstContactTime !== null && firstMeetingTime !== null) {
      timeToMeeting = (firstMeetingTime - firstContactTime) / MS_PER_DAY;
    }

    return {
      ...event,
      ...flags,
      is_first_contact: isFirstContact,
      time_to_meeting_days: timeToMeeting,
      // Ensure dial flag only true for call channel
      is_dial: event.channel === 'call',
    };
  });
};

export const bucketEventsByWeek = (events: DerivedEvent[]) =>
  events.reduce<Record<string, DerivedEvent[]>>((acc, event) => {
    if (!acc[event.week_start]) {
      acc[event.week_start] = [];
    }
    acc[event.week_start].push(event);
    return acc;
  }, {});

export interface RateSummary {
  numerator: number;
  denominator: number;
  rate: number | null;
}

const calculateRate = (numerator: number, denominator: number): RateSummary => ({
  numerator,
  denominator,
  rate: denominator === 0 ? null : numerator / denominator,
});

export const computeDialToConnectRate = (events: DerivedEvent[]): RateSummary => {
  const denominator = events.filter((event) => event.is_dial).length;
  const numerator = events.filter((event) => event.is_dial && event.is_connected).length;
  return calculateRate(numerator, denominator);
};

export const computeConnectToConversationRate = (events: DerivedEvent[]): RateSummary => {
  const denominator = events.filter((event) => event.is_connected).length;
  const numerator = events.filter((event) => event.is_conversation).length;
  return calculateRate(numerator, denominator);
};

export const computeMeetingToQualifiedRate = (events: DerivedEvent[]): RateSummary => {
  const denominator = events.filter((event) => event.is_meeting_held).length;
  const numerator = events.filter((event) => event.is_qualified).length;
  return calculateRate(numerator, denominator);
};

export const computeNoShowRate = (events: DerivedEvent[]): RateSummary => {
  const denominator = events.filter((event) => event.is_meeting_booked).length;
  const numerator = events.filter((event) => event.is_no_show).length;
  return calculateRate(numerator, denominator);
};

export interface IndustryAnswerRate extends RateSummary {
  industry: string;
}

export const computeIndustryAnswerRates = (events: DerivedEvent[]): IndustryAnswerRate[] => {
  const grouped = events.reduce<Record<string, { dials: number; connects: number }>>((acc, event) => {
    if (!acc[event.industry]) {
      acc[event.industry] = { dials: 0, connects: 0 };
    }

    if (event.is_dial) {
      acc[event.industry].dials += 1;
      if (event.is_connected) {
        acc[event.industry].connects += 1;
      }
    }

    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([industry, { dials, connects }]) => ({
      industry,
      ...calculateRate(connects, dials),
    }))
    .sort((a, b) => a.industry.localeCompare(b.industry));
};

export const TRANSFORM_TEST_EVENTS: OutreachEvent[] = [
  {
    event_id: 'evt-1',
    lead_id: 'lead-1',
    timestamp: '2024-01-02T10:00:00Z',
    week_start: '2024-01-01T00:00:00Z',
    sdr_id: 'sdr-1',
    sdr_name: 'Jordan Lee',
    team: 'Outbound',
    company: 'Acme',
    industry: 'SaaS',
    channel: 'call',
    outcome: 'connected',
    objection: null,
  },
  {
    event_id: 'evt-2',
    lead_id: 'lead-2',
    timestamp: '2024-01-02T11:00:00Z',
    week_start: '2024-01-01T00:00:00Z',
    sdr_id: 'sdr-2',
    sdr_name: 'Dev Patel',
    team: 'Outbound',
    company: 'Northwind',
    industry: 'SaaS',
    channel: 'call',
    outcome: 'conversation',
    objection: null,
  },
  {
    event_id: 'evt-3',
    lead_id: 'lead-3',
    timestamp: '2024-01-03T09:30:00Z',
    week_start: '2024-01-01T00:00:00Z',
    sdr_id: 'sdr-3',
    sdr_name: 'Alex Smith',
    team: 'Outbound',
    company: 'Globex',
    industry: 'SaaS',
    channel: 'call',
    outcome: 'no_answer',
    objection: null,
  },
  {
    event_id: 'evt-4',
    lead_id: 'lead-4',
    timestamp: '2024-01-03T15:00:00Z',
    week_start: '2024-01-01T00:00:00Z',
    sdr_id: 'sdr-4',
    sdr_name: 'Morgan Yu',
    team: 'Outbound',
    company: 'FinCorp',
    industry: 'Fintech',
    channel: 'call',
    outcome: 'no_answer',
    objection: null,
  },
  {
    event_id: 'evt-5',
    lead_id: 'lead-4',
    timestamp: '2024-01-05T16:00:00Z',
    week_start: '2024-01-08T00:00:00Z',
    sdr_id: 'sdr-4',
    sdr_name: 'Morgan Yu',
    team: 'Outbound',
    company: 'FinCorp',
    industry: 'Fintech',
    channel: 'call',
    outcome: 'meeting_booked',
    objection: null,
  },
  {
    event_id: 'evt-6',
    lead_id: 'lead-5',
    timestamp: '2024-01-09T13:00:00Z',
    week_start: '2024-01-08T00:00:00Z',
    sdr_id: 'sdr-5',
    sdr_name: 'Taylor Brooks',
    team: 'Outbound',
    company: 'FinCorp',
    industry: 'Fintech',
    channel: 'call',
    outcome: 'meeting_held',
    objection: null,
  },
  {
    event_id: 'evt-7',
    lead_id: 'lead-6',
    timestamp: '2024-01-09T14:00:00Z',
    week_start: '2024-01-08T00:00:00Z',
    sdr_id: 'sdr-6',
    sdr_name: 'Taylor Brooks',
    team: 'Outbound',
    company: 'FinCorp',
    industry: 'Fintech',
    channel: 'call',
    outcome: 'no_show',
    objection: 'timing',
  },
  {
    event_id: 'evt-8',
    lead_id: 'lead-7',
    timestamp: '2024-01-10T10:30:00Z',
    week_start: '2024-01-08T00:00:00Z',
    sdr_id: 'sdr-7',
    sdr_name: 'Sky Harper',
    team: 'Outbound',
    company: 'HealthPlus',
    industry: 'Healthcare',
    channel: 'call',
    outcome: 'qualified',
    objection: null,
  },
];

export const logTransformTestSnippet = () => {
  const derived = deriveEvents(TRANSFORM_TEST_EVENTS);
  const dialToConnect = computeDialToConnectRate(derived);
  const connectToConversation = computeConnectToConversationRate(derived);
  const meetingToQualified = computeMeetingToQualifiedRate(derived);
  const noShow = computeNoShowRate(derived);
  const industryRates = computeIndustryAnswerRates(derived);

  // eslint-disable-next-line no-console
  console.log('Dial→Connect', dialToConnect);
  // eslint-disable-next-line no-console
  console.log('Connect→Conversation', connectToConversation);
  // eslint-disable-next-line no-console
  console.log('Meeting→Qualified', meetingToQualified);
  // eslint-disable-next-line no-console
  console.log('No-Show', noShow);
  // eslint-disable-next-line no-console
  console.log('Industry Answer Rate', industryRates);

  return {
    dialToConnect,
    connectToConversation,
    meetingToQualified,
    noShow,
    industryRates,
  };
};
