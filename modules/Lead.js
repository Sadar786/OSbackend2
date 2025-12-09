// server/modules/Lead.js
const { Schema, model } = require('mongoose');

const LeadSchema = new Schema({
  name:   { type: String, required: true, trim: true },
  email:  { type: String, required: true, lowercase: true, trim: true, index: true },
  phone:  { type: String, trim: true },
  message:{ type: String, trim: true }, // optional for admin-created
  source: { type: String, default: 'website', trim: true },
  status: { type: String, enum: ['new','contacted','converted'], default: 'new', index: true },
  avatar: {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true }, // if your uploader returns it
  },
}, { timestamps: true });

module.exports = model('Lead', LeadSchema);


