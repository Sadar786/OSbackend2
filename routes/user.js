// server/routes/user.js
const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const { deleteImage } = require("../utils/deleteImage");
const User = require("../modules/User");
const { body, validationResult } = require("express-validator");

/* ========= existing "me" endpoints (unchanged) ========= */

// PATCH /api/users/me/avatar  { url, publicId }
router.patch("/me/avatar", requireAuth, async (req, res) => {
  try {
    const { url, publicId } = req.body || {};
    if (!url || !publicId) {
      return res.status(400).json({ ok: false, error: "url & publicId required" });
    }
    const me = await User.findById(req.user._id);
    if (!me) return res.status(404).json({ ok: false, error: "User not found" });

    await deleteImage(me.avatarPublicId);
    me.avatar = url;
    me.avatarPublicId = publicId;
    await me.save();

    res.json({ ok: true, avatar: me.avatar, avatarPublicId: me.avatarPublicId });
  } catch (e) {
    console.error("update avatar error:", e);
    res.status(500).json({ ok: false, error: "Could not update avatar" });
  }
});

// OPTIONAL: PATCH /api/users/me  { name?, email? }
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body || {};
    const me = await User.findById(req.user._id);
    if (!me) return res.status(404).json({ ok: false, error: "User not found" });

    if (typeof name === "string" && name.trim().length >= 2) me.name = name.trim();

    if (email && email.toLowerCase() !== me.email) {
      const exists = await User.findOne({ email: email.toLowerCase() });
      if (exists) return res.status(409).json({ ok: false, error: "Email already in use" });
      me.email = email.toLowerCase();
    }

    await me.save();
    res.json({
      ok: true,
      user: {
        id: me._id, name: me.name, email: me.email, role: me.role,
        status: me.status, avatar: me.avatar || null
      }
    });
  } catch (e) {
    console.error("update profile error:", e);
    res.status(500).json({ ok: false, error: "Could not update profile" });
  }
});

/* ========= Admin CRUD (protect with auth/role later) ========= */

// Helpers to normalize role/status
const uiToDbRole = (r) => ({ Administrator: "admin", Editor: "editor", Viewer: "viewer" }[r] || r);
const sanitize = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  emailVerified: !!u.emailVerified,   // ✅ add this
  role: u.role,
  status: u.status,
  avatar: u.avatar || null,
  avatarPublicId: u.avatarPublicId || null,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

// GET /api/users/admin?limit=&page=&q=&status=&role=
router.get("/admin", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const q = (req.query.q || "").trim();
    const status = (req.query.status || "").trim();
    const role = (req.query.role || "").trim();

    const filter = {};
    if (status) filter.status = status;
    if (role) filter.role = role;
    if (q) {
      filter.$or = [
        { name: new RegExp(q, "i") },
        { email: new RegExp(q, "i") },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    res.json({ ok: true, items: items.map(sanitize), page, total, pages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/users/admin
router.post(
  "/admin",
  body("name").isLength({ min: 2 }),
  body("email").isEmail(),
  body("role").optional().isString(),
  body("status").optional().isIn(["active", "disabled"]),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      const email = req.body.email.toLowerCase();
      const exists = await User.findOne({ email });
      if (exists) return res.status(409).json({ ok: false, error: "Email already in use" });

      const role = uiToDbRole(req.body.role) || "viewer";
      const status = req.body.status || "active";

      const doc = new User({
        name: req.body.name.trim(),
        email,
        role,
        status,
      });

      if (req.body.avatar && req.body.avatar.url) {
        doc.avatar = req.body.avatar.url;
        doc.avatarPublicId = req.body.avatar.publicId || "";
      }

      await doc.save();
      res.status(201).json({ ok: true, item: sanitize(doc) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

// PUT /api/users/admin/:id
router.put(
  "/admin/:id",
  body("email").optional().isEmail(),
  body("role").optional().isString(),
  body("status").optional().isIn(["active", "disabled"]),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

    try {
      const patch = { ...req.body };

      if (patch.name) patch.name = patch.name.trim();
      if (patch.email) {
        patch.email = patch.email.toLowerCase();
        const exists = await User.findOne({ email: patch.email, _id: { $ne: req.params.id } });
        if (exists) return res.status(409).json({ ok: false, error: "Email already in use" });
      }
      if (patch.role) patch.role = uiToDbRole(patch.role);
      // status allowed as-is

      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ ok: false, error: "Not found" });

      // handle avatar replacement
      if (patch.avatar) {
        const nextUrl = patch.avatar?.url || "";
        const nextPid = patch.avatar?.publicId || "";

        if (!nextUrl) {
          // clear avatar
          await deleteImage(user.avatarPublicId);
          user.avatar = null;
          user.avatarPublicId = null;
        } else {
          if (user.avatarPublicId && user.avatarPublicId !== nextPid) {
            await deleteImage(user.avatarPublicId);
          }
          user.avatar = nextUrl;
          user.avatarPublicId = nextPid;
        }
        delete patch.avatar; // prevent overwrite object into doc
      }

      Object.assign(user, patch);
      await user.save();

      res.json({ ok: true, item: sanitize(user) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

// DELETE /api/users/admin/:id
router.delete("/admin/:id", async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ ok: false, error: "Not found" });

    // delete avatar asset if present
    await deleteImage(u.avatarPublicId);

    await User.deleteOne({ _id: u._id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
