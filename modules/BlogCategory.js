const { Schema, model } = require("mongoose");

const BlogCategorySchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  description: String,
  image: String,
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = model("BlogCategory", BlogCategorySchema);
