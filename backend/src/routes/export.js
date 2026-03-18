import express from 'express';
import Measurement from '../models/measurement.js';
import Event from '../models/event.js';
import Hive from '../models/hive.js';
import { Parser as Json2CsvParser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function parseRange(start, end) {
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  return { startDate, endDate };
}

function applyDateFilter(filter, startDate, endDate) {
  if (startDate || endDate) {
    filter.createdAt = filter.createdAt || {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lte = endDate;
  }
  return filter;
}

function stats(values) {
  const nums = values.filter((v) => typeof v === 'number');
  if (!nums.length) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((s, v) => s + v, 0) / nums.length;
  return { min, max, avg };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { type = 'Sensors', hiveId, format = 'csv', start, end } = req.query;
    if (!hiveId) return res.status(400).json({ message: 'hiveId is required' });

    const { startDate, endDate } = parseRange(start, end);

    let data = [];
    if (type === 'Sensors' || type === 'History') {
      const filter = applyDateFilter({ hiveId: String(hiveId) }, startDate, endDate);
      data = await Measurement.find(filter).sort({ createdAt: 1 }).lean();
    } else if (type === 'Alerts') {
      const filter = applyDateFilter({ hiveId: String(hiveId) }, startDate, endDate);
      data = await Event.find(filter).sort({ createdAt: 1 }).lean();
    } else {
      return res.status(400).json({ message: 'Unknown export type' });
    }

    if (format.toLowerCase() === 'csv') {
      const parser = new Json2CsvParser({ fields: Object.keys(data[0] || {}) });
      const csv = parser.parse(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${type.toLowerCase()}_${hiveId}.csv`);
      return res.send(csv);
    }

    if (format.toLowerCase() === 'pdf') {
      const hive = await Hive.findOne({ hiveId: String(hiveId) }).lean();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${type.toLowerCase()}_${hiveId}.pdf`);

      const doc = new PDFDocument({ margin: 40 });
      doc.pipe(res);

      doc.fontSize(18).text('Beehive Monitor Export', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Type: ${type}`);
      doc.text(`Hive: ${hive?.name || hiveId} (${hiveId})`);
      if (hive?.lat != null && hive?.lng != null) doc.text(`Location: ${hive.lat}, ${hive.lng}`);
      if (startDate || endDate) doc.text(`Range: ${startDate ? startDate.toISOString() : '—'} to ${endDate ? endDate.toISOString() : '—'}`);
      doc.moveDown();

      if (type === 'Sensors' || type === 'History') {
        const tempStats = stats(data.map((d) => d.temperature));
        const humStats = stats(data.map((d) => d.humidity));
        const weightStats = stats(data.map((d) => d.weight));
        const batStats = stats(data.map((d) => d.battery));
        const soundStats = stats(data.map((d) => d.soundPeakHz));

        doc.fontSize(14).text('Summary');
        doc.fontSize(11);
        const lines = [
          ['Temperature (°C)', tempStats],
          ['Humidity (%RH)', humStats],
          ['Weight (kg)', weightStats],
          ['Battery (%)', batStats],
          ['Sound Peak (Hz)', soundStats],
        ];
        for (const [label, st] of lines) {
          if (!st) continue;
          doc.text(`${label}: min ${st.min.toFixed(2)} | avg ${st.avg.toFixed(2)} | max ${st.max.toFixed(2)}`);
        }

        doc.moveDown();
        doc.fontSize(14).text('Measurements (first 200 rows)');
        doc.fontSize(9);
        const slice = data.slice(0, 200);
        for (const row of slice) {
          doc.text(`${new Date(row.createdAt).toLocaleString()}  T:${row.temperature}  H:${row.humidity}  W:${row.weight}  B:${row.battery}  L:${row.light}  M:${row.motion}  R:${row.rain}  F:${row.flame}  Hz:${row.soundPeakHz ?? '—'} RMS:${row.soundRms ?? '—'}`);
        }
        if (data.length > slice.length) {
          doc.moveDown();
          doc.text(`... (${data.length - slice.length} more rows not shown)`);
        }
      } else if (type === 'Alerts') {
        doc.fontSize(14).text('Alerts');
        doc.fontSize(10);
        const slice = data.slice(0, 300);
        for (const e of slice) {
          doc.text(`${new Date(e.createdAt).toLocaleString()}  [${e.status}] ${e.severity} ${e.type} - ${e.message}`);
        }
        if (data.length > slice.length) {
          doc.moveDown();
          doc.text(`... (${data.length - slice.length} more rows not shown)`);
        }
      }

      doc.end();
      return;
    }

    // default json
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
