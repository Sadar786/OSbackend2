// server/modules/Product.js
const { Schema, model, Types } = require('mongoose');

const ImageSchema = new Schema({
  url:     { type: String, required: true, trim: true },
  alt:     { type: String, trim: true },
  width:   { type: Number },
  height:  { type: Number },
  publicId:{ type: String, trim: true },
}, { _id: false });

const SpecSchema = new Schema({
  key:   { type: String, trim: true },
  value: { type: String, trim: true }
}, { _id: false });

const ProductSchema = new Schema({
  name:       { type: String, required: true, trim: true },
  slug:       { type: String, required: true, unique: true, index: true },
  sku:        { type: String, trim: true, index: true },
  status:     { type: String, enum: ['draft','published','archived'], default: 'draft', index: true },
  categoryId: { type: Types.ObjectId, ref: 'Category', index: true },

  // ✅ use ImageSchema & default to []
  images:     { type: [ImageSchema], default: [] },

  summary:    String,
  description:String,
  specs:      [SpecSchema],
  price:      Number,
  currency:   { type: String, default: 'AED' },
  tags:       [{ type: String, index: true }],
  featured:   { type: Boolean, default: false },
  sortOrder:  { type: Number, default: 0 },
  seo: {
    title: String,
    description: String,
    ogImage: String
  },
  publishedAt: Date
}, { timestamps: true });

// (Optional) Backward-compat if some old docs used plain string URLs
ProductSchema.pre('save', function(next) {
  if (Array.isArray(this.images)) {
    this.images = this.images.map(img =>
      typeof img === 'string' ? { url: img, publicId: '' } : img
    );
  }
  next();
});

module.exports = model('Product', ProductSchema);
