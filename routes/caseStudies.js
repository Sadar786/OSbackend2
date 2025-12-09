// server/routes/caseStudies.js
const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const CaseStudy = require("../modules/CaseStudy");
const { estimateReadingMinutes } = require("../modules/CaseStudy");

// guards
const requireAuth = require("../middleware/requireAuth");
let requireAdmin;
try { requireAdmin = require("../middleware/requireAdmin"); }
catch { requireAdmin = (_req, _res, next) => next(); }

const router = express.Router();

/* helpers */
function slugify(s = "") {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
async function findByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null;
  let doc = null;
  try { doc = await CaseStudy.findById(idOrSlug); if (doc) return doc; } catch {}
  return CaseStudy.findOne({ slug: idOrSlug });
}

function normalizeTags(raw) {
  if (Array.isArray(raw)) return raw.map(s => String(s).trim()).filter(Boolean);
  if (!raw) return [];
  return String(raw).split(",").map(s => s.trim()).filter(Boolean);
}
function normalizeGallery(raw) {
  if (!raw) return [];
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { raw = [{ url: raw }]; }
  }
  if (!Array.isArray(raw)) raw = [raw];
  return raw.map(it => (
    typeof it === "string"
      ? { url: it, alt: "" }
      : { url: String(it.url || "").trim(), alt: String(it.alt || "").trim() }
  )).filter(it => it.url);
}

/* -------------------- Public list & detail -------------------- */

// GET /api/v1/case-studies?all=1
router.get("/", [query("all").optional().isIn(["0","1"])], async (req, res) => {
  try {
    const wantAll = String(req.query.all || "0") === "1";
    const baseSel =
      "title slug client subtitle heroImage gallery tags summary content readingMinutes " +
      "seoTitle seoDescription canonicalUrl ogImage published publishedAt updatedAt order metrics";
    const sort = { order: 1, publishedAt: -1, updatedAt: -1, title: 1 };

    if (wantAll) {
      if (!req.user) return res.status(401).json({ ok: false, error: "Unauthorized" });
      const items = await CaseStudy.find().select(baseSel).sort(sort).lean();
      return res.json({ ok: true, items });
    }

    const items = await CaseStudy.find({ published: true })
      .select(baseSel).sort(sort).lean();
    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/v1/case-studies/:slug (public)
router.get("/:slug", async (req, res) => {
  try {
    const item = await CaseStudy.findOne({ slug: req.params.slug, published: true }).lean();
    if (!item) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, item });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* -------------------------- Admin CRUD -------------------------- */

// server/routes/caseStudies.js
router.get("/", async (req, res) => {
  try {
    const { service } = req.query;
    const baseSel = "title slug client subtitle heroImage gallery tags summary content readingMinutes seoTitle seoDescription canonicalUrl ogImage published publishedAt updatedAt order metrics";
    const sort = { order: 1, publishedAt: -1, updatedAt: -1, title: 1 };

    const filter = { published: true };
    if (service) filter.tags = { $in: [service] }; // or use a dedicated field

    const items = await CaseStudy.find(filter).select(baseSel).sort(sort).lean();
    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});



// POST /api/v1/case-studies
router.post(
  "/",
  requireAuth, requireAdmin,
  [body("title").isString().trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      const {
        title, client, subtitle, heroImage, gallery,
        tags, summary, content,
        seoTitle, seoDescription, canonicalUrl, ogImage,
        published, order
      } = req.body;

      const doc = await CaseStudy.create({
        title,
        slug: slugify(req.body.slug || title),
        client, subtitle, heroImage,
        gallery: normalizeGallery(gallery),
        tags: normalizeTags(tags),
        summary, content,
        readingMinutes: estimateReadingMinutes(content),
        seoTitle, seoDescription, canonicalUrl,
        ogImage: ogImage || heroImage || "",
        published: !!published,
        publishedAt: published ? new Date() : null,
        order: Number.isFinite(+order) ? +order : 0,
        metrics: { views: 0, leads: 0 },
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

// PATCH /api/v1/case-studies/:idOrSlug
router.patch(
  "/:idOrSlug",
  requireAuth, requireAdmin,
  [param("idOrSlug").isString()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      const existing = await findByIdOrSlug(req.params.idOrSlug);
      if (!existing) return res.status(404).json({ ok: false, error: "Not found" });

      const update = { ...req.body };

      if (typeof update.title !== "undefined" && !update.slug) {
        update.slug = slugify(update.title);
      }
      if (typeof update.order !== "undefined") update.order = +update.order || 0;

      if (typeof update.tags !== "undefined")  update.tags = normalizeTags(update.tags);
      if (typeof update.gallery !== "undefined") update.gallery = normalizeGallery(update.gallery);

      if (typeof update.content !== "undefined") {
        update.readingMinutes = estimateReadingMinutes(update.content);
      }

      if (typeof update.published !== "undefined") {
        update.published = !!update.published;
        update.publishedAt = update.published ? (existing.publishedAt || new Date()) : null;
      }

      if (!update.ogImage && (update.heroImage || existing.heroImage)) {
        update.ogImage = update.heroImage || existing.heroImage;
      }

      const saved = await CaseStudy.findByIdAndUpdate(existing._id, update, {
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

// DELETE /api/v1/case-studies/:idOrSlug
router.delete(
  "/:idOrSlug",
  requireAuth, requireAdmin,
  [param("idOrSlug").isString()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      const existing = await findByIdOrSlug(req.params.idOrSlug);
      if (!existing) return res.status(404).json({ ok: false, error: "Not found" });
      await CaseStudy.deleteOne({ _id: existing._id });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

module.exports = router;
