"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

// Import dinámico para evitar error "window is not defined"
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

// Cliente Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

export default function DashboardSismos() {
  const [dataX, setDataX] = useState<number[]>([]);
  const [dataY, setDataY] = useState<number[]>([]);
  const [dataZ, setDataZ] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);

  // Coordenadas desde .env.local
  const lat = Number(process.env.NEXT_PUBLIC_UBIGEO_LAT);
  const lon = Number(process.env.NEXT_PUBLIC_UBIGEO_LON);

  useEffect(() => {
    const fetchInitial = async () => {
      const { data, error } = await supabase
        .from("sismos")
        .select("timestamp, axis_x, axis_y, axis_z")
        .order("timestamp", { ascending: true })
        .limit(50);

      if (!error && data) {
        setDataX(data.map((d) => d.axis_x));
        setDataY(data.map((d) => d.axis_y));
        setDataZ(data.map((d) => d.axis_z));
        setLabels(data.map((d) => new Date(d.timestamp).toLocaleTimeString()));
      }
    };

    fetchInitial();

    const channel = supabase
      .channel("sismos-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sismos" },
        (payload) => {
          const registro = payload.new;
          setDataX((prev) => [...prev.slice(-49), registro.axis_x]);
          setDataY((prev) => [...prev.slice(-49), registro.axis_y]);
          setDataZ((prev) => [...prev.slice(-49), registro.axis_z]);
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

  // Escala automática
  const allValues = [...dataX, ...dataY, ...dataZ];
  const minValue = Math.min(...allValues, -35);
  const maxValue = Math.max(...allValues, 35);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Eje X",
        data: dataX,
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.2)",
        tension: 0.3,
      },
      {
        label: "Eje Y",
        data: dataY,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34, 197, 94, 0.2)",
        tension: 0.3,
      },
      {
        label: "Eje Z",
        data: dataZ,
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
      y: {
        min: minValue - 1,
        max: maxValue + 1,
        title: { display: true, text: "Aceleración" },
      },
    },
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 space-y-8">
      <h1 className="text-3xl font-bold text-cyan-400">
        Dashboard Sísmico en Tiempo Real
      </h1>

      {/* Gráfico */}
      <div className="w-full max-w-3xl bg-gray-800 p-4 rounded-lg shadow-lg">
        <Line data={chartData} options={chartOptions} />
      </div>

      {/* Mapa */}
      <div className="w-full max-w-3xl h-96 bg-gray-800 p-4 rounded-lg shadow-lg">
        <MapContainer center={[lat, lon]} zoom={15} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[lat, lon]}>
            <Popup>
              <strong>Micro:bit Tacna</strong>
              <br />
              Ubicación: Tacna, Perú
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <p className="text-gray-400">Datos en tiempo real desde Supabase</p>
    </div>
  );
}
