import express from 'express';
import Measurement from '../models/measurement.js';
import Hive from '../models/hive.js';
import { requireDeviceApiKey } from '../middleware/deviceAuth.js';
import { evaluateMeasurement } from '../utils/health.js';
import { getEffectiveSettings } from '../utils/settingsService.js';
import { computeSoundBaseline, zscoreRobust } from '../utils/soundBaseline.js';
import { upsertActiveEvent, resolveInactiveEvents } from '../utils/alertLifecycle.js';

const router = express.Router();

function isSimulatedHiveId(hiveId) {
  return /^Hive_0[2-5]$/.test(String(hiveId));
}

function buildMeasurementPayload(raw, previous) {
  const defaults = {
    temperature: 34,
    humidity: 60,
    weight: 25,
    battery: 90,
    light: 300,
    motion: 0,
    rain: 0,
    flame: 0,
    lat: null,
    lng: null,
    soundRms: null,
    soundPeakHz: null,
    soundBands: null,
  };

  const payload = { ...defaults };
  if (previous) {
    for (const key of Object.keys(defaults)) {
      if (typeof previous[key] !== 'undefined') payload[key] = previous[key];
    }
  }
  for (const [key, value] of Object.entries(raw || {})) {
    if (typeof value !== 'undefined') payload[key] = value;
  }
  if (Array.isArray(payload.soundBands) && payload.soundBands.length === 0) payload.soundBands = null;
  return payload;
}

router.post('/', requireDeviceApiKey, async (req, res) => {
  try {
    const incoming = req.body || {};
    const hiveId = req.deviceHiveId;

    if (isSimulatedHiveId(hiveId)) {
      return res.status(400).json({ message: 'Simulated hives (Hive_02..Hive_05) do not accept live device ingestion' });
    }

    await Hive.findOneAndUpdate(
      { hiveId },
      { $setOnInsert: { hiveId, name: hiveId, active: true } },
      { upsert: true, new: true }
    );

    const prev = await Measurement.findOne({ hiveId }).sort({ createdAt: -1 }).lean();
    const data = buildMeasurementPayload({ ...incoming, hiveId }, prev);
    const measurement = await Measurement.create(data);

    const settings = await getEffectiveSettings(hiveId);
    const soundWindowH = settings?.thresholds?.sound?.baselineWindowHours ?? 24;
    const baseline = await computeSoundBaseline({ hiveId, windowHours: soundWindowH });
    const peakHzZ = zscoreRobust(data.soundPeakHz, baseline.medianPeakHz, baseline.sigmaPeakHz);
    const rmsZ = zscoreRobust(data.soundRms, baseline.medianRms, baseline.sigmaRms);

    const sustainedSeconds = settings?.thresholds?.sound?.sustainedSeconds ?? 30;
    const since = new Date(Date.now() - sustainedSeconds * 1000);
    const windowDocs = await Measurement.find({ hiveId, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(200).lean();

    const soundTh = settings?.thresholds?.sound || {};
    const peakRange = soundTh.peakHzNormal || [200, 700];
    const sigmaWarn = soundTh.sigmaWarning ?? 2.5;
    const sigmaDanger = soundTh.sigmaDanger ?? 4.0;
    const rmsLow = soundTh.rmsLow ?? 10;
    const rmsHigh = soundTh.rmsHigh ?? 80;

    const soundRows = windowDocs.filter((d) => typeof d.soundPeakHz === 'number' || typeof d.soundRms === 'number');
    let sustainedWarning = false;
    let sustainedDanger = false;

    if (soundRows.length >= 2) {
      const warnHits = soundRows.filter((d) => {
        const peakZ = Math.abs(zscoreRobust(d.soundPeakHz, baseline.medianPeakHz, baseline.sigmaPeakHz) || 0);
        const rmsZDoc = Math.abs(zscoreRobust(d.soundRms, baseline.medianRms, baseline.sigmaRms) || 0);
        const peakOutside = typeof d.soundPeakHz === 'number' && (d.soundPeakHz < peakRange[0] || d.soundPeakHz > peakRange[1]);
        const rmsOutside = typeof d.soundRms === 'number' && (d.soundRms < rmsLow || d.soundRms > rmsHigh);
        return peakOutside || rmsOutside || peakZ > sigmaWarn || rmsZDoc > sigmaWarn;
      }).length;

      const dangerHits = soundRows.filter((d) => {
        const peakZ = Math.abs(zscoreRobust(d.soundPeakHz, baseline.medianPeakHz, baseline.sigmaPeakHz) || 0);
        const rmsZDoc = Math.abs(zscoreRobust(d.soundRms, baseline.medianRms, baseline.sigmaRms) || 0);
        const peakDanger = typeof d.soundPeakHz === 'number' && d.soundPeakHz > (soundTh.peakAlertHz ?? 900);
        const rmsDanger = typeof d.soundRms === 'number' && d.soundRms > rmsHigh;
        return peakDanger || rmsDanger || peakZ > sigmaDanger || rmsZDoc > sigmaDanger;
      }).length;

      sustainedWarning = warnHits / soundRows.length >= 0.7;
      sustainedDanger = dangerHits / soundRows.length >= 0.7;
    }

    const suddenPeakDeltaHz =
      prev && typeof prev.soundPeakHz === 'number' && typeof data.soundPeakHz === 'number'
        ? Math.abs(data.soundPeakHz - prev.soundPeakHz)
        : 0;

    const isNight = typeof data.light === 'number' ? data.light < 50 : false;
    const weightDropKg = prev && typeof prev.weight === 'number' && typeof data.weight === 'number' ? Math.max(0, prev.weight - data.weight) : 0;

    const { health, statuses, events } = evaluateMeasurement(data, prev, settings, {
      peakHzZ,
      rmsZ,
      isNight,
      weightDropKg,
      baseline,
      sustainedWarning,
      sustainedDanger,
      suddenPeakDeltaHz,
    });

    const cooldownMs = parseInt(process.env.ALERT_COOLDOWN_MS || '', 10) || settings.alertCooldownMs || 300000;

    const activeTypes = [];
    for (const evt of events) {
      activeTypes.push(evt.type);
      await upsertActiveEvent({ hiveId, type: evt.type, severity: evt.severity, message: evt.message, cooldownMs });
    }
    await resolveInactiveEvents({ hiveId, stillActiveTypes: activeTypes });

    const io = req.app.get('io');
    io.emit('sensor_update', { hiveId, measurement: data, health, statuses });

    return res.status(201).json({
      message: 'Measurement saved',
      hiveId,
      health,
      statuses,
      mergedDefaults: Object.keys(incoming).length < 8,
      events: events.map((e) => ({ type: e.type, severity: e.severity })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
