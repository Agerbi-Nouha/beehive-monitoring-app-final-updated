import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    hiveId: { type: String, required: true },
    type: { type: String, required: true },
    severity: { type: String, enum: ['OK', 'WARNING', 'DANGER'], required: true },
    message: { type: String, required: true },

    status: { type: String, enum: ['Active', 'Resolved'], default: 'Active' },
    resolvedAt: { type: Date },
    acknowledgedAt: { type: Date },
    lastNotifiedAt: { type: Date },
  },
  { timestamps: true }
);

eventSchema.index({ hiveId: 1, type: 1, status: 1, createdAt: -1 });

export default mongoose.model('Event', eventSchema);
