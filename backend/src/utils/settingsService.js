import { Settings, HiveSettings, getDefaultThresholds } from '../models/settings.js';

function deepMerge(base, override) {
  if (override === null || typeof override === 'undefined') return base;
  if (Array.isArray(base) && Array.isArray(override)) return override;
  if (typeof base === 'object' && base && typeof override === 'object' && override) {
    const out = { ...base };
    for (const key of Object.keys(override)) {
      out[key] = deepMerge(base?.[key], override[key]);
    }
    return out;
  }
  return override;
}

export async function getGlobalSettings() {
  let settings = await Settings.findOne({ key: 'global' }).lean();
  if (!settings) {
    settings = await Settings.create({ key: 'global', thresholds: getDefaultThresholds() });
    settings = settings.toObject();
  }
  return settings;
}

export async function getEffectiveSettings(hiveId) {
  const global = await getGlobalSettings();
  const hive = hiveId ? await HiveSettings.findOne({ hiveId }).lean() : null;
  if (!hive || !hive.thresholds) return global;
  return {
    ...global,
    thresholds: deepMerge(global.thresholds || {}, hive.thresholds || {}),
  };
}

export { deepMerge };
