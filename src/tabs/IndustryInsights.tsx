import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useStore } from '../store';
import type { DerivedEvent } from '../data/transforms';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface IndustryAggregate {
  industry: string;
  dials: number;
  connects: number;
  meetingsBooked: number;
  qualified: number;
  answerRate: number;
  meetingsPer100Dials: number;
}

const formatPercent = (value: number, fractionDigits = 1) => `${value.toFixed(fractionDigits)}%`;

const formatPerHundred = (value: number) => `${value.toFixed(1)}`;

const computeMedian = (values: number[]): number | null => {
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

const buildIndustryAggregates = (events: DerivedEvent[]): IndustryAggregate[] => {
  const grouped = new Map<
    string,
    {
      dials: number;
      connects: number;
      meetingLeadIds: Set<string>;
      qualifiedLeadIds: Set<string>;
    }
  >();

  events.forEach((event) => {
    if (!event.is_dial) {
      return;
    }

    const key = event.industry || 'Unknown';
    const entry = grouped.get(key);

    if (entry) {
      entry.dials += 1;
      if (event.is_connected) {
        entry.connects += 1;
      }
      if (event.is_meeting_booked) {
        entry.meetingLeadIds.add(event.lead_id);
      }
      if (event.is_qualified) {
        entry.qualifiedLeadIds.add(event.lead_id);
      }
    } else {
      grouped.set(key, {
        dials: 1,
        connects: event.is_connected ? 1 : 0,
        meetingLeadIds: event.is_meeting_booked ? new Set([event.lead_id]) : new Set(),
        qualifiedLeadIds: event.is_qualified ? new Set([event.lead_id]) : new Set(),
      });
    }
  });

  return Array.from(grouped.entries())
    .map(([industry, stats]) => {
      const meetingsBooked = stats.meetingLeadIds.size;
      const qualified = stats.qualifiedLeadIds.size;
      const answerRate = stats.dials === 0 ? 0 : stats.connects / stats.dials;
      const meetingsPer100Dials = stats.dials === 0 ? 0 : (meetingsBooked / stats.dials) * 100;

      return {
        industry,
        dials: stats.dials,
        connects: stats.connects,
        meetingsBooked,
        qualified,
        answerRate,
        meetingsPer100Dials,
      };
    })
    .filter((item) => item.dials > 0);
};

const IndustryInsights = () => {
  const filteredEvents = useStore((state) => state.filteredEvents);

  const { answerRateData, answerRateOptions, meetingData, meetingOptions, untappedTargets, medians } =
    useMemo(() => {
      const aggregates = buildIndustryAggregates(filteredEvents);

      if (aggregates.length === 0) {
        return {
          answerRateData: null,
          answerRateOptions: null,
          meetingData: null,
          meetingOptions: null,
          untappedTargets: [] as IndustryAggregate[],
          medians: { answerRate: null as number | null, meetingsPer100: null as number | null },
        };
      }

    const sorted = [...aggregates].sort((a, b) => b.answerRate - a.answerRate);

    const answerRateChartData = {
      labels: sorted.map((item) => item.industry),
      datasets: [
        {
          label: 'Answer Rate',
          data: sorted.map((item) => Number((item.answerRate * 100).toFixed(2))),
          backgroundColor: 'rgba(59, 130, 246, 0.75)',
          borderRadius: 6,
        },
      ],
    };

    const answerRateChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.parsed.y as number;
              return `${context.dataset.label}: ${value.toFixed(1)}%`;
            },
          },
        },
        title: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: (value: number | string) => `${value}%`,
          },
          grid: {
            drawBorder: false,
            color: 'rgba(148, 163, 184, 0.3)',
          },
        },
        x: {
          ticks: {
            maxRotation: 0,
            autoSkip: false,
          },
          grid: {
            display: false,
          },
        },
      },
    } as const;

    const meetingChartData = {
      labels: sorted.map((item) => item.industry),
      datasets: [
        {
          label: 'Meetings Booked',
          data: sorted.map((item) => item.meetingsBooked),
          backgroundColor: 'rgba(59, 130, 246, 0.75)',
          borderRadius: 6,
        },
        {
          label: 'Qualified',
          data: sorted.map((item) => item.qualified),
          backgroundColor: 'rgba(16, 185, 129, 0.65)',
          borderRadius: 6,
        },
      ],
    };

    const meetingChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
        },
        tooltip: {
          callbacks: {
            label: (context: any) => `${context.dataset.label}: ${context.parsed.y}`,
          },
        },
        title: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
          grid: {
            drawBorder: false,
            color: 'rgba(148, 163, 184, 0.3)',
          },
        },
        x: {
          stacked: false,
          grid: {
            display: false,
          },
          ticks: {
            maxRotation: 0,
            autoSkip: false,
          },
        },
      },
    } as const;

    const medianAnswerRate = computeMedian(sorted.map((item) => item.answerRate));
    const medianMeetingsPer100 = computeMedian(sorted.map((item) => item.meetingsPer100Dials));

    const untapped = sorted.filter((item) => {
      if (medianAnswerRate === null || medianMeetingsPer100 === null) {
        return false;
      }
      return item.answerRate > medianAnswerRate && item.meetingsPer100Dials < medianMeetingsPer100;
    });

    untapped.sort((a, b) => b.answerRate - a.answerRate);

    return {
      answerRateData: answerRateChartData,
      answerRateOptions: answerRateChartOptions,
      meetingData: meetingChartData,
      meetingOptions: meetingChartOptions,
      untappedTargets: untapped,
      medians: { answerRate: medianAnswerRate, meetingsPer100: medianMeetingsPer100 },
    };
  }, [filteredEvents]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-800">Industry Insights</h2>
        <p className="text-sm text-slate-500">
          Which industries are picking up the phone and where meetings are falling through.
        </p>
      </div>
      <div className="grid gap-6 p-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h3 className="mb-3 text-base font-semibold text-slate-800">Answer Rate by Industry</h3>
          <div className="h-72">
            {answerRateData && answerRateOptions ? (
              <Bar data={answerRateData} options={answerRateOptions} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
                Not enough dial data for the selected filters.
              </div>
            )}
          </div>
        </div>
        <div className="lg:col-span-2">
          <h3 className="mb-3 text-base font-semibold text-slate-800">Untapped Targets</h3>
          <div className="rounded-lg border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs uppercase tracking-wide text-slate-500">
              <span>Industry</span>
              <span>
                Above {medians.answerRate !== null ? formatPercent(medians.answerRate * 100) : 'median'} answer rate &amp;
                below {medians.meetingsPer100 !== null ? formatPerHundred(medians.meetingsPer100) : 'median'} meetings/100 dials
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {untappedTargets.length > 0 ? (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2 text-left font-semibold">Industry</th>
                      <th className="px-4 py-2 text-right font-semibold">Answer Rate</th>
                      <th className="px-4 py-2 text-right font-semibold">Meetings/100 Dials</th>
                    </tr>
                  </thead>
                  <tbody>
                    {untappedTargets.map((item) => (
                      <tr key={item.industry} className="border-t border-slate-100">
                        <td className="px-4 py-2 text-slate-700">{item.industry}</td>
                        <td className="px-4 py-2 text-right text-slate-700">
                          {formatPercent(item.answerRate * 100)}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-700">
                          {formatPerHundred(item.meetingsPer100Dials)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex h-48 items-center justify-center px-4 text-center text-sm text-slate-500">
                  No industries meet the opportunity criteria for the selected filters.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="lg:col-span-5">
          <h3 className="mb-3 text-base font-semibold text-slate-800">Meetings Booked vs Qualified</h3>
          <div className="h-80">
            {meetingData && meetingOptions ? (
              <Bar data={meetingData} options={meetingOptions} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
                Not enough dial data for the selected filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default IndustryInsights;
