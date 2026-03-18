import express from 'express';
import Event from '../models/event.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { hiveId, status, start, end } = req.query;
    const filter = {};
    if (hiveId) filter.hiveId = String(hiveId);
    if (status) filter.status = String(status);
    if (start || end) {
      filter.createdAt = {};
      if (start) filter.createdAt.$gte = new Date(start);
      if (end) filter.createdAt.$lte = new Date(end);
    }
    const events = await Event.find(filter).sort({ createdAt: -1 }).lean();
    return res.json(events);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/:id/resolve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const evt = await Event.findById(id);
    if (!evt) return res.status(404).json({ message: 'Event not found' });
    evt.status = 'Resolved';
    evt.resolvedAt = new Date();
    await evt.save();
    return res.json(evt);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/:id/ack', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const evt = await Event.findById(id);
    if (!evt) return res.status(404).json({ message: 'Event not found' });
    evt.acknowledgedAt = new Date();
    await evt.save();
    return res.json(evt);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
