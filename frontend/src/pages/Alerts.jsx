import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CheckCircle, Check, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const CATEGORY_ORDER = ['Environmental alerts', 'Hive health alerts', 'Danger alerts', 'Other alerts'];

function getCategory(type) {
  if (['TEMP_WARNING', 'TEMP_DANGER', 'HUMIDITY_WARNING', 'HUMIDITY_DANGER', 'RAIN_DETECTED', 'LIGHT_WARNING', 'LIGHT_DANGER'].includes(type)) return 'Environmental alerts';
  if (['WEIGHT_DROP', 'WEIGHT_OUT_OF_RANGE', 'LOW_SOUND_ACTIVITY', 'HIGH_SOUND_ACTIVITY', 'SOUND_ANOMALY', 'LOW_BATTERY', 'BATTERY_WARNING'].includes(type)) return 'Hive health alerts';
  if (['FLAME_DETECTED', 'SUDDEN_SOUND_SPIKE', 'POSSIBLE_INTRUSION', 'POSSIBLE_SWARMING', 'MOTION_DETECTED'].includes(type)) return 'Danger alerts';
  return 'Other alerts';
}

export default function Alerts() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('Active');
  const [events, setEvents] = useState([]);
  const [hives, setHives] = useState([]);
  const [hiveFilter, setHiveFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  async function load() {
    const [hRes, eRes] = await Promise.all([
      axios.get('/api/hives'),
      axios.get(`/api/events?status=${encodeURIComponent(tab)}${hiveFilter ? `&hiveId=${encodeURIComponent(hiveFilter)}` : ''}`),
    ]);
    setHives(hRes.data);
    setEvents(eRes.data);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [tab, hiveFilter]);

  async function resolve(id) {
    await axios.patch(`/api/events/${id}/resolve`);
    await load();
  }

  async function ack(id) {
    await axios.patch(`/api/events/${id}/ack`);
    await load();
  }

  const grouped = useMemo(() => {
    const filtered = events.filter((e) => (severityFilter ? e.severity === severityFilter : true));
    const map = new Map(CATEGORY_ORDER.map((c) => [c, []]));
    filtered.forEach((evt) => map.get(getCategory(evt.type))?.push(evt));
    return CATEGORY_ORDER.map((category) => ({ category, items: map.get(category) || [] }));
  }, [events, severityFilter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Alerts</h1>
        <div className="text-sm text-muted">Environmental, hive-health, and danger alerts with anti-spam lifecycle.</div>
      </div>

      <div className="card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex gap-2">
          <button className={`btn ${tab === 'Active' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('Active')}>Active</button>
          <button className={`btn ${tab === 'Resolved' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('Resolved')}>Resolved</button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-muted" />
            <select className="input w-52" value={hiveFilter} onChange={(e) => setHiveFilter(e.target.value)}>
              <option value="">All hives</option>
              {hives.map((h) => <option key={h.hiveId} value={h.hiveId}>{h.name || h.hiveId}</option>)}
            </select>
          </div>
          <select className="input w-40" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="">All severities</option>
            <option value="WARNING">WARNING</option>
            <option value="DANGER">DANGER</option>
          </select>
        </div>
      </div>

      {grouped.map(({ category, items }) => (
        <div key={category} className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">{category}</div>
            <div className="text-xs text-muted">{items.length}</div>
          </div>
          {items.length === 0 ? (
            <div className="text-sm text-muted">No {category.toLowerCase()}.</div>
          ) : (
            <div className="space-y-2">
              {items.map((e) => (
                <div key={e._id} className="card p-4 flex items-start justify-between gap-3 bg-transparent border border-border shadow-none">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge ${e.severity === 'DANGER' ? 'bg-danger text-white' : 'bg-warning text-white'}`}>{e.severity}</span>
                      <div className="font-semibold">{e.type}</div>
                      <div className="text-xs text-muted">• {e.hiveId}</div>
                      {e.acknowledgedAt && <span className="badge bg-ok/15 text-ok">Acknowledged</span>}
                    </div>
                    <div className="text-sm text-muted mt-1">{e.message}</div>
                    <div className="text-xs text-muted mt-1">Created: {new Date(e.createdAt).toLocaleString()}{e.resolvedAt ? ` • Resolved: ${new Date(e.resolvedAt).toLocaleString()}` : ''}</div>
                  </div>
                  {isAdmin && tab === 'Active' && (
                    <div className="flex gap-2 shrink-0">
                      <button className="btn btn-ghost" onClick={() => ack(e._id)} title="Acknowledge"><Check size={16} /></button>
                      <button className="btn btn-ghost" onClick={() => resolve(e._id)} title="Resolve"><CheckCircle size={16} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
