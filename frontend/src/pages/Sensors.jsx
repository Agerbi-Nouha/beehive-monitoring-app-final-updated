import React from 'react';

import imgDht from '../assets/sensors/dht.png';
import imgLoad from '../assets/sensors/loadcell.png';
import imgLdr from '../assets/sensors/ldr.png';
import imgPir from '../assets/sensors/pir.png';
import imgRain from '../assets/sensors/rain.png';
import imgFlame from '../assets/sensors/flame.png';
import imgMic from '../assets/sensors/microphone.png';
import imgGps from '../assets/sensors/gps.png';

const sensors = [
  {
    name: 'Temperature + Humidity (DHT)',
    img: imgDht,
    fields: ['temperature', 'humidity'],
    desc: 'Monitors hive microclimate. Healthy brood often stays in a narrow temperature band.',
  },
  {
    name: 'Weight (Load Cell + HX711)',
    img: imgLoad,
    fields: ['weight'],
    desc: 'Tracks nectar flow, swarming (rapid drops), and colony consumption over time.',
  },
  {
    name: 'Light (LDR)',
    img: imgLdr,
    fields: ['light'],
    desc: 'Helps detect lid openings or daylight patterns. Used for night correlation in sound alerts.',
  },
  {
    name: 'Motion (PIR)',
    img: imgPir,
    fields: ['motion'],
    desc: 'Detects movement near the hive—useful for intrusions or unusual activity.',
  },
  {
    name: 'Rain Sensor',
    img: imgRain,
    fields: ['rain'],
    desc: 'Used to reduce false positives in sound alerts and interpret foraging patterns.',
  },
  {
    name: 'Flame Sensor',
    img: imgFlame,
    fields: ['flame'],
    desc: 'Safety sensor. Triggers high-severity alerts when flame is detected.',
  },
  {
    name: 'Sound (Microphone Module)',
    img: imgMic,
    fields: ['soundRms', 'soundPeakHz'],
    desc: 'Uses RMS energy and dominant frequency (Hz). Smart alerts consider baseline + correlations.',
  },
  {
    name: 'GPS Module',
    img: imgGps,
    fields: ['lat', 'lng'],
    desc: 'Reports hive coordinates (optional). Map page can open hive location in Google Maps.',
  },
];

export default function Sensors() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Sensors</h1>
        <div className="text-sm text-muted">Real sensor images are included in <code>src/assets/sensors</code>.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sensors.map((s) => (
          <div key={s.name} className="card overflow-hidden">
            <div className="aspect-[16/9] bg-black/5 dark:bg-white/5 flex items-center justify-center">
              <img src={s.img} alt={s.name} className="max-h-full object-contain p-2" />
            </div>
            <div className="p-4">
              <div className="font-semibold">{s.name}</div>
              <div className="text-sm text-muted mt-1">{s.desc}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.fields.map((f) => (
                  <span key={f} className="badge bg-accent/10 text-accent">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4 text-sm">
        <div className="font-semibold mb-2">ESP32 payload fields</div>
        <div className="text-muted">
          Live hives send measurements to <code>/api/sensors</code> with header <code>x-api-key</code>. Fields:
        </div>
        <pre className="mt-2 text-xs bg-black/5 dark:bg-white/5 rounded-lg p-3 overflow-x-auto">{`{
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
  "soundBands": [ ... optional ... ]
}`}</pre>
      </div>
    </div>
  );
}
