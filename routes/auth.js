// server/routes/auth.js
const express = require("express");
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { admin } = require("../firebaseAdmin"); // must export { admin }
const User = require("../modules/User");
const AuthSession = require("../modules/AuthSession");

const router = express.Router();

/* -------------------- token + cookie helpers -------------------- */
const isProd = process.env.NODE_ENV === "production";
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TTL_MS = (() => {
  const m = String(process.env.REFRESH_TOKEN_TTL || "30d").match(/^(\d+)([smhd])$/i);
  const n = m ? parseInt(m[1], 10) : 30;
  const unit = m ? m[2].toLowerCase() : "d";
  const mult = unit === "s" ? 1e3 : unit === "m" ? 60e3 : unit === "h" ? 3600e3 : 86400e3;
  return n * mult;
})();

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, email: user.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}
function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie("os_at", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("os_rt", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: REFRESH_TTL_MS,
  });
}
function clearAuthCookies(res) {
  res.clearCookie("os_at", { path: "/" });
  res.clearCookie("os_rt", { path: "/" });
}

/* -------------------- bcrypt or bcryptjs -------------------- */
let bcrypt;
try {
  bcrypt = require("bcrypt");
} catch {
  bcrypt = require("bcryptjs");
}

/* ==================== POST /auth/signup ==================== */
router.post(
  "/signup",
  body("name").trim().isLength({ min: 2 }),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 8 }),
  async (req, res) => {
    try {
      if (process.env.ALLOW_PUBLIC_SIGNUP !== "true") {
        return res.status(403).json({ ok: false, error: "Signups disabled" });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { name, email, password } = req.body;

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) return res.status(409).json({ ok: false, error: "Email already in use" });

      const passwordHash = await bcrypt.hash(password, 10);

      // first user becomes superadmin, else editor
      const count = await User.countDocuments();
      const role = count === 0 ? "superadmin" : "editor";

      const user = await User.create({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
        status: "active",
      });

      // create refresh session
      const refreshToken = crypto.randomBytes(64).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
      const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
      await AuthSession.create({
        userId: user._id,
        tokenHash,
        userAgent: req.get("user-agent") || "",
        ip: req.ip || req.headers["x-forwarded-for"] || "",
        expiresAt,
      });

      const accessToken = signAccessToken(user);
      setAuthCookies(res, { accessToken, refreshToken });

      res.status(201).json({
        ok: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          avatar: user.avatar || null,
        },
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

/* ==================== POST /auth/signin ==================== */
router.post(
  "/signin",
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 8 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, password } = req.body;
      const user = await User.findOne({ email: email.toLowerCase(), status: "active" });
      if (!user) return res.status(401).json({ ok: false, error: "Invalid credentials" });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ ok: false, error: "Invalid credentials" });

      // create refresh session
      const refreshToken = crypto.randomBytes(64).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
      const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
      await AuthSession.create({
        userId: user._id,
        tokenHash,
        userAgent: req.get("user-agent") || "",
        ip: req.ip || req.headers["x-forwarded-for"] || "",
        expiresAt,
      });

      const accessToken = signAccessToken(user);
      setAuthCookies(res, { accessToken, refreshToken });

      user.lastLoginAt = new Date();
      await user.save();

      res.json({
        ok: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          avatar: user.avatar || null,
        },
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

/* ==================== POST /auth/refresh ==================== */
router.post("/refresh", async (req, res) => {
  try {
    const rt = req.cookies?.os_rt;
    if (!rt) return res.status(401).json({ ok: false, error: "No refresh token" });
    const tokenHash = crypto.createHash("sha256").update(rt).digest("hex");
    const session = await AuthSession.findOne({ tokenHash, revokedAt: { $exists: false } });
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ ok: false, error: "Session expired" });
    }
    const user = await User.findById(session.userId);
    if (!user || user.status !== "active") {
      return res.status(401).json({ ok: false, error: "User disabled" });
    }
    const accessToken = signAccessToken(user);
    res.cookie("os_at", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 15 * 60 * 1000,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ==================== GET /auth/me ==================== */
router.get("/me", async (req, res) => {
  try {
    const at = req.cookies?.os_at;
    if (!at) return res.status(401).json({ ok: false, error: "No token" });
    const payload = jwt.verify(at, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(payload.sub).select(
      "name email role status avatar avatarPublicId"
    );
    if (!user) return res.status(401).json({ ok: false, error: "Invalid user" });

    res.json({ ok: true, user });
  } catch (e) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
  }
});

/* ==================== POST /auth/signout ==================== */
router.post("/signout", async (_req, res) => {
  try {
    const rt = _req.cookies?.os_rt;
    if (rt) {
      const tokenHash = crypto.createHash("sha256").update(rt).digest("hex");
      await AuthSession.updateOne({ tokenHash }, { $set: { revokedAt: new Date() } });
    }
  } catch {}
  clearAuthCookies(res);
  res.json({ ok: true });
});

/* ==================== POST /auth/google ==================== */
// body: { idToken: string }  (Firebase client ID token)
router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ ok: false, error: "Missing idToken" });

    // 1) Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decoded || {};
    if (!email) return res.status(400).json({ ok: false, error: "No email in Google account" });

    // 2) Upsert user
    const normalizedEmail = String(email).toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      const count = await User.countDocuments();
      const role = count === 0 ? "superadmin" : "editor";

      user = await User.create({
        name: name || "Google User",
        email: normalizedEmail,
        role,
        status: "active",
        provider: "google",
        providerId: uid,
        avatar: picture, // store Google photo as initial avatar
      });
    } else {
      const shouldSave =
        user.provider !== "google" ||
        (!user.providerId && uid) ||
        (picture && user.avatar !== picture);

      if (user.provider !== "google") user.provider = "google";
      if (!user.providerId && uid) user.providerId = uid;
      if (picture && user.avatar !== picture) user.avatar = picture;
      if (shouldSave) await user.save();
    }

    // 3) Create refresh session
    const refreshToken = crypto.randomBytes(64).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await AuthSession.create({
      userId: user._id,
      tokenHash,
      userAgent: req.get("user-agent") || "",
      ip: req.ip || req.headers["x-forwarded-for"] || "",
      expiresAt,
    });

    // 4) Issue access token + cookies
    const accessToken = signAccessToken(user);
    setAuthCookies(res, { accessToken, refreshToken });

    user.lastLoginAt = new Date();
    await user.save();

    return res.json({
      ok: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar || null,
      },
    });
  } catch (e) {
    console.error("Google auth error:", e);
    return res.status(401).json({ ok: false, error: e.message || "Invalid Google token" });
  }
});

module.exports = router;
