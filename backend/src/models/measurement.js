import mongoose from 'mongoose';

const measurementSchema = new mongoose.Schema(
  {
    hiveId: { type: String, required: true },
    temperature: { type: Number, required: true }, // °C
    humidity: { type: Number, required: true }, // % RH
    weight: { type: Number, required: true }, // kg
    battery: { type: Number, required: true }, // %
    light: { type: Number, required: true }, // lux or relative brightness
    motion: { type: Number, required: true }, // 0/1
    rain: { type: Number, required: true }, // 0/1
    flame: { type: Number, required: true }, // 0/1
    lat: { type: Number },
    lng: { type: Number },

    // Microphone / sound features (no raw audio)
    soundRms: { type: Number },
    soundPeakHz: { type: Number },
    soundBands: { type: [Number] },
  },
  { timestamps: true }
);

export default mongoose.model('Measurement', measurementSchema);
