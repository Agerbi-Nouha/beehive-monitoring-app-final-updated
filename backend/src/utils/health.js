/*
 * health.js - Dynamic evaluation (settings-driven) + smarter sound alerts.
 */

export const SENSOR_STATUS = {
  OK: 'OK',
  WARNING: 'WARNING',
  DANGER: 'DANGER',
};

const SEVERITY_RANK = {
  [SENSOR_STATUS.OK]: 0,
  [SENSOR_STATUS.WARNING]: 1,
  [SENSOR_STATUS.DANGER]: 2,
};

function maxSeverity(a, b) {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

function inRange(value, range) {
  return typeof value === 'number' && Array.isArray(range) && value >= range[0] && value <= range[1];
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pushUnique(events, evt) {
  if (!events.some((e) => e.type === evt.type)) events.push(evt);
}

export function categorizeSensor(sensor, value, thresholds) {
  const v = asNumber(value);
  if (v === null) return SENSOR_STATUS.OK;

  if (sensor === 'motion' || sensor === 'rain') return v === 1 ? SENSOR_STATUS.WARNING : SENSOR_STATUS.OK;
  if (sensor === 'flame') return v === 1 ? SENSOR_STATUS.DANGER : SENSOR_STATUS.OK;

  const th = thresholds?.[sensor];
  if (!th) return SENSOR_STATUS.OK;

  if (th.normal && inRange(v, th.normal)) return SENSOR_STATUS.OK;
  if (Array.isArray(th.warning)) {
    for (const rng of th.warning) {
      if (inRange(v, rng)) return SENSOR_STATUS.WARNING;
    }
  }
  return SENSOR_STATUS.DANGER;
}

export function evaluateMeasurement(measurement, prevMeasurement, settings = {}, soundContext = null) {
  const thresholds = settings.thresholds || {};
  const events = [];
  const statuses = {};

  statuses.temperature = categorizeSensor('temperature', measurement.temperature, thresholds);
  if (statuses.temperature === SENSOR_STATUS.DANGER) {
    pushUnique(events, { type: 'TEMP_DANGER', severity: 'DANGER', message: `Temperature out of range: ${measurement.temperature}°C` });
  } else if (statuses.temperature === SENSOR_STATUS.WARNING) {
    pushUnique(events, { type: 'TEMP_WARNING', severity: 'WARNING', message: `Temperature warning: ${measurement.temperature}°C` });
  }

  statuses.humidity = categorizeSensor('humidity', measurement.humidity, thresholds);
  if (statuses.humidity === SENSOR_STATUS.DANGER) {
    pushUnique(events, { type: 'HUMIDITY_DANGER', severity: 'DANGER', message: `Humidity out of range: ${measurement.humidity}%` });
  } else if (statuses.humidity === SENSOR_STATUS.WARNING) {
    pushUnique(events, { type: 'HUMIDITY_WARNING', severity: 'WARNING', message: `Humidity warning: ${measurement.humidity}%` });
  }

  statuses.battery = categorizeSensor('battery', measurement.battery, thresholds);
  if (statuses.battery === SENSOR_STATUS.DANGER) {
    pushUnique(events, { type: 'LOW_BATTERY', severity: 'DANGER', message: `Battery critically low: ${measurement.battery}%` });
  } else if (statuses.battery === SENSOR_STATUS.WARNING) {
    pushUnique(events, { type: 'BATTERY_WARNING', severity: 'WARNING', message: `Battery warning: ${measurement.battery}%` });
  }

  statuses.light = categorizeSensor('light', measurement.light, thresholds);
  if (statuses.light === SENSOR_STATUS.DANGER) {
    pushUnique(events, { type: 'LIGHT_DANGER', severity: 'DANGER', message: `Light level out of range: ${measurement.light}` });
  } else if (statuses.light === SENSOR_STATUS.WARNING) {
    pushUnique(events, { type: 'LIGHT_WARNING', severity: 'WARNING', message: `Light level warning: ${measurement.light}` });
  }

  statuses.motion = categorizeSensor('motion', measurement.motion, thresholds);
  if (statuses.motion === SENSOR_STATUS.WARNING) {
    pushUnique(events, { type: 'MOTION_DETECTED', severity: 'WARNING', message: 'Movement detected near hive' });
  }

  statuses.rain = categorizeSensor('rain', measurement.rain, thresholds);
  if (statuses.rain === SENSOR_STATUS.WARNING) {
    pushUnique(events, { type: 'RAIN_DETECTED', severity: 'WARNING', message: 'Rain detected near hive' });
  }

  statuses.flame = categorizeSensor('flame', measurement.flame, thresholds);
  if (statuses.flame === SENSOR_STATUS.DANGER) {
    pushUnique(events, { type: 'FLAME_DETECTED', severity: 'DANGER', message: 'Fire detected near hive' });
  }

  statuses.weight = SENSOR_STATUS.OK;
  const weightDropDangerKg = thresholds?.weight?.dropDangerKg ?? 2.0;
  if (prevMeasurement && typeof prevMeasurement.weight === 'number' && typeof measurement.weight === 'number') {
    const weightDrop = prevMeasurement.weight - measurement.weight;
    if (weightDrop > weightDropDangerKg) {
      statuses.weight = SENSOR_STATUS.DANGER;
      pushUnique(events, { type: 'WEIGHT_DROP', severity: 'DANGER', message: `Weight dropped by ${weightDrop.toFixed(2)} kg` });
    }
  }
  const weightRange = thresholds?.weight?.range || [5, 60];
  if (typeof measurement.weight === 'number' && (measurement.weight < weightRange[0] || measurement.weight > weightRange[1])) {
    statuses.weight = maxSeverity(statuses.weight, SENSOR_STATUS.WARNING);
    pushUnique(events, { type: 'WEIGHT_OUT_OF_RANGE', severity: 'WARNING', message: `Weight out of range: ${measurement.weight} kg` });
  }

  statuses.sound = SENSOR_STATUS.OK;
  const hasSound = typeof measurement.soundPeakHz === 'number' || typeof measurement.soundRms === 'number';
  if (hasSound) {
    const soundTh = thresholds?.sound || {};
    const peakRange = soundTh.peakHzNormal || [200, 700];
    const peakAlertHz = soundTh.peakAlertHz ?? 900;
    const suddenPeakDeltaHz = soundTh.suddenPeakDeltaHz ?? 300;
    const rmsLow = soundTh.rmsLow ?? 10;
    const rmsHigh = soundTh.rmsHigh ?? 80;
    const sigmaWarn = soundTh.sigmaWarning ?? 2.5;
    const sigmaDanger = soundTh.sigmaDanger ?? 4.0;
    const correlation = soundTh.correlation || {};

    const motion = measurement.motion === 1;
    const rain = measurement.rain === 1;
    const isNight = !!soundContext?.isNight;
    const weightDropKg = soundContext?.weightDropKg ?? 0;
    const suddenPeakDelta = soundContext?.suddenPeakDeltaHz ?? 0;
    const peakHzZ = Math.abs(soundContext?.peakHzZ ?? 0);
    const rmsZ = Math.abs(soundContext?.rmsZ ?? 0);
    const sustainedWarning = !!soundContext?.sustainedWarning;
    const sustainedDanger = !!soundContext?.sustainedDanger;

    let soundSeverity = SENSOR_STATUS.OK;
    let anomalyReason = '';

    if (typeof measurement.soundRms === 'number' && measurement.soundRms < rmsLow && sustainedWarning) {
      soundSeverity = maxSeverity(soundSeverity, SENSOR_STATUS.WARNING);
      pushUnique(events, {
        type: 'LOW_SOUND_ACTIVITY',
        severity: 'WARNING',
        message: `Low hive activity detected (RMS ${measurement.soundRms.toFixed(1)})`,
      });
      anomalyReason = 'low activity';
    }

    if (typeof measurement.soundRms === 'number' && measurement.soundRms > rmsHigh && sustainedWarning) {
      soundSeverity = maxSeverity(soundSeverity, SENSOR_STATUS.WARNING);
      pushUnique(events, {
        type: 'HIGH_SOUND_ACTIVITY',
        severity: 'WARNING',
        message: `High hive activity detected (RMS ${measurement.soundRms.toFixed(1)})`,
      });
      anomalyReason = 'high activity';
    }

    const peakOutsideNormal = typeof measurement.soundPeakHz === 'number' && !inRange(measurement.soundPeakHz, peakRange);
    const peakVeryHigh = typeof measurement.soundPeakHz === 'number' && measurement.soundPeakHz > peakAlertHz;
    const suddenSpike = peakVeryHigh || suddenPeakDelta > suddenPeakDeltaHz;

    if (peakOutsideNormal || peakHzZ > sigmaWarn || rmsZ > sigmaWarn || sustainedWarning) {
      soundSeverity = maxSeverity(soundSeverity, SENSOR_STATUS.WARNING);
      anomalyReason = anomalyReason || 'anomaly';
    }

    if (peakHzZ > sigmaDanger || rmsZ > sigmaDanger || sustainedDanger) {
      soundSeverity = SENSOR_STATUS.DANGER;
      anomalyReason = anomalyReason || 'major anomaly';
    }

    if (suddenSpike) {
      soundSeverity = SENSOR_STATUS.DANGER;
      pushUnique(events, {
        type: 'SUDDEN_SOUND_SPIKE',
        severity: 'DANGER',
        message: typeof measurement.soundPeakHz === 'number'
          ? `Sudden noise detected near hive (peak ${measurement.soundPeakHz.toFixed(0)} Hz)`
          : 'Sudden noise detected near hive',
      });
      anomalyReason = 'sudden spike';
    }

    if (soundSeverity !== SENSOR_STATUS.OK) {
      const reduceWhenRain = correlation.reduceWhenRain !== false;
      const useMotionAtNight = correlation.useMotionAtNight !== false;
      const useWeightDrop = correlation.useWeightDrop !== false;
      const useTempHumidity = correlation.useTempHumidity !== false;

      if (reduceWhenRain && rain && soundSeverity === SENSOR_STATUS.WARNING) {
        soundSeverity = SENSOR_STATUS.OK;
      }

      if (useTempHumidity && (statuses.temperature !== SENSOR_STATUS.OK || statuses.humidity !== SENSOR_STATUS.OK) && soundSeverity === SENSOR_STATUS.WARNING) {
        soundSeverity = SENSOR_STATUS.DANGER;
      }

      if (useMotionAtNight && motion && isNight && soundSeverity !== SENSOR_STATUS.OK) {
        soundSeverity = SENSOR_STATUS.DANGER;
        pushUnique(events, {
          type: 'POSSIBLE_INTRUSION',
          severity: 'DANGER',
          message: 'Sound anomaly correlated with motion detected at night',
        });
      }

      if (useWeightDrop && weightDropKg > weightDropDangerKg && soundSeverity !== SENSOR_STATUS.OK) {
        soundSeverity = SENSOR_STATUS.DANGER;
        pushUnique(events, {
          type: 'POSSIBLE_SWARMING',
          severity: 'DANGER',
          message: `Sound anomaly correlated with weight drop (${weightDropKg.toFixed(2)} kg)`,
        });
      }

      statuses.sound = soundSeverity;
      pushUnique(events, {
        type: 'SOUND_ANOMALY',
        severity: soundSeverity === SENSOR_STATUS.DANGER ? 'DANGER' : 'WARNING',
        message: `Unusual hive sound activity detected${anomalyReason ? ` (${anomalyReason})` : ''}`,
      });
    }
  }

  const weights = { temperature: 0.4, humidity: 0.25, weight: 0.2, battery: 0.15 };
  const scores = {
    temperature: statuses.temperature === SENSOR_STATUS.OK ? 100 : statuses.temperature === SENSOR_STATUS.WARNING ? 50 : 0,
    humidity: statuses.humidity === SENSOR_STATUS.OK ? 100 : statuses.humidity === SENSOR_STATUS.WARNING ? 50 : 0,
    weight: statuses.weight === SENSOR_STATUS.OK ? 100 : statuses.weight === SENSOR_STATUS.WARNING ? 50 : 0,
    battery: statuses.battery === SENSOR_STATUS.OK ? 100 : statuses.battery === SENSOR_STATUS.WARNING ? 50 : 0,
  };

  let health = 0;
  for (const key of Object.keys(weights)) health += scores[key] * weights[key];
  health = Math.round(health);

  return { health, statuses, events };
}
