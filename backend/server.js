import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

import sensorRoutes from './src/routes/sensors.js';
import hiveRoutes from './src/routes/hives.js';
import historyRoutes from './src/routes/history.js';
import eventRoutes from './src/routes/events.js';
import exportRoutes from './src/routes/export.js';
import authRoutes from './src/routes/auth.js';
import settingsRoutes from './src/routes/settings.js';
import devicesRoutes from './src/routes/devices.js';
import chatRoutes from './src/routes/chat.js';

import { startSimulation } from './src/utils/simulator.js';
import { startRetentionJob } from './src/utils/retention.js';
import User from './src/models/user.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: '*',
  },
});

app.set('io', io);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sensors', sensorRoutes); // device-key protected inside router
app.use('/api/hives', hiveRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/chat', chatRoutes);

// Database connection
const PORT = parseInt(process.env.PORT || '', 10) || 3001;

async function ensureSeedAdmin() {
  const enabled = (process.env.AUTO_SEED_ADMIN || 'true').toLowerCase() === 'true';
  if (!enabled) return;

  const email = (process.env.ADMIN_EMAIL || 'admin@local.dev').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin1234';

  const existing = await User.findOne({ email });
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ email, passwordHash, role: 'admin' });
  console.log(`[seed] created admin user ${email} (password: ${password})`);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connection established');

    await ensureSeedAdmin();
    startRetentionJob();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Start simulation (Hive_02..Hive_05) after DB connected
    startSimulation(io);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
