import express from 'express';
import Measurement from '../models/measurement.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/history?hiveId=Hive_01&limit=100
// Extended: start/end ISO + bucketMinutes for aggregation/downsampling
router.get('/', requireAuth, async (req, res) => {
  try {
    const { hiveId, limit = 100, start, end, bucketMinutes } = req.query;
    if (!hiveId) return res.status(400).json({ message: 'hiveId is required' });

    const filter = { hiveId: String(hiveId) };
    if (start || end) {
      filter.createdAt = {};
      if (start) filter.createdAt.$gte = new Date(start);
      if (end) filter.createdAt.$lte = new Date(end);
    }

    const bucket = bucketMinutes ? Math.max(1, Number(bucketMinutes)) : null;

    if (bucket) {
      // Aggregated time series for fast charts
      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: {
              $dateTrunc: { date: '$createdAt', unit: 'minute', binSize: bucket },
            },
            temperature: { $avg: '$temperature' },
            humidity: { $avg: '$humidity' },
            weight: { $avg: '$weight' },
            battery: { $avg: '$battery' },
            light: { $avg: '$light' },
            motion: { $max: '$motion' },
            rain: { $max: '$rain' },
            flame: { $max: '$flame' },
            lat: { $avg: '$lat' },
            lng: { $avg: '$lng' },
            soundRms: { $avg: '$soundRms' },
            soundPeakHz: { $avg: '$soundPeakHz' },
          },
        },
        { $sort: { _id: 1 } },
      ];

      const agg = await Measurement.aggregate(pipeline);
      const out = agg.map((d) => ({ createdAt: d._id, ...d, _id: undefined }));
      return res.json(out);
    }

    const records = await Measurement.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).lean();
    return res.json(records);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
