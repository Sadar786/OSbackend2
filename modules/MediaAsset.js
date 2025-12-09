// optional


const { Schema, model } = require('mongoose');

const MediaAssetSchema = new Schema({
  publicId: { type: String, index: true },
  url: String,
  width: Number,
  height: Number,
  format: String,
  folder: String,
  bytes: Number,
  alt: String,
  tags: [String]
}, { timestamps: true });

module.exports = model('MediaAsset', MediaAssetSchema);