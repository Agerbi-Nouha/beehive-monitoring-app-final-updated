import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react';

export default function AdminDevices() {
  const [hives, setHives] = useState([]);
  const [devices, setDevices] = useState([]);
  const [hiveId, setHiveId] = useState('');
  const [label, setLabel] = useState('');
  const [createdKey, setCreatedKey] = useState(null);

  async function load() {
    const hRes = await axios.get('/api/hives');
    setHives(hRes.data);
    if (!hiveId && hRes.data.length) setHiveId(hRes.data[0].hiveId);

    const dRes = await axios.get(`/api/devices${hiveId ? `?hiveId=${encodeURIComponent(hiveId)}` : ''}`);
    setDevices(dRes.data);
  }

  useEffect(() => {
    load();
  }, [hiveId]);

  async function createKey() {
    if (!hiveId) return;
    const res = await axios.post('/api/devices', { hiveId, label });
    setCreatedKey(res.data);
    setLabel('');
    await load();
  }

  async function revoke(deviceId) {
    if (!confirm(`Revoke device ${deviceId}?`)) return;
    await axios.patch(`/api/devices/${deviceId}/revoke`);
    await load();
  }

  async function copy(text) {
    await navigator.clipboard.writeText(text);
    alert('Copied');
  }

  const enabledDevices = useMemo(() => devices.filter((d) => d.enabled), [devices]);
  const disabledDevices = useMemo(() => devices.filter((d) => !d.enabled), [devices]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Device Keys</h1>
        <div className="text-sm text-muted">Create/revoke API keys for ESP32 devices (x-api-key).</div>
      </div>

      <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-muted">Hive</label>
          <select className="input mt-1" value={hiveId} onChange={(e) => setHiveId(e.target.value)}>
            {hives.map((h) => (
              <option key={h.hiveId} value={h.hiveId}>
                {h.name || h.hiveId}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-muted">Label</label>
          <input className="input mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Front-yard ESP32" />
        </div>
        <div className="flex items-end">
          <button className="btn btn-primary w-full" onClick={createKey}>
            <Plus size={16} className="mr-1" /> Create Key
          </button>
        </div>
      </div>

      {createdKey && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound size={18} className="text-accent" />
            <div className="font-semibold">New API Key (shown once)</div>
          </div>
          <div className="text-sm text-muted mb-2">
            Device <b>{createdKey.deviceId}</b> for hive <b>{createdKey.hiveId}</b>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/5 dark:bg-white/5 rounded-lg p-2 text-xs overflow-x-auto">{createdKey.apiKey}</code>
            <button className="btn btn-ghost" onClick={() => copy(createdKey.apiKey)} title="Copy">
              <Copy size={16} />
            </button>
          </div>

          <div className="mt-3 text-xs text-muted">
            Save this key in your ESP32 firmware. It is stored hashed in MongoDB (sha256).
          </div>
        </div>
      )}

      <Section title="Enabled devices">
        <DeviceTable devices={enabledDevices} onRevoke={revoke} />
      </Section>

      <Section title="Revoked devices">
        <DeviceTable devices={disabledDevices} onRevoke={revoke} />
      </Section>

      <div className="card p-4">
        <div className="font-semibold mb-2">ESP32 request example</div>
        <pre className="text-xs bg-black/5 dark:bg-white/5 rounded-lg p-3 overflow-x-auto">{`POST /api/sensors
x-api-key: <YOUR_API_KEY>
Content-Type: application/json

{
  "temperature": 35.2,
  "humidity": 62.1,
  "weight": 27.65,
  "battery": 78.0,
  "light": 120,
  "motion": 0,
  "rain": 0,
  "flame": 0,
  "lat": 36.8008,
  "lng": 10.1800,
  "soundRms": 0.031,
  "soundPeakHz": 320,
  "soundBands": [12, 15, 18, 21]
}`}</pre>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="card p-4">
      <div className="font-semibold mb-2">{title}</div>
      {children}
    </div>
  );
}

function DeviceTable({ devices, onRevoke }) {
  if (!devices.length) return <div className="text-sm text-muted">None.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted">
          <tr className="border-b border-border">
            <th className="text-left p-2">Device</th>
            <th className="text-left p-2">Hive</th>
            <th className="text-left p-2">Label</th>
            <th className="text-left p-2">Enabled</th>
            <th className="text-right p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((d) => (
            <tr key={d.deviceId} className="border-b border-border">
              <td className="p-2 font-medium">{d.deviceId}</td>
              <td className="p-2">{d.hiveId}</td>
              <td className="p-2">{d.label || '—'}</td>
              <td className="p-2">{d.enabled ? 'Yes' : 'No'}</td>
              <td className="p-2 text-right">
                {d.enabled ? (
                  <button className="btn btn-ghost" onClick={() => onRevoke(d.deviceId)} title="Revoke">
                    <Trash2 size={16} />
                  </button>
                ) : (
                  <span className="text-xs text-muted">Revoked</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
