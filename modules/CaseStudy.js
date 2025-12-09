// server/modules/CaseStudy.js
const { Schema, model } = require("mongoose");

/* helpers */
function estimateReadingMinutes(txt) {
  if (!txt) return 1;
  const s = String(txt).replace(/<[^>]+>/g, " ");         // strip HTML tags
  const words = s.trim().split(/\s+/).filter(Boolean).length;
  const wpm = 200;
  return Math.max(1, Math.ceil(words / wpm));
}

const GalleryItemSchema = new Schema({
  url: { type: String, required: true, trim: true },
  alt: { type: String, trim: true },
}, { _id: false });

const CaseStudySchema = new Schema({
  title: { type: String, required: true, trim: true },
  slug:  { type: String, required: true, unique: true, index: true, trim: true },

  client: { type: String, trim: true },

  subtitle:   { type: String, trim: true },
  heroImage:  { type: String, trim: true },
  gallery:    { type: [GalleryItemSchema], default: [] },

  tags:       [{ type: String, trim: true }],
  summary:    { type: String, trim: true },
  content:    { type: String }, // markdown/HTML allowed

  // derived
  readingMinutes: { type: Number, default: 1 },

  // SEO
  seoTitle:       { type: String, trim: true },
  seoDescription: { type: String, trim: true },
  canonicalUrl:   { type: String, trim: true },
  ogImage:        { type: String, trim: true },

  // publish workflow
  published:   { type: Boolean, default: false },
  publishedAt: { type: Date },

  // optional ordering
  order: { type: Number, default: 0 },

  // metrics
  metrics: {
    views: { type: Number, default: 0 },
    leads: { type: Number, default: 0 },
  },
}, { timestamps: true });

CaseStudySchema.pre("save", function(next) {
  // reading time
  this.readingMinutes = estimateReadingMinutes(this.content);
  // publish timestamp
  if (this.published && !this.publishedAt) this.publishedAt = new Date();
  if (!this.published) this.publishedAt = null;
  // og default
  if (!this.ogImage && this.heroImage) this.ogImage = this.heroImage;
  next();
});

// simple text search (optional)
CaseStudySchema.index({ title: "text", summary: "text", content: "text", client: "text" });

module.exports = model("CaseStudy", CaseStudySchema);
module.exports.estimateReadingMinutes = estimateReadingMinutes; // reuse in routes
