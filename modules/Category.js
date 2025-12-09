const { Schema, model, Types } = require('mongoose');

const CategorySchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  description: String,
  parentId: { type: Types.ObjectId, ref: 'Category' },
  image: String,
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = model('Category', CategorySchema);