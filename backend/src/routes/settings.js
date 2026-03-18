import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { Settings, HiveSettings, getDefaultThresholds } from '../models/settings.js';
import { getGlobalSettings } from '../utils/settingsService.js';

const router = express.Router();

// GET /api/settings (viewer+admin)
router.get('/', requireAuth, async (req, res) => {
  try {
    const settings = await getGlobalSettings();
    return res.json(settings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/settings (admin only)
router.put('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = req.body || {};
    const existing = await Settings.findOne({ key: 'global' });
    if (!existing) {
      const created = await Settings.create({ key: 'global', ...payload, thresholds: payload.thresholds || getDefaultThresholds() });
      return res.json(created);
    }
    // Shallow merge for top-level, thresholds is stored as object (replace)
    existing.themeDefault = payload.themeDefault ?? existing.themeDefault;
    existing.alertCooldownMs = payload.alertCooldownMs ?? existing.alertCooldownMs;
    existing.retentionDays = payload.retentionDays ?? existing.retentionDays;
    if (payload.notifications) existing.notifications = { ...existing.notifications, ...payload.notifications };
    if (payload.thresholds) existing.thresholds = payload.thresholds;
    await existing.save();
    return res.json(existing);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/settings/hives/:hiveId (viewer+admin)
router.get('/hives/:hiveId', requireAuth, async (req, res) => {
  try {
    const { hiveId } = req.params;
    const doc = await HiveSettings.findOne({ hiveId }).lean();
    return res.json(doc || { hiveId, thresholds: {} });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/settings/hives/:hiveId (admin)
router.put('/hives/:hiveId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { hiveId } = req.params;
    const { thresholds = {} } = req.body || {};
    const updated = await HiveSettings.findOneAndUpdate(
      { hiveId },
      { $set: { thresholds } },
      { new: true, upsert: true }
    );
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
