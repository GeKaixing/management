"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler
} from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

export default function MiniLineChart({ labels, values }) {
  const data = {
    labels,
    datasets: [
      {
        label: "",
        data: values,
        borderColor: "rgba(31, 111, 120, 0.9)",
        backgroundColor: "rgba(31, 111, 120, 0.15)",
        pointRadius: 0,
        borderWidth: 2,
        fill: true,
        tension: 0.3
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    scales: {
      x: {
        display: false
      },
      y: {
        display: false,
        beginAtZero: true
      }
    }
  };

  return (
    <div className="chart-canvas">
      <Line data={data} options={options} />
    </div>
  );
}