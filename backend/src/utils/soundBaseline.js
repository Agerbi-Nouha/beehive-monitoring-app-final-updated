import Measurement from '../models/measurement.js';

function median(values) {
  const nums = values.filter((v) => typeof v === 'number').sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

function mad(values, med) {
  const m = typeof med === 'number' ? med : median(values);
  if (typeof m !== 'number') return null;
  const deviations = values.filter((v) => typeof v === 'number').map((v) => Math.abs(v - m));
  const madVal = median(deviations);
  if (typeof madVal !== 'number') return null;
  // Convert MAD to std-like sigma (for normal dist) for easier interpretation
  return madVal * 1.4826;
}

export async function computeSoundBaseline({ hiveId, windowHours = 24, maxSamples = 800 }) {
  const since = new Date(Date.now() - windowHours * 3600 * 1000);

  const docs = await Measurement.find({
    hiveId,
    createdAt: { $gte: since },
    $or: [{ soundPeakHz: { $type: 'number' } }, { soundRms: { $type: 'number' } }],
  })
    .sort({ createdAt: -1 })
    .limit(maxSamples)
    .lean();

  const peak = docs.map((d) => d.soundPeakHz).filter((v) => typeof v === 'number');
  const rms = docs.map((d) => d.soundRms).filter((v) => typeof v === 'number');

  const medPeak = median(peak);
  const sigPeak = mad(peak, medPeak);
  const medRms = median(rms);
  const sigRms = mad(rms, medRms);

  return {
    count: docs.length,
    medianPeakHz: medPeak,
    sigmaPeakHz: sigPeak,
    medianRms: medRms,
    sigmaRms: sigRms,
  };
}

export function zscoreRobust(value, medianVal, sigmaVal) {
  if (typeof value !== 'number' || typeof medianVal !== 'number' || typeof sigmaVal !== 'number' || sigmaVal === 0) return null;
  return (value - medianVal) / sigmaVal;
}
