import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

function isSimulated(hiveId) {
  return /^Hive_0[2-5]$/.test(hiveId);
}

export default function Hives() {
  const { isAdmin } = useAuth();
  const [hives, setHives] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(null); // hive object or null
  const [form, setForm] = useState({ hiveId: '', name: '', lat: '', lng: '', notes: '' });

  async function fetchHives() {
    setLoading(true);
    const res = await axios.get('/api/hives');
    setHives(res.data);
    setLoading(false);
  }

  useEffect(() => {
    fetchHives();
  }, []);

  function startCreate() {
    setEditing({ mode: 'create' });
    setForm({ hiveId: '', name: '', lat: '', lng: '', notes: '' });
  }

  function startEdit(h) {
    setEditing({ mode: 'edit', hiveId: h.hiveId });
    setForm({
      hiveId: h.hiveId,
      name: h.name || '',
      lat: h.location?.lat ?? '',
      lng: h.location?.lng ?? '',
      notes: h.notes || '',
    });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function save() {
    const payload = {
      hiveId: form.hiveId.trim(),
      name: form.name.trim(),
      lat: form.lat === '' ? undefined : Number(form.lat),
      lng: form.lng === '' ? undefined : Number(form.lng),
      notes: form.notes,
      active: true,
    };
    if (!payload.hiveId) return;

    if (editing?.mode === 'edit') {
      await axios.put(`/api/hives/${payload.hiveId}`, payload);
    } else {
      await axios.post('/api/hives', payload);
    }
    setEditing(null);
    await fetchHives();
  }

  async function removeHive(hiveId) {
    if (!confirm(`Disable hive ${hiveId}? This will not delete historical measurements.`)) return;
    await axios.delete(`/api/hives/${hiveId}`);
    await fetchHives();
  }

  const liveHives = useMemo(() => hives.filter((h) => !isSimulated(h.hiveId)), [hives]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hives</h1>
          <div className="text-sm text-muted">Manage hive metadata. Simulated hives are fixed (Hive_02..Hive_05).</div>
        </div>

        {isAdmin && (
          <button className="btn btn-primary" onClick={startCreate}>
            <Plus size={16} className="mr-1" /> Add Hive
          </button>
        )}
      </div>

      {editing && isAdmin && (
        <div className="card p-4">
          <div className="font-semibold mb-3">{editing.mode === 'edit' ? `Edit ${editing.hiveId}` : 'Create Hive'}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted">Hive ID</label>
              <input
                className="input mt-1"
                disabled={editing.mode === 'edit'}
                value={form.hiveId}
                onChange={(e) => setForm((s) => ({ ...s, hiveId: e.target.value }))}
                placeholder="Hive_06"
              />
            </div>
            <div>
              <label className="text-sm text-muted">Name</label>
              <input className="input mt-1" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="My Live Hive" />
            </div>
            <div>
              <label className="text-sm text-muted">Latitude</label>
              <input className="input mt-1" value={form.lat} onChange={(e) => setForm((s) => ({ ...s, lat: e.target.value }))} placeholder="36.8" />
            </div>
            <div>
              <label className="text-sm text-muted">Longitude</label>
              <input className="input mt-1" value={form.lng} onChange={(e) => setForm((s) => ({ ...s, lng: e.target.value }))} placeholder="10.18" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-muted">Notes</label>
              <textarea className="input mt-1 min-h-[80px]" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button className="btn btn-primary" onClick={save}>
              <Save size={16} className="mr-1" /> Save
            </button>
            <button className="btn" onClick={cancelEdit}>
              <X size={16} className="mr-1" /> Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="font-semibold">All Hives</div>
          <div className="text-sm text-muted">{loading ? 'Loading…' : `${hives.length} total`}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted">
              <tr className="border-b border-border">
                <th className="text-left p-3">Hive</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Health</th>
                <th className="text-left p-3">Last seen</th>
                <th className="text-left p-3">Location</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hives.map((h) => (
                <tr key={h.hiveId} className="border-b border-border hover:bg-black/5 dark:hover:bg-white/5">
                  <td className="p-3">
                    <Link className="text-accent hover:underline font-medium" to={`/hives/${h.hiveId}`}>
                      {h.name || h.hiveId}
                    </Link>
                    <div className="text-xs text-muted">{h.hiveId}</div>
                  </td>
                  <td className="p-3">
                    <span className={`badge ${h.status === 'LIVE' ? 'bg-ok text-white' : h.status === 'SIMULATED' ? 'bg-simulated text-white' : 'bg-offline text-white'}`}>
                      {h.status}
                    </span>
                  </td>
                  <td className="p-3">{h.health ?? 0}%</td>
                  <td className="p-3">{h.lastSeen ? new Date(h.lastSeen).toLocaleString() : '—'}</td>
                  <td className="p-3">
                    {h.location?.lat != null && h.location?.lng != null ? (
                      <span className="text-xs">
                        {Number(h.location.lat).toFixed(4)}, {Number(h.location.lng).toFixed(4)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      {isAdmin && !isSimulated(h.hiveId) ? (
                        <>
                          <button className="btn btn-ghost" onClick={() => startEdit(h)} title="Edit">
                            <Pencil size={16} />
                          </button>
                          <button className="btn btn-ghost" onClick={() => removeHive(h.hiveId)} title="Disable">
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-muted">{isSimulated(h.hiveId) ? 'Fixed' : ''}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {hives.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-muted" colSpan={6}>
                    No hives yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <div className="text-xs text-muted">
          Tip: create a device key in <b>Admin → Device Keys</b> then send ESP32 measurements to <code>/api/sensors</code> with <code>x-api-key</code>.
        </div>
      )}
    </div>
  );
}
