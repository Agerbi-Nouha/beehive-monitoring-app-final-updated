import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';
import { Settings, getDefaultThresholds } from '../models/settings.js';

dotenv.config();

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Missing MONGO_URI in environment');
    process.exit(1);
  }

  const email = (process.env.ADMIN_EMAIL || 'admin@local.dev').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin1234';

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`User already exists: ${email}`);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ email, passwordHash, role: 'admin' });
    console.log(`Created admin user: ${email} (password: ${password})`);
  }

  const s = await Settings.findOne({ key: 'global' });
  if (!s) {
    await Settings.create({ key: 'global', thresholds: getDefaultThresholds() });
    console.log('Created default global settings');
  }

  await mongoose.disconnect();
  console.log('Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
