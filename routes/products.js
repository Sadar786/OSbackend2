// server/routes/products.js
const express = require("express");
const { query, validationResult, body, param } = require("express-validator");
const Product = require("../modules/Product");
const Category = require("../modules/Category");

// Helpers & guards
const { deleteImage } = require("../utils/deleteImage");
const requireAuth = require("../middleware/requireAuth");
let requireAdmin;
try {
  requireAdmin = require("../middleware/requireAdmin");
} catch {
  requireAdmin = (_req, _res, next) => next();
}

const router = express.Router();

/* -------------------------- Utilities -------------------------- */
async function findByIdOrSlug(idOrSlug, includeUnpublished = false) {
  if (!idOrSlug) return null;
  // Try by ObjectId first, then by slug
  let doc = null;
  try {
    doc = await Product.findById(idOrSlug);
    if (doc) return doc;
  } catch {}
  const filter = { slug: idOrSlug };
  if (!includeUnpublished) filter.status = "published";
  return Product.findOne(filter);
}

/* ================================================================
   PUBLIC ROUTES (for storefront)
================================================================ */

// server/routes/products.js
router.get(
  "/",
  [
    query("limit").optional().toInt(),
    query("page").optional().toInt(),
    query("category").optional().trim(),
    query("q").optional().trim(),
    query("sort").optional().trim(),
    query("fields").optional().trim(), // NEW
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const page = Math.max(1, req.query.page || 1);
    const limit = Math.min(50, Math.max(1, req.query.limit || 12));
    const q = req.query.q || "";
    const categorySlug = req.query.category || "";
    const sort = req.query.sort || "default";

    // Parse requested fields → .select()
    const defaultFields = [
      "name",
      "slug",
      "images",
      "summary",
      "tags",
      "price",
      "currency",
      "featured",
      "publishedAt",
      "categoryId",
      "status",
      "specs",       // ✅ include specs so FE can read length/beam/speed/seats
      "createdAt",
    ];
    const requested = (req.query.fields || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // Merge + de-dupe (silently allow unknowns)
    const fields = Array.from(new Set([...(requested.length ? requested : defaultFields)])).join(" ");

    const filter = { status: "published" };
    if (q) {
      filter.$or = [
        { name: new RegExp(q, "i") },
        { summary: new RegExp(q, "i") },
        { description: new RegExp(q, "i") },
        { tags: q },
      ];
    }
    if (categorySlug) {
      const cat = await Category.findOne({ slug: categorySlug }).select("_id");
      filter.categoryId = cat?._id || null;
    }

    const sortMap = {
      latest: { publishedAt: -1, createdAt: -1 },
      price_asc: { price: 1, publishedAt: -1 },
      price_desc: { price: -1, publishedAt: -1 },
      default: { featured: -1, sortOrder: 1, publishedAt: -1, createdAt: -1 },
    };

    try {
      const [items, total] = await Promise.all([
        Product.find(filter)
          .select(fields)
          .populate({ path: "categoryId", select: "name slug" }) // ✅ pretty category label
          .sort(sortMap[sort] || sortMap.default)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Product.countDocuments(filter),
      ]);

      res.json({ ok: true, items, page, pages: Math.ceil(total / limit), total });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);


// GET published by slug (storefront)
router.get("/:slug", async (req, res) => {
  try {
    // If an admin is viewing (dashboard edit modal), allow any status
    const isAdmin = !!(req.user && (req.user.isAdmin || req.user.role === "admin"));
    const item = await Product.findOne(
      isAdmin ? { slug: req.params.slug } : { slug: req.params.slug, status: "published" }
    ).lean();

    if (!item) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, item });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


/* ================================================================
   ADMIN ROUTES (dashboard)
   NOTE: These are protected; your frontend calls them.
================================================================ */

// Admin list: all statuses (your dashboard table uses this)
router.get(
  "/admin/list",
  requireAuth,
  requireAdmin,
  [
    query("limit").optional().toInt(),
    query("page").optional().toInt(),
    query("status").optional().isIn(["draft", "published", "archived", "all"]),
    query("q").optional().trim(),
    query("categoryId").optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const page = Math.max(1, req.query.page || 1);
    const limit = Math.min(200, Math.max(1, req.query.limit || 100));
    const q = req.query.q || "";
    const status = req.query.status || "all";
    const categoryId = req.query.categoryId || "";

    const filter = {};
    if (status !== "all") filter.status = status;

    if (q) {
      filter.$or = [
        { name: new RegExp(q, "i") },
        { slug: new RegExp(q, "i") },
        { sku: new RegExp(q, "i") },
        { summary: new RegExp(q, "i") },
        { description: new RegExp(q, "i") },
        { tags: q },
      ];
    }
    if (categoryId) filter.categoryId = categoryId;

    try {
      const [items, total] = await Promise.all([
        Product.find(filter)
          .sort({ featured: -1, sortOrder: 1, updatedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Product.countDocuments(filter),
      ]);

      res.json({ ok: true, items, page, pages: Math.ceil(total / limit), total });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);


// server/routes/products.js
router.get("/:slug", async (req, res) => {
  try {
    const isAdmin = !!(req.user && (req.user.isAdmin || req.user.role === "admin"));
    const item = await Product.findOne(
      isAdmin ? { slug: req.params.slug } : { slug: req.params.slug, status: "published" }
    )
      .populate({ path: "categoryId", select: "name slug" }) // ✅ add this
      .lean();

    if (!item) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, item });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Create product
router.post(
  "/",
  requireAuth,
  requireAdmin,
  [
    body("name").isString().trim().notEmpty(),
    body("slug").optional().isString().trim(),
    body("status").optional().isIn(["draft", "published", "archived"]),
    body("images").optional().isArray(),
    body("price").optional({ nullable: true }).isFloat().toFloat(),
    body("currency").optional().isString().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const payload = req.body || {};
      const created = await Product.create(payload);
      res.json({ ok: true, item: created });
    } catch (e) {
      if (e?.code === 11000 && e?.keyPattern?.slug) {
        return res.status(409).json({ ok: false, error: "Slug must be unique" });
      }
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

// Admin: get ANY product by slug (draft/published/archived)
router.get(
  "/admin/by-slug/:slug",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const item = await Product.findOne({ slug: req.params.slug }).lean();
      if (!item) return res.status(404).json({ ok: false, error: "Not found" });
      res.json({ ok: true, item });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);


// Update product (by id)
router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  [param("id").isString()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const update = req.body || {};
      const item = await Product.findByIdAndUpdate(req.params.id, update, {
        new: true,
        runValidators: true,
      });
      if (!item) return res.status(404).json({ ok: false, error: "Product not found" });
      res.json({ ok: true, item });
    } catch (e) {
      if (e?.code === 11000 && e?.keyPattern?.slug) {
        return res.status(409).json({ ok: false, error: "Slug must be unique" });
      }
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

// Delete product (by id or slug)
router.delete(
  "/:idOrSlug",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const p = await findByIdOrSlug(req.params.idOrSlug, true);
      if (!p) return res.status(404).json({ ok: false, error: "Product not found" });

      // delete its images from cloud
      if (Array.isArray(p.images)) {
        for (const img of p.images) {
          if (img?.publicId) {
            try { await deleteImage(img.publicId); } catch {}
          }
        }
      }
      await Product.deleteOne({ _id: p._id });
      res.json({ ok: true, deletedId: p._id });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

/* ================================================================
   IMAGE MANAGEMENT (Admin)
================================================================ */

// Replace ALL images
// PATCH /api/v1/products/:id/images  Body: { images: [{url, publicId}, ...] }
router.patch("/:id/images", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { images } = req.body;
    if (!Array.isArray(images)) {
      return res.status(400).json({ ok: false, error: "images[] required" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ ok: false, error: "Product not found" });

    // Remove old images from cloud
    for (const img of product.images || []) {
      if (img?.publicId) {
        try { await deleteImage(img.publicId); } catch {}
      }
    }

    product.images = images; // [{url, publicId}]
    await product.save();

    res.json({ ok: true, images: product.images });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Could not update product images" });
  }
});

// Delete ONE image by its publicId
// DELETE /api/v1/products/:id/images/:publicId
router.delete("/:id/images/:publicId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id, publicId } = req.params;

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ ok: false, error: "Product not found" });

    if (publicId) {
      try { await deleteImage(publicId); } catch {}
    }

    product.images = (product.images || []).filter((img) => img.publicId !== publicId);
    await product.save();

    res.json({ ok: true, images: product.images });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Could not delete image" });
  }
});

module.exports = router;
