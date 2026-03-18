import express from 'express';
import { nanoid } from 'nanoid';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import Device from '../models/device.js';
import Hive from '../models/hive.js';
import { generateApiKey, hashApiKey } from '../utils/crypto.js';

const router = express.Router();

function isSimulatedHiveId(hiveId) {
  return /^Hive_0[2-5]$/.test(String(hiveId));
}


// GET /api/devices?hiveId=Hive_06
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { hiveId } = req.query;
    const filter = hiveId ? { hiveId: String(hiveId) } : {};
    const devices = await Device.find(filter).sort({ createdAt: -1 }).lean();
    return res.json(devices);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/devices  { hiveId, label }
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { hiveId, label = '' } = req.body || {};
    if (!hiveId) return res.status(400).json({ message: 'hiveId is required' });

    if (isSimulatedHiveId(hiveId)) {
      return res.status(400).json({ message: 'Cannot create device keys for simulated hives (Hive_02..Hive_05)' });
    }

    // Ensure hive exists (for live hive management)
    await Hive.findOneAndUpdate(
      { hiveId: String(hiveId) },
      { $setOnInsert: { hiveId: String(hiveId), name: String(hiveId), active: true } },
      { upsert: true, new: true }
    );

    const deviceId = nanoid(10);
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    const device = await Device.create({ deviceId, hiveId: String(hiveId), apiKeyHash, enabled: true, label });

    return res.status(201).json({
      deviceId: device.deviceId,
      hiveId: device.hiveId,
      enabled: device.enabled,
      label: device.label,
      apiKey, // returned once!
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/devices/:deviceId/revoke
router.patch('/:deviceId/revoke', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOneAndUpdate({ deviceId }, { $set: { enabled: false } }, { new: true });
    if (!device) return res.status(404).json({ message: 'Device not found' });
    return res.json(device);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
