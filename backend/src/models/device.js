import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, trim: true },
    hiveId: { type: String, required: true, trim: true },
    apiKeyHash: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    label: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Device', deviceSchema);
