import { useMemo } from 'react';
import type { Outcome, OutreachEvent } from './types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const QUALIFIED_OUTCOMES: Outcome[] = ['qualified', 'meeting_booked', 'meeting_held'];

const SAMPLE_OUTREACH_EVENTS: OutreachEvent[] = [
  {
    event_id: 'evt-2024-01-01-01',
    lead_id: 'lead-001',
    timestamp: '2024-01-02T15:30:00Z',
    week_start: '2024-01-01T00:00:00Z',
    sdr_id: 'sdr-001',
    sdr_name: 'Alex Johnson',
    team: 'Team A',
    company: 'Acme Corp',
    industry: 'SaaS',
    channel: 'call',
    outcome: 'qualified',
    objection: null
  },
  {
    event_id: 'evt-2024-01-08-01',
    lead_id: 'lead-002',
    timestamp: '2024-01-09T16:15:00Z',
    week_start: '2024-01-08T00:00:00Z',
    sdr_id: 'sdr-002',
    sdr_name: 'Priya Patel',
    team: 'Team B',
    company: 'Northwind Logistics',
    industry: 'Logistics',
    channel: 'email',
    outcome: 'conversation',
    objection: 'timing'
  },
  {
    event_id: 'evt-2024-01-08-02',
    lead_id: 'lead-003',
    timestamp: '2024-01-11T10:00:00Z',
    week_start: '2024-01-08T00:00:00Z',
    sdr_id: 'sdr-003',
    sdr_name: 'Jordan Lee',
    team: 'Team C',
    company: 'Bright Retail',
    industry: 'Retail',
    channel: 'linkedin',
    outcome: 'meeting_booked',
    objection: null
  },
  {
    event_id: 'evt-2024-01-15-01',
    lead_id: 'lead-004',
    timestamp: '2024-01-16T13:45:00Z',
    week_start: '2024-01-15T00:00:00Z',
    sdr_id: 'sdr-001',
    sdr_name: 'Alex Johnson',
    team: 'Team A',
    company: 'InnoTech',
    industry: 'SaaS',
    channel: 'call',
    outcome: 'meeting_held',
    objection: 'need'
  },
  {
    event_id: 'evt-2024-01-22-01',
    lead_id: 'lead-005',
    timestamp: '2024-01-22T17:05:00Z',
    week_start: '2024-01-22T00:00:00Z',
    sdr_id: 'sdr-002',
    sdr_name: 'Priya Patel',
    team: 'Team B',
    company: 'Globex Manufacturing',
    industry: 'Manufacturing',
    channel: 'email',
    outcome: 'qualified',
    objection: null
  },
  {
    event_id: 'evt-2024-01-29-01',
    lead_id: 'lead-006',
    timestamp: '2024-01-30T09:20:00Z',
    week_start: '2024-01-29T00:00:00Z',
    sdr_id: 'sdr-003',
    sdr_name: 'Jordan Lee',
    team: 'Team C',
    company: 'Evergreen Finance',
    industry: 'Financial Services',
    channel: 'linkedin',
    outcome: 'meeting_booked',
    objection: 'budget'
  },
  {
    event_id: 'evt-2024-02-05-01',
    lead_id: 'lead-007',
    timestamp: '2024-02-06T14:10:00Z',
    week_start: '2024-02-05T00:00:00Z',
    sdr_id: 'sdr-001',
    sdr_name: 'Alex Johnson',
    team: 'Team A',
    company: 'Vector Analytics',
    industry: 'Analytics',
    channel: 'call',
    outcome: 'conversation',
    objection: 'authority'
  },
  {
    event_id: 'evt-2024-02-12-01',
    lead_id: 'lead-008',
    timestamp: '2024-02-13T11:00:00Z',
    week_start: '2024-02-12T00:00:00Z',
    sdr_id: 'sdr-002',
    sdr_name: 'Priya Patel',
    team: 'Team B',
    company: 'Nimbus Cloud',
    industry: 'SaaS',
    channel: 'email',
    outcome: 'qualified',
    objection: null
  },
  {
    event_id: 'evt-2024-02-19-01',
    lead_id: 'lead-009',
    timestamp: '2024-02-20T18:20:00Z',
    week_start: '2024-02-19T00:00:00Z',
    sdr_id: 'sdr-003',
    sdr_name: 'Jordan Lee',
    team: 'Team C',
    company: 'Bluewater Energy',
    industry: 'Energy',
    channel: 'linkedin',
    outcome: 'no_show',
    objection: 'timing'
  },
  {
    event_id: 'evt-2024-02-26-01',
    lead_id: 'lead-010',
    timestamp: '2024-02-27T10:15:00Z',
    week_start: '2024-02-26T00:00:00Z',
    sdr_id: 'sdr-001',
    sdr_name: 'Alex Johnson',
    team: 'Team A',
    company: 'Zenith Health',
    industry: 'Healthcare',
    channel: 'call',
    outcome: 'qualified',
    objection: 'need'
  },
  {
    event_id: 'evt-2024-03-04-01',
    lead_id: 'lead-011',
    timestamp: '2024-03-05T16:55:00Z',
    week_start: '2024-03-04T00:00:00Z',
    sdr_id: 'sdr-002',
    sdr_name: 'Priya Patel',
    team: 'Team B',
    company: 'Orbit Security',
    industry: 'Cybersecurity',
    channel: 'email',
    outcome: 'meeting_booked',
    objection: null
  },
  {
    event_id: 'evt-2024-03-11-01',
    lead_id: 'lead-012',
    timestamp: '2024-03-11T12:40:00Z',
    week_start: '2024-03-11T00:00:00Z',
    sdr_id: 'sdr-003',
    sdr_name: 'Jordan Lee',
    team: 'Team C',
    company: 'Summit Education',
    industry: 'Education',
    channel: 'linkedin',
    outcome: 'qualified',
    objection: 'other'
  }
];

const formatWeekLabel = (isoWeekStart: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(isoWeekStart));

const App = () => {
  const chartData = useMemo(() => {
    const weeklyTotals = SAMPLE_OUTREACH_EVENTS.reduce<Record<string, number>>((acc, event) => {
      if (!acc[event.week_start]) {
        acc[event.week_start] = 0;
      }

      if (QUALIFIED_OUTCOMES.includes(event.outcome)) {
        acc[event.week_start] += 1;
      }

      return acc;
    }, {});

    const sortedWeeks = Object.keys(weeklyTotals).sort();
    const labels = sortedWeeks.map(formatWeekLabel);
    const dataPoints = sortedWeeks.map((week) => weeklyTotals[week]);

    return {
      labels,
      datasets: [
        {
          label: 'Qualified Meetings',
          data: dataPoints,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        }
      ]
    };
  }, []);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const
      },
      title: {
        display: true,
        text: 'Pipeline Velocity (Sample)'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 5
        }
      }
    }
  }), []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">SDR Analytics POC</p>
            <h1 className="text-xl font-semibold text-slate-800">Dashboard Shell</h1>
          </div>
          <nav className="hidden gap-4 text-sm font-medium text-slate-500 sm:flex">
            <span className="rounded-full bg-slate-100 px-3 py-1">Overview</span>
            <span className="px-3 py-1">Leads</span>
            <span className="px-3 py-1">Reports</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-800">Weekly Performance Snapshot</h2>
            <p className="text-sm text-slate-500">Sample line chart rendered via Chart.js</p>
          </div>
          <div className="h-80 px-2 py-4">
            <Line data={chartData} options={chartOptions} />
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-sm text-slate-500">
        Built with React, Vite, Tailwind CSS &amp; Chart.js
      </footer>
    </div>
  );
};

export default App;
