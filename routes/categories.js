// server/routes/categories.js
const express = require("express");
const { body, param, validationResult } = require("express-validator");
const Category = require("../modules/Category");

// Guards (make them no-ops if not present, same pattern you used)
const requireAuth = require("../middleware/requireAuth");
let requireAdmin;
try { requireAdmin = require("../middleware/requireAdmin"); }
catch { requireAdmin = (_req, _res, next) => next(); }

const router = express.Router();

/* -------------------------- Helpers -------------------------- */
function slugify(s = "") {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Try by ObjectId first, then by slug
async function findByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null;
  let doc = null;
  try { doc = await Category.findById(idOrSlug); if (doc) return doc; } catch {}
  return Category.findOne({ slug: idOrSlug });
}

/* -------------------------- Routes -------------------------- */

// GET /api/categories  (public)
// ?withCounts=1 to include product counts (requires Product.categoryId or Product.categories)
router.get("/", async (req, res) => {
  try {
    const withCounts = String(req.query.withCounts || "") === "1";

    if (!withCounts) {
      const items = await Category.find()
        .select("name slug description parentId image order createdAt updatedAt")
        .sort({ order: 1, name: 1 })
        .lean();
      return res.json({ ok: true, items });
    }

    // OPTIONAL: counts via aggregation (adjust the join field to your Product schema)
    // If your Product has `categoryId: ObjectId`, use this:
    const Product = require("../modules/Product");
    const items = await Category.aggregate([
      { $sort: { order: 1, name: 1 } },
      {
        $lookup: {
          from: Product.collection.name,
          let: { catId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$categoryId", "$$catId"] } } },
            { $count: "count" }
          ],
          as: "prodCount"
        }
      },
      {
        $addFields: {
          count: { $ifNull: [{ $arrayElemAt: ["$prodCount.count", 0] }, 0] }
        }
      },
      { $project: { prodCount: 0 } }
    ]);

    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/categories  (admin)
router.post(
  "/",
  requireAuth,
  requireAdmin,
  [body("name").isString().trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      const { name, description, parentId, image, order } = req.body;
      const slug = slugify(req.body.slug || name);
      const doc = await Category.create({
        name,
        slug,
        description: description || "",
        parentId: parentId || undefined,
        image: image || "",
        order: Number.isFinite(+order) ? +order : 0,
      });
      res.status(201).json({ ok: true, item: doc });
    } catch (e) {
      if (e?.code === 11000 && e?.keyPattern?.slug) {
        return res.status(409).json({ ok: false, error: "Slug must be unique" });
      }
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

// PATCH /api/categories/:idOrSlug  (admin)
router.patch(
  "/:idOrSlug",
  requireAuth,
  requireAdmin,
  [param("idOrSlug").isString()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      const existing = await findByIdOrSlug(req.params.idOrSlug);
      if (!existing) return res.status(404).json({ ok: false, error: "Category not found" });

      const update = { ...req.body };
      if (update.name && !update.slug) update.slug = slugify(update.name);
      if (typeof update.order !== "undefined") update.order = +update.order || 0;

      const saved = await Category.findByIdAndUpdate(existing._id, update, {
        new: true,
        runValidators: true,
      });
      res.json({ ok: true, item: saved });
    } catch (e) {
      if (e?.code === 11000 && e?.keyPattern?.slug) {
        return res.status(409).json({ ok: false, error: "Slug must be unique" });
      }
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

// DELETE /api/categories/:idOrSlug  (admin)
router.delete(
  "/:idOrSlug",
  requireAuth,
  requireAdmin,
  [param("idOrSlug").isString()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      const existing = await findByIdOrSlug(req.params.idOrSlug);
      if (!existing) return res.status(404).json({ ok: false, error: "Category not found" });

      await Category.deleteOne({ _id: existing._id });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

module.exports = router;
