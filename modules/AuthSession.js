const { Schema, model, Types } = require('mongoose');

const AuthSessionSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', index: true, required: true },
  tokenHash: { type: String, required: true },
  userAgent: String,
  ip: String,
  expiresAt: { type: Date, required: true },
  revokedAt: Date
}, { timestamps: true });

AuthSessionSchema.index({ userId: 1, tokenHash: 1 }, { unique: true });

module.exports = model('AuthSession', AuthSessionSchema);