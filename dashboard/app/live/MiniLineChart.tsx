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

type Props = {
  labels: string[];
  values: number[];
};

export default function MiniLineChart({ labels, values }: Props) {
  const hasData = values.some((v) => Number(v) > 0);

  const data = {
    labels,
    datasets: [
      {
        label: "",
        data: values,
        borderColor: hasData ? "rgba(31, 111, 120, 0.9)" : "rgba(31, 111, 120, 0.2)",
        backgroundColor: hasData ? "rgba(31, 111, 120, 0.2)" : "rgba(31, 111, 120, 0.05)",
        pointRadius: hasData ? 2 : 0,
        pointHoverRadius: 3,
        borderWidth: 3,
        fill: true,
        tension: 0.35
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
        display: true,
        beginAtZero: true,
        ticks: {
          maxTicksLimit: 3
        },
        grid: {
          color: "rgba(28, 38, 43, 0.08)"
        }
      }
    }
  };

  return (
    <div className="chart-canvas" style={{ minHeight: 140 }}>
      {hasData ? <Line data={data} options={options} /> : <div className="chart-empty">暂无数据</div>}
    </div>
  );
}
