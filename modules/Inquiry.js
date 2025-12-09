// server/modules/Inquiry.js
const { Schema, model, Types } = require('mongoose');

const InquirySchema = new Schema({
  productId: { type: Types.ObjectId, ref: 'Product', index: true }, // optional now
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, lowercase: true, trim: true, index: true },
  phone:     { type: String, trim: true },
  subject:   { type: String, trim: true }, // NEW
  message:   { type: String, required: true, trim: true },
  quantity:  Number,
  status:    { type: String, enum: ['new','quoted','won','lost'], default: 'new', index: true },
  source:    { type: String, default: 'website', trim: true }, // NEW
}, { timestamps: true });

module.exports = model('Inquiry', InquirySchema);
