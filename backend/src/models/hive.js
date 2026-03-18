import mongoose from 'mongoose';

const hiveSchema = new mongoose.Schema(
  {
    hiveId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, default: '' },
    lat: { type: Number },
    lng: { type: Number },
    notes: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Hive', hiveSchema);
