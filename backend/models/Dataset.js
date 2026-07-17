const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema({
  name: String,
  originalName: String,
  type: { type: String, enum: ['date', 'numeric', 'categorical', 'identifier', 'text'] },
  userConfirmed: { type: Boolean, default: false },
  nullCount: { type: Number, default: 0 },
  uniqueCount: { type: Number, default: 0 },
  sampleValues: [mongoose.Schema.Types.Mixed],
}, { _id: false });

const datasetSchema = new mongoose.Schema({
  userId: { type: String, default: 'anonymous' },
  sessionId: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: Number,
  rowCount: Number,
  columnCount: Number,
  schema: [columnSchema],
  industry: { type: String, default: 'unknown' },
  skippedRows: { type: Number, default: 0 },
  dataQualityNotes: [String],
  uploadedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

datasetSchema.index({ sessionId: 1 });
datasetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Dataset', datasetSchema);
