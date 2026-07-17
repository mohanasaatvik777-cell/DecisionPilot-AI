const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset' },
  sessionId: String,
  kpis: mongoose.Schema.Types.Mixed,
  chartData: mongoose.Schema.Types.Mixed,
  forecasts: mongoose.Schema.Types.Mixed,
  anomalies: [mongoose.Schema.Types.Mixed],
  insights: [String],
  recommendations: [String],
  industry: String,
  dataQualityNotes: [String],
  generatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

reportSchema.index({ sessionId: 1 });
reportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Report', reportSchema);
