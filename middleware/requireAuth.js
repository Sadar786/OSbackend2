// server/middleware/requireAuth.js
const jwt = require("jsonwebtoken");
const User = require("../modules/User"); // adjust if your path differs

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.os_at;
    if (!token) return res.status(401).json({ ok: false, error: "No token" });

    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(payload.sub).select("_id name email role status");
    if (!user || user.status !== "active") {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // keep it minimal on the request object
    req.user = { _id: user._id, role: user.role, email: user.email };
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
}

module.exports = requireAuth;
