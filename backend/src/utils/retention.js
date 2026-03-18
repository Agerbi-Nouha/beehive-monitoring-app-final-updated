import Measurement from '../models/measurement.js';
import Event from '../models/event.js';
import { getGlobalSettings } from './settingsService.js';

export function startRetentionJob() {
  const enabled = (process.env.RETENTION_ENABLED || 'true').toLowerCase() === 'true';
  if (!enabled) {
    console.log('[retention] disabled');
    return;
  }

  const intervalMs = parseInt(process.env.RETENTION_JOB_INTERVAL_MS || '', 10) || 6 * 60 * 60 * 1000;
  console.log(`[retention] job enabled, interval ${intervalMs}ms`);

  const run = async () => {
    try {
      const settings = await getGlobalSettings();
      const days = parseInt(process.env.RETENTION_DAYS || '', 10) || settings.retentionDays || 90;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const mRes = await Measurement.deleteMany({ createdAt: { $lt: cutoff } });
      const eRes = await Event.deleteMany({ createdAt: { $lt: cutoff } });

      console.log(`[retention] deleted measurements=${mRes.deletedCount} events=${eRes.deletedCount} cutoff=${cutoff.toISOString()}`);
    } catch (err) {
      console.error('[retention] error', err);
    }
  };

  run();
  setInterval(run, intervalMs);
}
