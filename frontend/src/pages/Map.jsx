import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ExternalLink, MapPin } from 'lucide-react';

export default function Map() {
  const [hives, setHives] = useState([]);

  useEffect(() => {
    async function load() {
      const res = await axios.get('/api/hives');
      setHives(res.data);
    }
    load();
  }, []);

  const withLocation = useMemo(() => hives.filter((h) => h.location?.lat != null && h.location?.lng != null), [hives]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Map</h1>
        <div className="text-sm text-muted">Open hive locations directly in Google Maps.</div>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={18} className="text-accent" />
          <div className="font-semibold">Hives with GPS</div>
          <div className="text-sm text-muted ml-auto">{withLocation.length}</div>
        </div>

        {withLocation.length === 0 ? (
          <div className="text-sm text-muted">No hives have location data yet.</div>
        ) : (
          <div className="space-y-2">
            {withLocation.map((h) => {
              const lat = Number(h.location.lat);
              const lng = Number(h.location.lng);
              const url = `https://www.google.com/maps?q=${lat},${lng}`;
              return (
                <div key={h.hiveId} className="flex items-center justify-between border border-border rounded-lg p-3">
                  <div>
                    <div className="font-medium">{h.name || h.hiveId}</div>
                    <div className="text-xs text-muted">
                      {lat.toFixed(5)}, {lng.toFixed(5)} • {h.hiveId}
                    </div>
                  </div>
                  <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} className="mr-1" /> Open in Google Maps
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-xs text-muted">
        Optional: you can add Leaflet later if you want an embedded map. For now, Google Maps links are fully working.
      </div>
    </div>
  );
}
