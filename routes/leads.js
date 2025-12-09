// server/routes/leads.js
const express = require("express");
const { body, validationResult } = require("express-validator");
const Lead = require("../modules/Lead");
const router = express.Router();

/* Public create (unchanged except return shape) */
router.post(
  "/",
  body("name").isLength({ min: 2 }),
  body("email").isEmail(),
  body("message").isLength({ min: 5 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      const lead = await Lead.create({
        name:   req.body.name,
        email:  req.body.email.toLowerCase(),
        phone:  req.body.phone || "",
        message:req.body.message,
        source: req.body.source || "website",
        status: "new",
        // avatar ignored on public route
      });
      res.status(201).json({ ok: true, item: lead });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

/* Admin list (returns avatar too) */
router.get("/admin", async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const q     = (req.query.q || "").trim();
    const status= (req.query.status || "").trim();
    const source= (req.query.source || "").trim();

    const filter = {};
    if (status) filter.status = status;
    if (source) filter.source = source;
    if (q) {
      filter.$or = [
        { name:    new RegExp(q, "i") },
        { email:   new RegExp(q, "i") },
        { phone:   new RegExp(q, "i") },
        { message: new RegExp(q, "i") },
      ];
    }

    const [items, total] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Lead.countDocuments(filter),
    ]);

    res.json({ ok: true, items, page, total, pages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* Admin create — accepts avatar */
router.post(
  "/admin",
  body("name").isLength({ min: 2 }),
  body("email").isEmail(),
  body("status").optional().isIn(["new","contacted","converted"]),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      const created = await Lead.create({
        name:   req.body.name,
        email:  req.body.email.toLowerCase(),
        phone:  req.body.phone || "",
        message:req.body.message || "",
        source: req.body.source || "website",
        status: req.body.status || "new",
        avatar: req.body.avatar && req.body.avatar.url ? {
          url: req.body.avatar.url,
          publicId: req.body.avatar.publicId || ""
        } : undefined,
      });
      res.status(201).json({ ok: true, item: created });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

/* Admin update — accepts avatar */
router.put(
  "/admin/:id",
  body("email").optional().isEmail(),
  body("status").optional().isIn(["new","contacted","converted"]),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      const patch = { ...req.body };
      if (patch.email) patch.email = patch.email.toLowerCase();
      if (patch.avatar && !patch.avatar.url) {
        // if client sends empty avatar, clear it
        patch.avatar = undefined;
      }
      const updated = await Lead.findByIdAndUpdate(req.params.id, patch, { new: true });
      if (!updated) return res.status(404).json({ ok: false, error: "Not found" });
      res.json({ ok: true, item: updated });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

/* Admin delete (unchanged) */
router.delete("/admin/:id", async (req, res) => {
  try {
    const deleted = await Lead.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
