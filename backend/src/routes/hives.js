import express from 'express';
import Measurement from '../models/measurement.js';
import Hive from '../models/hive.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { evaluateMeasurement } from '../utils/health.js';
import { getEffectiveSettings } from '../utils/settingsService.js';

const router = express.Router();

function isSimulatedHiveId(hiveId) {
  return /^Hive_0[2-5]$/.test(hiveId);
}

// GET /api/hives (viewer+admin)
router.get('/', requireAuth, async (req, res) => {
  try {
    const now = Date.now();
    const offlineThreshold = parseInt(process.env.OFFLINE_THRESHOLD || '', 10) || 60000;

    const [metaHives, latestAgg] = await Promise.all([
      Hive.find({ active: true }).lean(),
      Measurement.aggregate([
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$hiveId', measurement: { $first: '$$ROOT' } } },
      ]),
    ]);

    const metaMap = new Map(metaHives.map((h) => [h.hiveId, h]));
    const measurementMap = new Map(latestAgg.map((x) => [x._id, x.measurement]));

    const hiveIds = new Set([...metaMap.keys(), ...measurementMap.keys()]);
    const out = [];

    for (const hiveId of hiveIds) {
      const lastMeasurement = measurementMap.get(hiveId) || null;
      const meta = metaMap.get(hiveId) || null;

      const type = isSimulatedHiveId(hiveId) ? 'SIMULATED' : 'LIVE';
      let status = type;
      let lastSeen = lastMeasurement?.createdAt ? new Date(lastMeasurement.createdAt) : null;

      if (!lastSeen || now - lastSeen.getTime() > offlineThreshold) {
        status = 'OFFLINE';
      }

      // Compute health + statuses (if data exists)
      let health = 0;
      let statuses = {};
      if (lastMeasurement) {
        const prev = await Measurement.findOne({ hiveId, _id: { $lt: lastMeasurement._id } }).sort({ createdAt: -1 }).lean();
        const settings = await getEffectiveSettings(hiveId);
        const isNight = typeof lastMeasurement.light === 'number' ? lastMeasurement.light < 50 : false;
        const weightDropKg =
          prev && typeof prev.weight === 'number' && typeof lastMeasurement.weight === 'number'
            ? Math.max(0, prev.weight - lastMeasurement.weight)
            : 0;
        const { health: h, statuses: st } = evaluateMeasurement(lastMeasurement, prev, settings, {
          isNight,
          weightDropKg,
        });
        health = h;
        statuses = st;
      }

      out.push({
        hiveId,
        status, // LIVE/SIMULATED/OFFLINE
        type,
        lastSeen,
        health,
        statuses,
        name: meta?.name || hiveId,
        location: { lat: meta?.lat ?? lastMeasurement?.lat, lng: meta?.lng ?? lastMeasurement?.lng },
        notes: meta?.notes || '',
        values: lastMeasurement
          ? {
              temperature: lastMeasurement.temperature,
              humidity: lastMeasurement.humidity,
              weight: lastMeasurement.weight,
              battery: lastMeasurement.battery,
              light: lastMeasurement.light,
              motion: lastMeasurement.motion,
              rain: lastMeasurement.rain,
              flame: lastMeasurement.flame,
              lat: lastMeasurement.lat,
              lng: lastMeasurement.lng,
              soundRms: lastMeasurement.soundRms,
              soundPeakHz: lastMeasurement.soundPeakHz,
              soundBands: lastMeasurement.soundBands,
            }
          : {
              temperature: null,
              humidity: null,
              weight: null,
              battery: null,
              light: null,
              motion: null,
              rain: null,
              flame: null,
              lat: meta?.lat ?? null,
              lng: meta?.lng ?? null,
              soundRms: null,
              soundPeakHz: null,
              soundBands: null,
            },
      });
    }

    // Sort by hiveId
    out.sort((a, b) => a.hiveId.localeCompare(b.hiveId));
    return res.json(out);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/hives/:hiveId
router.get('/:hiveId', requireAuth, async (req, res) => {
  try {
    const { hiveId } = req.params;
    const hive = await Hive.findOne({ hiveId }).lean();
    const last = await Measurement.findOne({ hiveId }).sort({ createdAt: -1 }).lean();
    return res.json({ hiveId, hive, lastMeasurement: last });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ADMIN: create hive
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { hiveId, name = '', lat, lng, notes = '', active = true } = req.body || {};
    if (!hiveId) return res.status(400).json({ message: 'hiveId is required' });

    const created = await Hive.findOneAndUpdate(
      { hiveId: String(hiveId) },
      { $set: { name, lat, lng, notes, active } },
      { new: true, upsert: true }
    );
    return res.status(201).json(created);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ADMIN: update hive
router.put('/:hiveId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { hiveId } = req.params;
    const payload = req.body || {};
    const updated = await Hive.findOneAndUpdate({ hiveId }, { $set: payload }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Hive not found' });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ADMIN: delete hive (soft delete)
router.delete('/:hiveId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { hiveId } = req.params;
    const updated = await Hive.findOneAndUpdate({ hiveId }, { $set: { active: false } }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Hive not found' });
    return res.json({ message: 'Hive disabled', hive: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
