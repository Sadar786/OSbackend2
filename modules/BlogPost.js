const { Schema, model } = require("mongoose");

const BlogPostSchema = new Schema({
  title:       { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true, index: true, trim: true },
  excerpt:     { type: String, trim: true },
  content:     { type: String, required: true },                 // store HTML (sanitized on admin)
  coverImage:  { type: String, trim: true },
  tags:        [{ type: String, index: true }],
  status:      { type: String, enum: ["draft","published","archived"], default: "draft", index: true },
  publishedAt: { type: Date, index: true },
  readingTime: { type: Number },
  seo: {
    title:       { type: String, trim: true },
    description: { type: String, trim: true },
    ogImage:     { type: String, trim: true },
  },
  views: { type: Number, default: 0 },
}, { timestamps: true });

BlogPostSchema.index({ title: "text", content: "text" });

function computeReadingTime(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

BlogPostSchema.pre("save", function(next) {
  if (this.isModified("content")) this.readingTime = computeReadingTime(this.content);
  if (this.status === "published" && !this.publishedAt) this.publishedAt = new Date();
  next();
});

BlogPostSchema.pre("findOneAndUpdate", function(next) {
  const update = this.getUpdate() || {};
  const content = update.content || update.$set?.content;
  const status  = update.status || update.$set?.status;

  if (typeof content === "string") {
    const rt = computeReadingTime(content);
    this.setUpdate({ ...update, $set: { ...(update.$set || {}), readingTime: rt } });
  }
  if (status === "published" && !update.publishedAt && !update.$set?.publishedAt) {
    this.setUpdate({ ...this.getUpdate(), $set: { ...(update.$set || {}), publishedAt: new Date() } });
  }
  next();
});

module.exports = model("BlogPost", BlogPostSchema);
