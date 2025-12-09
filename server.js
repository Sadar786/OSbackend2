// server.js
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
    crossOriginOpenerPolicy: false,     // REQUIRED for Firebase popup
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,   // REQUIRED for cookies
  })
);

// Remove COOP header manually to avoid cookie issues
app.use((req, res, next) => {
  res.removeHeader("Cross-Origin-Opener-Policy");
  next();
});

/* -------------------------------------------------- */
/* 3. CORS CONFIG                                      */
/* -------------------------------------------------- */
const ALLOWED_ORIGINS = [
  "https://oceanstella.vercel.app",   // your frontend
  "http://localhost:5173",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // allow serverless/internal calls

      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

      // Allow Vercel preview deployments: *.vercel.app
      try {
        const { hostname } = new URL(origin);
        if (hostname.endsWith(".vercel.app")) return callback(null, true);
      } catch {}

      return callback(new Error("CORS blocked: " + origin));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

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
    // ignore invalid tokens
  }

  next();
});

/* -------------------------------------------------- */
/* 7. LAZY MONGODB CONNECTION (IMPORTANT FOR VERCEL)   */
/* -------------------------------------------------- */
app.use(async (req, res, next) => {
  try {
    await connectDB(); // connects only once, cached afterwards
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
  next();
});

/* -------------------------------------------------- */
/* 8. ROUTES                                           */
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
/* 9. EXPORT APP (IMPORTANT: NO app.listen() ON VERCEL)*/
/* -------------------------------------------------- */
module.exports = app;
