import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';

const periods = [
  { key: '1h', label: 'Last 1 hour', ms: 60 * 60 * 1000, bucket: 1 },
  { key: '24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000, bucket: 10 },
  { key: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000, bucket: 60 },
];

const COLORS = {
  temperature: '#ef4444',
  humidity: '#3b82f6',
  light: '#f59e0b',
  weight: '#22c55e',
  battery: '#a855f7',
  soundPeakHz: '#0ea5e9',
  soundRms: '#f97316',
};

function formatTick(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatValue(value, unit = '') {
  return typeof value === 'number' ? `${Number(value.toFixed(2))}${unit}` : '—';
}

function SectionHeader({ title, subtitle }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <div className="text-sm text-muted mt-1">{subtitle}</div>}
    </div>
  );
}

function HistoryChartCard({ title, data, dataKey, color, unit = '', emptyLabel = 'No data yet' }) {
  const latest = [...data].reverse().find((row) => typeof row?.[dataKey] === 'number');
  const hasData = data.some((row) => typeof row?.[dataKey] === 'number');

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="font-semibold">{title}</div>
        <div className="text-sm font-semibold" style={{ color }}>{formatValue(latest?.[dataKey], unit)}</div>
      </div>
      <div className="h-56">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
              <XAxis dataKey="createdAt" tickFormatter={formatTick} minTickGap={24} />
              <YAxis />
              <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} formatter={(v) => formatValue(v, unit)} />
              <Line type="monotone" dataKey={dataKey} dot={false} strokeWidth={2.5} stroke={color} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}

function StatusIndicator({ title, active, activeText, idleText }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-muted">{title}</div>
      <div className={`text-lg font-semibold mt-2 ${active ? 'text-danger' : 'text-text'}`}>{active ? activeText : idleText}</div>
    </div>
  );
}

function EventLog({ events }) {
  if (!events.length) return <div className="text-sm text-muted">No hive events in this range.</div>;
  const ordered = [...events].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return (
    <div className="space-y-3">
      {ordered.map((evt) => (
        <div key={evt._id} className="flex items-start gap-3">
          <div className={`mt-1 w-2.5 h-2.5 rounded-full ${evt.severity === 'DANGER' ? 'bg-danger' : 'bg-warning'}`} />
          <div>
            <div className="text-sm font-medium">{new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {evt.message}</div>
            <div className="text-xs text-muted">{evt.type} • {evt.hiveId}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function History() {
  const [hives, setHives] = useState([]);
  const [selectedHive, setSelectedHive] = useState('');
  const [periodKey, setPeriodKey] = useState('24h');
  const [history, setHistory] = useState([]);
  const [events, setEvents] = useState([]);

  const period = useMemo(() => periods.find((p) => p.key === periodKey) || periods[1], [periodKey]);
  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date(Date.now() - period.ms);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [period]);

  useEffect(() => {
    async function init() {
      const res = await axios.get('/api/hives');
      setHives(res.data);
      if (!selectedHive && res.data.length) setSelectedHive(res.data[0].hiveId);
    }
    init();
  }, []);

  useEffect(() => {
    async function fetchHistory() {
      if (!selectedHive) return;
      const [hRes, histRes, evtRes] = await Promise.all([
        axios.get('/api/hives'),
        axios.get(`/api/history?hiveId=${encodeURIComponent(selectedHive)}&start=${encodeURIComponent(dateRange.start)}&end=${encodeURIComponent(dateRange.end)}&bucketMinutes=${period.bucket}`),
        axios.get(`/api/events?hiveId=${encodeURIComponent(selectedHive)}&start=${encodeURIComponent(dateRange.start)}&end=${encodeURIComponent(dateRange.end)}`),
      ]);
      setHives(hRes.data);
      setHistory(histRes.data);
      setEvents(evtRes.data);
    }
    fetchHistory();
  }, [selectedHive, periodKey]);

  const selectedHiveSummary = useMemo(() => hives.find((h) => h.hiveId === selectedHive) || null, [hives, selectedHive]);
  const latestPoint = history.length ? history[history.length - 1] : null;
  const indicators = latestPoint || selectedHiveSummary?.values || {};

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">History</h1>
          <div className="text-sm text-muted">Organized by environmental conditions, hive status, sound activity, and hive events.</div>
        </div>
        {selectedHive && <Link to={`/hives/${selectedHive}`} className="text-sm text-accent hover:underline">Open hive details →</Link>}
      </div>

      <div className="card p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex gap-2 items-center">
          <label className="text-sm text-muted">Hive</label>
          <select className="input w-56" value={selectedHive} onChange={(e) => setSelectedHive(e.target.value)}>
            {hives.map((h) => <option key={h.hiveId} value={h.hiveId}>{h.name || h.hiveId}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {periods.map((p) => <button key={p.key} className={`btn ${periodKey === p.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPeriodKey(p.key)}>{p.label}</button>)}
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader title="Environmental Conditions" subtitle="Temperature, humidity, and surrounding light level around the hive." />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <HistoryChartCard title="Temperature (°C)" data={history} dataKey="temperature" color={COLORS.temperature} unit="°C" />
          <HistoryChartCard title="Humidity (%)" data={history} dataKey="humidity" color={COLORS.humidity} unit="%" />
          <HistoryChartCard title="Light Level" data={history} dataKey="light" color={COLORS.light} />
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader title="Hive Status" subtitle="Core hive state indicators tied to colony condition and device readiness." />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <HistoryChartCard title="Weight (kg)" data={history} dataKey="weight" color={COLORS.weight} unit="kg" />
          <HistoryChartCard title="Battery (%)" data={history} dataKey="battery" color={COLORS.battery} unit="%" />
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader title="Hive Sound Activity" subtitle="Sound peak frequency and RMS activity inside the hive." />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <HistoryChartCard title="Sound Peak (Hz)" data={history} dataKey="soundPeakHz" color={COLORS.soundPeakHz} unit=" Hz" emptyLabel="No sound peak data yet" />
          <HistoryChartCard title="Sound RMS (relative)" data={history} dataKey="soundRms" color={COLORS.soundRms} emptyLabel="No sound RMS data yet" />
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader title="Hive Status Indicators" subtitle="Event-style indicators that are better shown as status cards than continuous curves." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusIndicator title="Rain" active={indicators.rain === 1} activeText="Detected 🌧" idleText="No" />
          <StatusIndicator title="Motion" active={indicators.motion === 1} activeText="Movement detected" idleText="No" />
          <StatusIndicator title="Flame" active={indicators.flame === 1} activeText="Fire detected 🔥" idleText="No" />
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader title="Hive Events" subtitle="Timeline of notable events detected for the selected period." />
        <div className="card p-4"><EventLog events={events} /></div>
      </div>
    </div>
  );
}
