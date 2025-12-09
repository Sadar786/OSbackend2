// server/routes/blog.js
const express = require("express");
const { body, validationResult } = require("express-validator");
const BlogPost = require("../modules/BlogPost");

const router = express.Router();

/* ============ Public ============ */
// Public list (only published)
router.get("/posts", async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "9", 10)));
    const q   = (req.query.q || "").trim();
    const tag = (req.query.tag || "").trim();

    const filter = { status: "published" };
    if (q)   filter.$text = { $search: q };
    if (tag) filter.tags = tag;

    const [items, total] = await Promise.all([
      BlogPost.find(filter)
        .select("title slug excerpt coverImage tags publishedAt readingTime createdAt")
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BlogPost.countDocuments(filter),
    ]);

    res.json({ ok: true, items, page, total, pages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get("/posts/:slug", async (req, res) => {
  try {
    const item = await BlogPost.findOne({ slug: req.params.slug, status: "published" }).lean();
    if (!item) return res.status(404).json({ ok: false, error: "Not found" });

    BlogPost.updateOne({ _id: item._id }, { $inc: { views: 1 } }).exec();
    res.json({ ok: true, item });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ============ Admin ============ */
// List all (any status) for admin UI
router.get("/admin/posts", async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const q   = (req.query.q || "").trim();
    const tag = (req.query.tag || "").trim();
    const status = (req.query.status || "").trim(); // optional filter

    const filter = {};
    if (q) filter.$text = { $search: q };
    if (tag) filter.tags = tag;
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      BlogPost.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BlogPost.countDocuments(filter),
    ]);

    res.json({ ok: true, items, page, total, pages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Create
router.post(
  "/posts",
  body("title").isLength({ min: 3 }),
  body("slug").isSlug(),
  body("content").isLength({ min: 20 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });
    try {
      const created = await BlogPost.create({ ...req.body /*, authorId: req.user._id*/ });
      res.status(201).json({ ok: true, item: created });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

// Update
router.put(
  "/posts/:id",
  body("title").optional().isLength({ min: 3 }),
  body("slug").optional().isSlug(),
  body("content").optional().isLength({ min: 20 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });
    try {
      const updated = await BlogPost.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updated) return res.status(404).json({ ok: false, error: "Not found" });
      res.json({ ok: true, item: updated });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

// Delete
router.delete("/posts/:id", async (req, res) => {
  try {
    const deleted = await BlogPost.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
