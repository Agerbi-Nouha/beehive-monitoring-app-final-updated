import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { MapPin, Download, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const ranges = [
  { key: '1h', label: '1H', ms: 60 * 60 * 1000, bucket: 1 },
  { key: '24h', label: '24H', ms: 24 * 60 * 60 * 1000, bucket: 10 },
  { key: '7d', label: '7D', ms: 7 * 24 * 60 * 60 * 1000, bucket: 60 },
];

const COLORS = {
  temperature: '#ef4444',
  humidity: '#3b82f6',
  weight: '#22c55e',
  battery: '#a855f7',
  light: '#f59e0b',
  soundPeakHz: '#0ea5e9',
  soundRms: '#f97316',
};

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatValue(value, unit = '') {
  return typeof value === 'number' ? `${Number(value.toFixed(2))}${unit}` : '—';
}

export default function HiveDetails() {
  const { hiveId } = useParams();
  const { isAdmin } = useAuth();
  const [meta, setMeta] = useState(null);
  const [last, setLast] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [rangeKey, setRangeKey] = useState('24h');

  const range = useMemo(() => ranges.find((r) => r.key === rangeKey) || ranges[1], [rangeKey]);
  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date(Date.now() - range.ms);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [range]);

  async function fetchAll() {
    const [hRes, histRes, aRes] = await Promise.all([
      axios.get(`/api/hives/${hiveId}`),
      axios.get(`/api/history?hiveId=${encodeURIComponent(hiveId)}&start=${encodeURIComponent(dateRange.start)}&end=${encodeURIComponent(dateRange.end)}&bucketMinutes=${range.bucket}`),
      axios.get(`/api/events?hiveId=${encodeURIComponent(hiveId)}&status=Active`),
    ]);
    setMeta(hRes.data.hive);
    setLast(hRes.data.lastMeasurement);
    setHistory(histRes.data);
    setActiveAlerts(aRes.data);
  }

  useEffect(() => {
    fetchAll();
  }, [hiveId, rangeKey]);

  async function resolveAlert(id) {
    await axios.patch(`/api/events/${id}/resolve`);
    await fetchAll();
  }

  const location = meta?.lat != null && meta?.lng != null ? { lat: meta.lat, lng: meta.lng } : last?.lat != null && last?.lng != null ? { lat: last.lat, lng: last.lng } : null;
  const mapsLink = location ? `https://www.google.com/maps?q=${location.lat},${location.lng}` : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted"><Link className="text-accent hover:underline" to="/hives">Hives</Link> / {hiveId}</div>
          <h1 className="text-2xl font-semibold">{meta?.name || hiveId}</h1>
          {meta?.notes && <div className="text-sm text-muted">{meta.notes}</div>}
        </div>
        <div className="flex items-center gap-2">
          {mapsLink && <a className="btn btn-ghost" href={mapsLink} target="_blank" rel="noreferrer"><MapPin size={16} className="mr-1" /> Map</a>}
          <Link className="btn btn-ghost" to={`/export?hiveId=${encodeURIComponent(hiveId)}`}><Download size={16} className="mr-1" /> Export</Link>
        </div>
      </div>

      <div className="flex gap-2">
        {ranges.map((r) => <button key={r.key} className={`btn ${rangeKey === r.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRangeKey(r.key)}>{r.label}</button>)}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <Metric title="Temp (°C)" value={last?.temperature} />
        <Metric title="Humidity (%)" value={last?.humidity} />
        <Metric title="Weight (kg)" value={last?.weight} />
        <Metric title="Battery (%)" value={last?.battery} />
        <Metric title="Light Level" value={last?.light} />
        <Metric title="Sound Peak (Hz)" value={last?.soundPeakHz} />
        <Metric title="Sound RMS" value={last?.soundRms} />
        <Metric title="Motion" value={last?.motion} suffix={last?.motion === 1 ? 'Detected' : 'OK'} />
        <Metric title="Rain" value={last?.rain} suffix={last?.rain === 1 ? 'Detected' : 'No'} />
        <Metric title="Flame" value={last?.flame} suffix={last?.flame === 1 ? 'Detected' : 'No'} />
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between"><div className="font-semibold">Active Alerts</div><div className="text-sm text-muted">{activeAlerts.length}</div></div>
        <div className="mt-3 space-y-2">
          {activeAlerts.length === 0 ? <div className="text-sm text-muted">No active alerts.</div> : activeAlerts.map((a) => (
            <div key={a._id} className="flex items-start justify-between gap-3 border border-border rounded-lg p-3">
              <div>
                <div className="text-sm font-medium"><span className={`badge ${a.severity === 'DANGER' ? 'bg-danger text-white' : 'bg-warning text-white'} mr-2`}>{a.severity}</span>{a.type}</div>
                <div className="text-sm text-muted">{a.message}</div>
                <div className="text-xs text-muted mt-1">{new Date(a.createdAt).toLocaleString()}</div>
              </div>
              {isAdmin && <button className="btn btn-ghost" onClick={() => resolveAlert(a._id)} title="Resolve"><CheckCircle size={16} /></button>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Temperature (°C)" data={history} dataKey="temperature" color={COLORS.temperature} unit="°C" />
        <ChartCard title="Humidity (%)" data={history} dataKey="humidity" color={COLORS.humidity} unit="%" />
        <ChartCard title="Weight (kg)" data={history} dataKey="weight" color={COLORS.weight} unit="kg" />
        <ChartCard title="Battery (%)" data={history} dataKey="battery" color={COLORS.battery} unit="%" />
        <ChartCard title="Light Level" data={history} dataKey="light" color={COLORS.light} />
        <ChartCard title="Sound Peak (Hz)" data={history} dataKey="soundPeakHz" color={COLORS.soundPeakHz} unit=" Hz" emptyLabel="No sound peak data yet" />
        <ChartCard title="Sound RMS (relative)" data={history} dataKey="soundRms" color={COLORS.soundRms} emptyLabel="No sound RMS data yet" />
      </div>
    </div>
  );
}

function Metric({ title, value, suffix }) {
  return <div className="card p-4"><div className="text-xs text-muted">{title}</div><div className="text-xl font-bold mt-1">{value ?? '—'}</div>{suffix && <div className="text-xs text-muted mt-1">{suffix}</div>}</div>;
}

function ChartCard({ title, data, dataKey, color, unit = '', emptyLabel = 'No data yet' }) {
  const latest = [...data].reverse().find((row) => typeof row?.[dataKey] === 'number');
  const hasData = data.some((row) => typeof row?.[dataKey] === 'number');
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2"><div className="font-semibold">{title}</div><div className="text-sm font-semibold" style={{ color }}>{formatValue(latest?.[dataKey], unit)}</div></div>
      <div className="h-56">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="createdAt" tickFormatter={formatTime} minTickGap={24} /><YAxis /><Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} formatter={(v) => formatValue(v, unit)} /><Line type="monotone" dataKey={dataKey} dot={false} stroke={color} strokeWidth={2.5} /></LineChart></ResponsiveContainer>
        ) : <div className="h-full flex items-center justify-center text-sm text-muted">{emptyLabel}</div>}
      </div>
    </div>
  );
}
