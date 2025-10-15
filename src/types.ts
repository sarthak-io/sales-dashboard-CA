export type Channel = 'call' | 'email' | 'linkedin';

export type Outcome =
  | 'no_answer'
  | 'voicemail'
  | 'connected'
  | 'conversation'
  | 'meeting_booked'
  | 'meeting_held'
  | 'no_show'
  | 'qualified';

export interface OutreachEvent {
  event_id: string;
  lead_id: string;
  timestamp: string; // ISO 8601
  week_start: string; // ISO (Mon 00:00)
  sdr_id: string;
  sdr_name: string;
  team: string; // Team A|B|C
  company: string;
  industry: string;
  channel: Channel;
  outcome: Outcome;
  objection: 'budget' | 'timing' | 'authority' | 'need' | 'other' | null;
}
