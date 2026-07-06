// app/page.tsx (Next.js 13+ con App Router)
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

// Inicializa cliente Supabase con variables de entorno
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

export default function Sismografo() {
  const [dataPoints, setDataPoints] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    // 1. Cargar datos iniciales
    const fetchInitial = async () => {
      const { data, error } = await supabase
        .from("sismos")
        .select("timestamp, axis_z")
        .order("timestamp", { ascending: true })
        .limit(50);

      if (!error && data) {
        setDataPoints(data.map((d) => d.axis_z));
        setLabels(data.map((d) => new Date(d.timestamp).toLocaleTimeString()));
      }
    };

    fetchInitial();

    // 2. Suscripción en tiempo real
    const channel = supabase
      .channel("sismos-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sismos" },
        (payload) => {
          const registro = payload.new;
          setDataPoints((prev) => [...prev.slice(-49), registro.axis_z]);
          setLabels((prev) => [
            ...prev.slice(-49),
            new Date(registro.timestamp).toLocaleTimeString(),
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Datos para Chart.js
  const chartData = {
    labels,
    datasets: [
      {
        label: "Sismograma (eje Z)",
        data: dataPoints,
        borderColor: "#22d3ee",
        backgroundColor: "rgba(34, 211, 238, 0.2)",
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    animation: { duration: 0 },
    scales: {
      x: { title: { display: true, text: "Tiempo" } },
      y: {
        title: { display: true, text: "Aceleración" },
        beginAtZero: false, // no fuerza a empezar en 0
        suggestedMin: -12,  // rango sugerido mínimo
        suggestedMax: 15    // rango sugerido máximo
      },
    },
  };
  

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold text-cyan-400 mb-6">
        Simulador de Sismógrafo
      </h1>
      <div className="w-full max-w-3xl bg-gray-800 p-4 rounded-lg shadow-lg">
        <Line data={chartData} options={chartOptions} />
      </div>
      <p className="text-gray-400 mt-4">
        Datos en tiempo real desde Supabase
      </p>
    </div>
  );
}
