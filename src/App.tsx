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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const SAMPLE_DATA_POINTS = 12;

const App = () => {
  const chartData = useMemo(() => {
    const labels = Array.from({ length: SAMPLE_DATA_POINTS }, (_, index) => `Week ${index + 1}`);
    const dataPoints = labels.map((_, index) => 20 + Math.round(Math.sin(index / 2) * 8 + index * 1.5));

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
