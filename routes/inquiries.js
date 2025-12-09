// server/routes/inquiries.js
const express = require("express");
const { body, validationResult } = require("express-validator");
const Inquiry = require("../modules/Inquiry");
const Product = require("../modules/Product");
const router = express.Router();

/* ---------------- Public: create inquiry (productId optional) ---------------- */
router.post(
  "/",
  body("name").isLength({ min: 2 }),
  body("email").isEmail(),
  body("message").isLength({ min: 5 }),
  body("productId").optional().isString(),
  body("subject").optional().isString(),
  body("phone").optional().isString(),
  body("quantity").optional().isInt({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      let prodId = null;
      if (req.body.productId) {
        const prod = await Product.findById(req.body.productId).select("_id");
        if (!prod) return res.status(400).json({ ok: false, error: "Invalid productId" });
        prodId = prod._id;
      }

      const created = await Inquiry.create({
        productId: prodId,
        name: req.body.name,
        email: req.body.email.toLowerCase(),
        phone: req.body.phone || "",
        subject: req.body.subject || "",
        message: req.body.message,
        quantity: req.body.quantity,
        status: "new",
        source: req.body.source || "website",
      });

      res.status(201).json({ ok: true, item: created });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

/* ---------------- Admin: list (any status) ---------------- */
router.get("/admin", async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const q      = (req.query.q || "").trim();
    const status = (req.query.status || "").trim();
    const productId = (req.query.productId || "").trim();
    const populate = String(req.query.populate || "") === "1";

    const filter = {};
    if (status) filter.status = status;
    if (productId) filter.productId = productId;
    if (q) {
      filter.$or = [
        { name:    new RegExp(q, "i") },
        { email:   new RegExp(q, "i") },
        { phone:   new RegExp(q, "i") },
        { subject: new RegExp(q, "i") },
        { message: new RegExp(q, "i") },
      ];
    }

    let qry = Inquiry.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    if (populate) qry = qry.populate("productId", "name slug");
    const [items, total] = await Promise.all([qry.lean(), Inquiry.countDocuments(filter)]);

    res.json({ ok: true, items, page, total, pages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ---------------- Admin: create ---------------- */
router.post(
  "/admin",
  body("name").isLength({ min: 2 }),
  body("email").isEmail(),
  body("message").isLength({ min: 1 }),
  body("status").optional().isIn(["new","quoted","won","lost"]),
  body("productId").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      let prodId = null;
      if (req.body.productId) {
        const prod = await Product.findById(req.body.productId).select("_id");
        if (!prod) return res.status(400).json({ ok: false, error: "Invalid productId" });
        prodId = prod._id;
      }

      const created = await Inquiry.create({
        productId: prodId,
        name: req.body.name,
        email: req.body.email.toLowerCase(),
        phone: req.body.phone || "",
        subject: req.body.subject || "",
        message: req.body.message,
        quantity: req.body.quantity,
        status: req.body.status || "new",
        source: req.body.source || "website",
      });

      res.status(201).json({ ok: true, item: created });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

/* ---------------- Admin: update ---------------- */
router.put(
  "/admin/:id",
  body("email").optional().isEmail(),
  body("status").optional().isIn(["new","quoted","won","lost"]),
  body("productId").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      const patch = { ...req.body };
      if (patch.email) patch.email = patch.email.toLowerCase();

      if (typeof patch.productId !== "undefined") {
        if (!patch.productId) {
          patch.productId = null;
        } else {
          const prod = await Product.findById(patch.productId).select("_id");
          if (!prod) return res.status(400).json({ ok: false, error: "Invalid productId" });
          patch.productId = prod._id;
        }
      }

      const updated = await Inquiry.findByIdAndUpdate(req.params.id, patch, { new: true });
      if (!updated) return res.status(404).json({ ok: false, error: "Not found" });
      res.json({ ok: true, item: updated });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

/* ---------------- Admin: delete ---------------- */
router.delete("/admin/:id", async (req, res) => {
  try {
    const deleted = await Inquiry.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
