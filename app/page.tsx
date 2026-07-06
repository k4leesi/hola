"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

// Import dinámico con ssr: false
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

interface SismoRegistro {
  timestamp: string;
  axis_x: number;
  axis_y: number;
  axis_z: number;
  magnitude: number;
}

export default function DashboardSismos() {
  const [data, setData] = useState<SismoRegistro[]>([]);
  const [isClient, setIsClient] = useState(false);

  const lat = Number(process.env.NEXT_PUBLIC_UBIGEO_LAT);
  const lon = Number(process.env.NEXT_PUBLIC_UBIGEO_LON);

  useEffect(() => {
    setIsClient(true);

    const fetchLatest = async () => {
      const { data: registros, error } = await supabase
        .from("sismos")
        .select("timestamp, axis_x, axis_y, axis_z, magnitude")
        .order("timestamp", { ascending: false })
        .limit(200);

      if (!error && registros) {
        // invertimos para que queden en orden cronológico
        setData(registros.reverse() as SismoRegistro[]);
      }
    };

    // carga inicial
    fetchLatest();

    // refrescar cada 5 segundos
    const interval = setInterval(fetchLatest, 5000);

    return () => clearInterval(interval);
  }, []);

  const labels = data.map((d) =>
    new Date(d.timestamp).toLocaleTimeString()
  );
  const dataX = data.map((d) => d.axis_x);
  const dataY = data.map((d) => d.axis_y);
  const dataZ = data.map((d) => d.axis_z);
  const dataMagnitude = data.map((d) => d.magnitude);

  // Gráfico de aceleraciones
  const chartDataAxes = {
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

  const chartOptionsAxes = {
    responsive: true,
    animation: { duration: 0 },
    scales: {
      y: {
        title: { display: true, text: "Aceleración (mg)" },
      },
      x: {
        title: { display: true, text: "Tiempo" },
      },
    },
    plugins: {
      legend: { labels: { color: "#fff" } },
    },
  };

  // Gráfico de magnitud
  const chartDataMagnitude = {
    labels,
    datasets: [
      {
        label: "Magnitud simulada",
        data: dataMagnitude,
        borderColor: "#facc15",
        backgroundColor: "rgba(250, 204, 21, 0.2)",
        tension: 0.3,
      },
    ],
  };

  const chartOptionsMagnitude = {
    responsive: true,
    animation: { duration: 0 },
    scales: {
      y: {
        min: 0,
        max: 10,
        title: { display: true, text: "Magnitud (0–10)" },
      },
      x: {
        title: { display: true, text: "Tiempo" },
      },
    },
    plugins: {
      legend: { labels: { color: "#fff" } },
    },
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 space-y-8">
      <h1 className="text-3xl font-bold text-cyan-400">
        Dashboard Sísmico en Tiempo Real
      </h1>

      {/* Gráfico de aceleraciones */}
      <div className="w-full max-w-3xl bg-gray-800 p-4 rounded-lg shadow-lg">
        <Line data={chartDataAxes} options={chartOptionsAxes} />
      </div>

      {/* Gráfico de magnitud */}
      <div className="w-full max-w-3xl bg-gray-800 p-4 rounded-lg shadow-lg">
        <Line data={chartDataMagnitude} options={chartOptionsMagnitude} />
      </div>

      {/* Mapa */}

      <div className="w-full max-w-3xl h-96 bg-gray-800 p-4 rounded-lg shadow-lg">
        {isClient && lat && lon && (
          <MapContainer center={[lat, lon]} zoom={15} className="h-full w-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[lat, lon]}>
              <Popup>
                <strong>Micro:bit Tacna</strong>
                <br />
                Ubicación: Tacna, Perú
                <br />
                Por:  Kali
              </Popup>
            </Marker>
          </MapContainer>
        )}
      </div>

      <p className="text-gray-400">Últimos 200 datos refrescados cada 5 segundos desde Supabase</p>
    </div>
  );
}
