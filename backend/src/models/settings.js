import mongoose from 'mongoose';

const defaultThresholds = {
  temperature: { normal: [32, 36], warning: [[30, 32], [36, 38]] },
  humidity: { normal: [50, 70], warning: [[40, 50], [70, 80]] },
  battery: { normal: [50, 100], warning: [[20, 50]] },
  light: { normal: [0, 300], warning: [[300, 1000]] },
  weight: { range: [5, 60], dropDangerKg: 2.0 },
  sound: {
    peakHzNormal: [200, 700],
    peakAlertHz: 900,
    suddenPeakDeltaHz: 300,
    rmsLow: 10,
    rmsNormal: [10, 60],
    rmsHigh: 80,
    sigmaWarning: 2.5,
    sigmaDanger: 4.0,
    baselineWindowHours: 24,
    sustainedSeconds: 30,
    correlation: {
      useMotionAtNight: true,
      useWeightDrop: true,
      useTempHumidity: true,
      reduceWhenRain: true,
    },
  },
};

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'global' },
    themeDefault: { type: String, enum: ['light', 'dark'], default: 'light' },
    alertCooldownMs: { type: Number, default: 300000 },
    retentionDays: { type: Number, default: 90 },
    notifications: {
      enabled: { type: Boolean, default: false },
      email: { type: String, default: '' },
      webhookUrl: { type: String, default: '' },
    },
    thresholds: { type: mongoose.Schema.Types.Mixed, default: defaultThresholds },
  },
  { timestamps: true }
);

export const Settings = mongoose.model('Settings', settingsSchema);

const hiveSettingsSchema = new mongoose.Schema(
  {
    hiveId: { type: String, required: true, unique: true, trim: true },
    thresholds: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const HiveSettings = mongoose.model('HiveSettings', hiveSettingsSchema);

export function getDefaultThresholds() {
  return defaultThresholds;
}
