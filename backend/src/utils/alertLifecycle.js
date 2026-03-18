import Event from '../models/event.js';

export async function upsertActiveEvent({ hiveId, type, severity, message, cooldownMs }) {
  const now = new Date();
  const active = await Event.findOne({ hiveId, type, status: 'Active' }).sort({ createdAt: -1 });

  if (active) {
    const lastNotifiedAt = active.lastNotifiedAt || active.createdAt;
    const canNotify = !cooldownMs || now.getTime() - new Date(lastNotifiedAt).getTime() >= cooldownMs;

    active.severity = severity;
    active.message = message;
    if (canNotify) active.lastNotifiedAt = now;

    await active.save();
    return { created: false, event: active, notified: canNotify };
  }

  const created = await Event.create({
    hiveId,
    type,
    severity,
    message,
    status: 'Active',
    lastNotifiedAt: now,
  });
  return { created: true, event: created, notified: true };
}

export async function resolveInactiveEvents({ hiveId, stillActiveTypes = [] }) {
  const now = new Date();
  const activeEvents = await Event.find({ hiveId, status: 'Active' });
  const toResolve = activeEvents.filter((e) => !stillActiveTypes.includes(e.type));
  for (const e of toResolve) {
    e.status = 'Resolved';
    e.resolvedAt = now;
    await e.save();
  }
  return { resolved: toResolve.length };
}
