// server/server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const path = require("path");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");

dotenv.config();
const app = express();

/* -------------------------------------------------- */
/* 1. PARSE COOKIES + JSON (Must come FIRST)          */
/* -------------------------------------------------- */
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* -------------------------------------------------- */
/* 2. HELMET FIX (MUST disable COOP + CORP)           */
/* -------------------------------------------------- */
app.use(
  helmet({
    crossOriginOpenerPolicy: false,     // 🔥 REQUIRED for Firebase popup
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,   // 🔥 REQUIRED for cookies
  })
);

// Double-ensure COOP is removed
app.use((req, res, next) => {
  res.removeHeader("Cross-Origin-Opener-Policy");
  next();
});

/* -------------------------------------------------- */
/* 3. CORS CONFIG (MOST IMPORTANT PART)                */
/* -------------------------------------------------- */
const ALLOWED_ORIGINS = [
  "https://oceanstella.vercel.app",  // Production frontend
  "http://localhost:5173",           // Local dev
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without origin (curl, mobile apps)
      if (!origin) return callback(null, true);

      // Directly allowed
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

      // Allow Vercel preview URLs (*.vercel.app)
      try {
        const { hostname } = new URL(origin);
        if (hostname.endsWith(".vercel.app")) return callback(null, true);
      } catch {}

      return callback(new Error("CORS blocked: " + origin));
    },
    credentials: true,  // 🔥 REQUIRED for cookies to work
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

// Preflight
app.options("*", cors());

/* -------------------------------------------------- */
/* 4. LOGGER                                          */
/* -------------------------------------------------- */
app.use(morgan("dev"));

/* -------------------------------------------------- */
/* 5. HEALTH CHECK                                     */
/* -------------------------------------------------- */
app.get("/health", (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

/* -------------------------------------------------- */
/* 6. AUTO ATTACH USER IF ACCESS TOKEN COOKIE EXISTS   */
/* -------------------------------------------------- */
app.use((req, _res, next) => {
  const at = req.cookies?.os_at;
  if (!at) return next();

  try {
    const payload = jwt.verify(at, process.env.JWT_ACCESS_SECRET);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
  } catch {
    // ignore invalid token
  }

  next();
});

/* -------------------------------------------------- */
/* 7. ROUTES                                           */
/* -------------------------------------------------- */
app.use("/api/v1/auth", require("./routes/auth"));
app.use("/api/v1/categories", require("./routes/categories"));
app.use("/api/v1/products", require("./routes/products"));
app.use("/api/v1/blog", require("./routes/blog"));
app.use("/api/v1/inquiries", require("./routes/inquiries"));
app.use("/api/v1/leads", require("./routes/leads"));
app.use("/api/v1/case-studies", require("./routes/caseStudies"));
app.use("/api/users", require("./routes/user"));
app.use("/api/upload", require("./routes/upload.routes"));

/* -------------------------------------------------- */
/* 8. START SERVER                                     */
/* -------------------------------------------------- */
const PORT = process.env.PORT || 8080;

connectDB()
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

app.listen(PORT, () =>
  console.log(`🚀 Ocean Stella API running on http://localhost:${PORT}`)
);
