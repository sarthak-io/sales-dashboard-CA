import { useMemo } from 'react';
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
import Header from './components/Header';
import KPIBar from './components/KPIBar';
import { bucketEventsByWeek } from './data/transforms';
import { useStore } from './store';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const formatWeekLabel = (isoWeekStart: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(isoWeekStart));

const App = () => {
  const filteredEvents = useStore((state) => state.filteredEvents);

  const chartData = useMemo(() => {
    const weeklyBuckets = bucketEventsByWeek(filteredEvents);
    const sortedWeeks = Object.keys(weeklyBuckets).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );

    const labels = sortedWeeks.map(formatWeekLabel);
    const dataPoints = sortedWeeks.map((week) =>
      weeklyBuckets[week].filter((event) => event.is_qualified).length,
    );

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
          fill: true,
        },
      ],
    };
  }, [filteredEvents]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom' as const,
        },
        title: {
          display: true,
          text: 'Pipeline Velocity',
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 5,
          },
        },
      },
    }),
    [],
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
        <KPIBar />

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-800">Weekly Performance Snapshot</h2>
            <p className="text-sm text-slate-500">Filtered qualified meetings by event week</p>
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
