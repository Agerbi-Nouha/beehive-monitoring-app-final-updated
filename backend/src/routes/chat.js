import express from 'express';
import Measurement from '../models/measurement.js';
import Event from '../models/event.js';
import Hive from '../models/hive.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

async function getHiveSnapshot(hiveId) {
  if (!hiveId) return null;
  const hive = await Hive.findOne({ hiveId }).lean();
  const last = await Measurement.findOne({ hiveId }).sort({ createdAt: -1 }).lean();
  const alerts = await Event.find({ hiveId, status: 'Active' }).sort({ createdAt: -1 }).limit(10).lean();
  return { hive, lastMeasurement: last, activeAlerts: alerts };
}

async function callOpenAI({ apiKey, model, messages }) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, temperature: 0.2, messages }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI error: ${resp.status} ${errText}`);
  }

  const json = await resp.json();
  return json?.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
}

function formatLastMeasurement(last) {
  if (!last) return 'No live or simulated measurements are available yet for this hive.';
  return [
    `Temperature: ${last.temperature ?? '—'} °C`,
    `Humidity: ${last.humidity ?? '—'} %`,
    `Weight: ${last.weight ?? '—'} kg`,
    `Battery: ${last.battery ?? '—'} %`,
    `Light Level: ${last.light ?? '—'}`,
    `Sound Peak: ${last.soundPeakHz ?? '—'} Hz`,
    `Sound RMS: ${last.soundRms ?? '—'}`,
    `Rain: ${last.rain === 1 ? 'Detected' : 'No'}`,
    `Motion: ${last.motion === 1 ? 'Detected' : 'No'}`,
    `Flame: ${last.flame === 1 ? 'Detected' : 'No'}`,
  ].join('\n');
}

function buildFallbackReply({ message, context, hiveId, snapshot, userRole }) {
  const q = String(message || '').toLowerCase();
  const route = context?.route || 'unknown';
  const last = snapshot?.lastMeasurement;
  const alerts = snapshot?.activeAlerts || [];

  if (q.includes('summary') || q.includes('health')) {
    return `Hive summary for ${hiveId || 'the current hive'}:\n\n${formatLastMeasurement(last)}\n\nActive alerts: ${alerts.length}.`;
  }

  if (q.includes('trend') || q.includes('chart')) {
    return `On ${route}, the charts show recent sensor history.\n\nEnvironmental Conditions include Temperature, Humidity, and Light Level.\nHive Status includes Weight and Battery.\nHive Sound Activity includes Sound Peak (Hz) and Sound RMS.\nStatus Indicators summarize Rain, Motion, and Flame as event-style cards instead of continuous curves.`;
  }

  if (q.includes('unhealthy') || q.includes('why')) {
    if (!last) return 'I cannot explain the hive health yet because no measurement is available.';
    const reasons = [];
    if (typeof last.temperature === 'number' && (last.temperature < 32 || last.temperature > 36)) reasons.push(`temperature is outside the ideal brood band (${last.temperature} °C)`);
    if (typeof last.humidity === 'number' && (last.humidity < 50 || last.humidity > 70)) reasons.push(`humidity is outside the preferred range (${last.humidity} %)`);
    if (typeof last.battery === 'number' && last.battery < 50) reasons.push(`battery is getting low (${last.battery} %)`);
    if (typeof last.soundRms === 'number' && last.soundRms > 80) reasons.push(`sound activity is unusually high (${last.soundRms})`);
    if (typeof last.soundRms === 'number' && last.soundRms < 10) reasons.push(`sound activity is unusually low (${last.soundRms})`);
    if (alerts.length) reasons.push(`${alerts.length} active alert(s) are currently open`);
    if (!reasons.length) reasons.push('the last readings look mostly stable');
    return `Why ${hiveId || 'this hive'} may be unhealthy:\n- ${reasons.join('\n- ')}`;
  }

  if (q.includes('export')) {
    return 'Go to Export, choose Sensors / Alerts / History, choose the hive and time range, then download CSV or PDF. The export now uses your signed-in session automatically, so you should no longer see “Missing Authorization Bearer token”.';
  }

  if (q.includes('esp32') || q.includes('api key') || q.includes('device key')) {
    return 'To connect an ESP32: create a device key in Admin → Device Keys, assign it to Hive_01 or another live hive, then send JSON to POST /api/sensors with header x-api-key.\n\nYou can also test one sensor at a time: the backend now fills missing fields from the last measurement/default values, so a payload like {"rain":1} is accepted.';
  }

  if (q.includes('alert')) {
    return 'Alerts are grouped into three families:\n\n1. Environmental alerts: TEMP_WARNING, TEMP_DANGER, HUMIDITY_WARNING, RAIN_DETECTED.\n2. Hive health alerts: WEIGHT_DROP, LOW_SOUND_ACTIVITY, HIGH_SOUND_ACTIVITY, SOUND_ANOMALY.\n3. Danger alerts: FLAME_DETECTED, SUDDEN_SOUND_SPIKE, POSSIBLE_INTRUSION, POSSIBLE_SWARMING.\n\nSound alerts are sustained before firing to reduce spam.';
  }

  return `I can help on ${route}.\n\nRole: ${userRole}.\nSelected hive: ${hiveId || 'none'}.\n\nTry one of these:\n- Show hive health summary\n- Explain chart trends\n- Why is a hive unhealthy?\n- How to connect ESP32 live data?\n- How do exports work?`;
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const { message, context, hiveId, snapshot } = req.body || {};
    if (!message) return res.status(400).json({ message: 'message is required' });

    const userRole = req.user?.role || 'viewer';
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const serverSnapshot = snapshot || (await getHiveSnapshot(hiveId));

    if (!apiKey) {
      return res.json({ reply: buildFallbackReply({ message, context, hiveId, snapshot: serverSnapshot, userRole }), mode: 'fallback' });
    }

    const system = [
      'You are Hive Assistant for a beehive monitoring dashboard.',
      'Answer clearly and safely.',
      'Never invent sensor values. If data is missing, say so.',
      `User role: ${userRole}. Provide admin-only tips only if role=admin.`,
      'If user asks for actions, provide practical app navigation steps and beekeeping guidance.',
    ].join(' ');

    const ctx = {
      route: context?.route,
      selectedHiveId: hiveId,
      pageContext: context,
      dataSnapshot: serverSnapshot,
    };

    const messages = [
      { role: 'system', content: system },
      { role: 'system', content: `Context JSON (may be incomplete):\n${JSON.stringify(ctx).slice(0, 12000)}` },
      { role: 'user', content: String(message) },
    ];

    const reply = await callOpenAI({ apiKey, model, messages });
    return res.json({ reply, mode: 'openai' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Chat error', error: String(err.message || err) });
  }
});

export default router;
