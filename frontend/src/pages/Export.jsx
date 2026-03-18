import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';

function guessFilename(disposition, fallback) {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

export default function ExportPage() {
  const [hives, setHives] = useState([]);
  const [params] = useSearchParams();
  const initialHiveId = params.get('hiveId') || '';
  const [form, setForm] = useState({ type: 'Sensors', hiveId: initialHiveId, format: 'csv', start: '', end: '' });
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('/api/hives').then((res) => {
      setHives(res.data);
      if (!form.hiveId && res.data.length) setForm((s) => ({ ...s, hiveId: res.data[0].hiveId }));
    });
  }, []);

  const queryUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set('type', form.type);
    q.set('hiveId', form.hiveId);
    q.set('format', form.format);
    if (form.start) q.set('start', new Date(form.start).toISOString());
    if (form.end) q.set('end', new Date(form.end).toISOString());
    return `/api/export?${q.toString()}`;
  }, [form]);

  async function download() {
    if (!form.hiveId) return;
    setDownloading(true);
    setError('');
    try {
      const res = await axios.get(queryUrl, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const ext = form.format.toLowerCase() === 'pdf' ? 'pdf' : 'csv';
      const fallbackName = `${form.type.toLowerCase()}_${form.hiveId}.${ext}`;
      const filename = guessFilename(res.headers['content-disposition'], fallbackName);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Export</h1>
        <div className="text-sm text-muted">Export filtered Sensors, History, or Alerts as CSV or PDF.</div>
      </div>

      <div className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-muted">Type</label>
          <select className="input mt-1" value={form.type} onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}>
            <option>Sensors</option>
            <option>History</option>
            <option>Alerts</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-muted">Hive</label>
          <select className="input mt-1" value={form.hiveId} onChange={(e) => setForm((s) => ({ ...s, hiveId: e.target.value }))}>
            {hives.map((h) => (
              <option key={h.hiveId} value={h.hiveId}>{h.name || h.hiveId}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-muted">Format</label>
          <select className="input mt-1" value={form.format} onChange={(e) => setForm((s) => ({ ...s, format: e.target.value }))}>
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-muted">Start</label>
          <input className="input mt-1" type="datetime-local" value={form.start} onChange={(e) => setForm((s) => ({ ...s, start: e.target.value }))} />
        </div>
        <div>
          <label className="text-sm text-muted">End</label>
          <input className="input mt-1" type="datetime-local" value={form.end} onChange={(e) => setForm((s) => ({ ...s, end: e.target.value }))} />
        </div>
        <div className="md:col-span-2 flex items-center justify-between gap-3 mt-2 flex-wrap">
          <div className="text-xs text-muted break-all">{queryUrl}</div>
          <button className="btn btn-primary" onClick={download} disabled={downloading}>
            {downloading ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Download size={16} className="mr-1" />}
            {downloading ? 'Downloading…' : 'Download'}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-danger">{error}</div>}
      <div className="text-xs text-muted">Exports now use your signed-in session, so authenticated CSV/PDF downloads work without opening a new tab.</div>
    </div>
  );
}
