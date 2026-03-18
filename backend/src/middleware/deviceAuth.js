import Device from '../models/device.js';
import { hashApiKey } from '../utils/crypto.js';

export async function requireDeviceApiKey(req, res, next) {
  try {
    const apiKey = req.header('x-api-key');
    if (!apiKey) return res.status(401).json({ message: 'Missing x-api-key header' });

    const apiKeyHash = hashApiKey(apiKey);
    const device = await Device.findOne({ apiKeyHash, enabled: true }).lean();
    if (!device) return res.status(401).json({ message: 'Invalid or disabled device API key' });

    req.device = device;
    req.deviceHiveId = device.hiveId;
    return next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
