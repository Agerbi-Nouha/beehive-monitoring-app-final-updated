import Measurement from '../models/measurement.js';
import { evaluateMeasurement } from './health.js';
import { upsertActiveEvent, resolveInactiveEvents } from './alertLifecycle.js';
import { getEffectiveSettings } from './settingsService.js';

const simulatedHives = [
  { hiveId: 'Hive_02', lat: 36.8008, lng: 10.18 },
  { hiveId: 'Hive_03', lat: 36.8009, lng: 10.1801 },
  { hiveId: 'Hive_04', lat: 36.8010, lng: 10.1802 },
  { hiveId: 'Hive_05', lat: 36.8011, lng: 10.1803 },
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function drift(base, step, min, max, digits = 1) {
  const next = clamp((base ?? ((min + max) / 2)) + (Math.random() * 2 - 1) * step, min, max);
  return Number(next.toFixed(digits));
}

function generateMeasurement(hive, prev) {
  const humidity = drift(prev?.humidity, 3, 40, 80, 1);
  const temperature = drift(prev?.temperature, 0.8, 30, 38, 1);
  const weight = drift(prev?.weight, 0.6, 10, 55, 2);
  const battery = drift(prev?.battery, 0.5, 20, 100, 1);
  const light = drift(prev?.light, 120, 0, 1200, 1);

  const motion = Math.random() > 0.96 ? 1 : 0;
  const rain = Math.random() > 0.93 ? 1 : 0;
  const flame = Math.random() > 0.995 ? 1 : 0;

  let soundPeakHz = drift(prev?.soundPeakHz, 40, 220, 680, 0);
  let soundRms = drift(prev?.soundRms, 5, 15, 55, 1);

  if (Math.random() > 0.985) {
    soundPeakHz = Number((900 + Math.random() * 250).toFixed(0));
    soundRms = Number((85 + Math.random() * 12).toFixed(1));
  } else if (Math.random() > 0.985) {
    soundRms = Number((5 + Math.random() * 3).toFixed(1));
  }

  const soundBands = [
    Number((soundRms * 0.7 + Math.random() * 4).toFixed(1)),
    Number((soundRms * 0.85 + Math.random() * 4).toFixed(1)),
    Number((soundRms + Math.random() * 4).toFixed(1)),
    Number((soundRms * 0.9 + Math.random() * 4).toFixed(1)),
  ];

  return {
    hiveId: hive.hiveId,
    temperature,
    humidity,
    weight,
    battery,
    light,
    motion,
    rain,
    flame,
    lat: Number((hive.lat + (Math.random() * 0.0002 - 0.0001)).toFixed(6)),
    lng: Number((hive.lng + (Math.random() * 0.0002 - 0.0001)).toFixed(6)),
    soundPeakHz,
    soundRms,
    soundBands,
  };
}

export function startSimulation(io) {
  const interval = parseInt(process.env.SIM_INTERVAL, 10) || 10000;
  setInterval(async () => {
    for (const hive of simulatedHives) {
      const prev = await Measurement.findOne({ hiveId: hive.hiveId }).sort({ createdAt: -1 }).lean();
      const measurement = generateMeasurement(hive, prev);
      await Measurement.create(measurement);

      const settings = await getEffectiveSettings(hive.hiveId);
      const cooldownMs = parseInt(process.env.ALERT_COOLDOWN_MS || '', 10) || settings.alertCooldownMs || 300000;

      const { health, statuses, events } = evaluateMeasurement(measurement, prev, settings, {
        isNight: measurement.light < 50,
        weightDropKg: prev ? Math.max(0, (prev.weight ?? 0) - (measurement.weight ?? 0)) : 0,
        suddenPeakDeltaHz: prev?.soundPeakHz && measurement.soundPeakHz ? Math.abs(measurement.soundPeakHz - prev.soundPeakHz) : 0,
      });

      const activeTypes = [];
      for (const evt of events) {
        activeTypes.push(evt.type);
        await upsertActiveEvent({ hiveId: hive.hiveId, type: evt.type, severity: evt.severity, message: evt.message, cooldownMs });
      }
      await resolveInactiveEvents({ hiveId: hive.hiveId, stillActiveTypes: activeTypes });

      io.emit('sensor_update', { hiveId: hive.hiveId, measurement, health, statuses });
    }
  }, interval);
}
