import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

export default function Settings() {
  const { isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await axios.get('/api/settings');
    setSettings(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await axios.put('/api/settings', settings);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <div className="p-6 text-sm text-muted">Loading settings…</div>;

  const th = settings.thresholds || {};
  const sound = th.sound || {};

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <div className="text-sm text-muted">Stored in MongoDB. Viewer = read-only, Admin = edit.</div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="font-semibold">UI Theme</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted">Current theme (local override)</label>
            <select className="input mt-1" value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <div className="text-xs text-muted mt-1">This is stored in localStorage for this browser.</div>
          </div>
          <div>
            <label className="text-sm text-muted">Default theme (DB)</label>
            <select className="input mt-1" value={settings.themeDefault} disabled={!isAdmin} onChange={(e) => setSettings((s) => ({ ...s, themeDefault: e.target.value }))}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <div className="text-xs text-muted mt-1">Used when no local theme is set.</div>
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="font-semibold">Alerts</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm text-muted">Cooldown (ms)</label>
            <input className="input mt-1" type="number" disabled={!isAdmin} value={settings.alertCooldownMs} onChange={(e) => setSettings((s) => ({ ...s, alertCooldownMs: Number(e.target.value) }))} />
            <div className="text-xs text-muted mt-1">Default: 300000 (5 minutes).</div>
          </div>
          <div>
            <label className="text-sm text-muted">Retention (days)</label>
            <input className="input mt-1" type="number" disabled={!isAdmin} value={settings.retentionDays} onChange={(e) => setSettings((s) => ({ ...s, retentionDays: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="text-sm text-muted">Notifications enabled</label>
            <select className="input mt-1" disabled={!isAdmin} value={settings.notifications?.enabled ? 'true' : 'false'} onChange={(e) => setSettings((s) => ({ ...s, notifications: { ...(s.notifications || {}), enabled: e.target.value === 'true' } }))}>
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="font-semibold">Thresholds</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <RangeEditor title="Temperature normal (°C)" value={th.temperature?.normal} disabled={!isAdmin} onChange={(v) => setSettings((s) => ({ ...s, thresholds: { ...th, temperature: { ...(th.temperature || {}), normal: v } } }))} />
          <RangeEditor title="Humidity normal (%RH)" value={th.humidity?.normal} disabled={!isAdmin} onChange={(v) => setSettings((s) => ({ ...s, thresholds: { ...th, humidity: { ...(th.humidity || {}), normal: v } } }))} />
          <RangeEditor title="Battery normal (%)" value={th.battery?.normal} disabled={!isAdmin} onChange={(v) => setSettings((s) => ({ ...s, thresholds: { ...th, battery: { ...(th.battery || {}), normal: v } } }))} />
          <RangeEditor title="Light level normal" value={th.light?.normal} disabled={!isAdmin} onChange={(v) => setSettings((s) => ({ ...s, thresholds: { ...th, light: { ...(th.light || {}), normal: v } } }))} />
          <div>
            <label className="text-sm text-muted">Weight drop danger (kg)</label>
            <input className="input mt-1" type="number" step="0.1" disabled={!isAdmin} value={th.weight?.dropDangerKg ?? 2.0} onChange={(e) => setSettings((s) => ({ ...s, thresholds: { ...th, weight: { ...(th.weight || {}), dropDangerKg: Number(e.target.value) } } }))} />
          </div>
          <RangeEditor title="Weight expected range (kg)" value={th.weight?.range} disabled={!isAdmin} onChange={(v) => setSettings((s) => ({ ...s, thresholds: { ...th, weight: { ...(th.weight || {}), range: v } } }))} />
        </div>

        <div className="mt-4 font-semibold">Sound (smart alerts)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <RangeEditor title="Peak Hz normal range" value={sound.peakHzNormal} disabled={!isAdmin} onChange={(v) => setSettings((s) => ({ ...s, thresholds: { ...th, sound: { ...sound, peakHzNormal: v } } }))} />
          <RangeEditor title="Sound RMS normal range" value={sound.rmsNormal || [10, 60]} disabled={!isAdmin} onChange={(v) => setSettings((s) => ({ ...s, thresholds: { ...th, sound: { ...sound, rmsNormal: v } } }))} />
          <div>
            <label className="text-sm text-muted">Low sound activity threshold</label>
            <input className="input mt-1" type="number" step="0.1" disabled={!isAdmin} value={sound.rmsLow ?? 10} onChange={(e) => setSettings((s) => ({ ...s, thresholds: { ...th, sound: { ...sound, rmsLow: Number(e.target.value) } } }))} />
          </div>
          <div>
            <label className="text-sm text-muted">High sound activity threshold</label>
            <input className="input mt-1" type="number" step="0.1" disabled={!isAdmin} value={sound.rmsHigh ?? 80} onChange={(e) => setSettings((s) => ({ ...s, thresholds: { ...th, sound: { ...sound, rmsHigh: Number(e.target.value) } } }))} />
          </div>
          <div>
            <label className="text-sm text-muted">Peak alert threshold (Hz)</label>
            <input className="input mt-1" type="number" disabled={!isAdmin} value={sound.peakAlertHz ?? 900} onChange={(e) => setSettings((s) => ({ ...s, thresholds: { ...th, sound: { ...sound, peakAlertHz: Number(e.target.value) } } }))} />
          </div>
          <div>
            <label className="text-sm text-muted">Sudden peak delta (Hz)</label>
            <input className="input mt-1" type="number" disabled={!isAdmin} value={sound.suddenPeakDeltaHz ?? 300} onChange={(e) => setSettings((s) => ({ ...s, thresholds: { ...th, sound: { ...sound, suddenPeakDeltaHz: Number(e.target.value) } } }))} />
          </div>
          <div>
            <label className="text-sm text-muted">Baseline window (hours)</label>
            <input className="input mt-1" type="number" disabled={!isAdmin} value={sound.baselineWindowHours ?? 24} onChange={(e) => setSettings((s) => ({ ...s, thresholds: { ...th, sound: { ...sound, baselineWindowHours: Number(e.target.value) } } }))} />
          </div>
          <div>
            <label className="text-sm text-muted">Sustained threshold time (seconds)</label>
            <input className="input mt-1" type="number" disabled={!isAdmin} value={sound.sustainedSeconds ?? 30} onChange={(e) => setSettings((s) => ({ ...s, thresholds: { ...th, sound: { ...sound, sustainedSeconds: Number(e.target.value) } } }))} />
          </div>
          <div>
            <label className="text-sm text-muted">Sigma warning</label>
            <input className="input mt-1" type="number" step="0.1" disabled={!isAdmin} value={sound.sigmaWarning ?? 2.5} onChange={(e) => setSettings((s) => ({ ...s, thresholds: { ...th, sound: { ...sound, sigmaWarning: Number(e.target.value) } } }))} />
          </div>
          <div>
            <label className="text-sm text-muted">Sigma danger</label>
            <input className="input mt-1" type="number" step="0.1" disabled={!isAdmin} value={sound.sigmaDanger ?? 4.0} onChange={(e) => setSettings((s) => ({ ...s, thresholds: { ...th, sound: { ...sound, sigmaDanger: Number(e.target.value) } } }))} />
          </div>
        </div>
        <div className="text-xs text-muted mt-2">Recommended defaults: Sound RMS 10 → 60 normal, &gt; 80 alert, Sound Peak 200 → 700 Hz normal, &gt; 900 danger, sustained for 30 seconds before alerting.</div>
      </div>

      {isAdmin && <div className="flex justify-end"><button className="btn btn-primary" onClick={save} disabled={saving}><Save size={16} className="mr-1" /> {saving ? 'Saving…' : 'Save Settings'}</button></div>}
    </div>
  );
}

function RangeEditor({ title, value, onChange, disabled }) {
  const v0 = value?.[0] ?? '';
  const v1 = value?.[1] ?? '';
  return (
    <div>
      <label className="text-sm text-muted">{title}</label>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <input className="input" type="number" step="0.1" disabled={disabled} value={v0} onChange={(e) => onChange([Number(e.target.value), v1 === '' ? '' : Number(v1)])} />
        <input className="input" type="number" step="0.1" disabled={disabled} value={v1} onChange={(e) => onChange([v0 === '' ? '' : Number(v0), Number(e.target.value)])} />
      </div>
    </div>
  );
}
