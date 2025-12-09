// server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const path = require("path");
const jwt = require("jsonwebtoken");

dotenv.config();
const connectDB = require("./config/db");

const app = express();

/* -------------------------------------------------- */
/* 1. PARSE COOKIES + JSON                            */
/* -------------------------------------------------- */
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* -------------------------------------------------- */
/* 2. HELMET FIX                                      */
/* -------------------------------------------------- */
app.use(
  helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

// Remove COOP header manually for Firebase + Cookies
app.use((_, res, next) => {
  res.removeHeader("Cross-Origin-Opener-Policy");
  next();
});

/* -------------------------------------------------- */
/* 3. CORS CONFIG                                     */
/* -------------------------------------------------- */
const ALLOWED_ORIGINS = [
  "https://oceanstella.vercel.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

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
/* 5. HEALTH CHECK (NO DB CONNECTION)                 */
/* -------------------------------------------------- */
const healthHandler = (req, res) => {
  res.json({ ok: true, time: Date.now() });
};

// local (optional)
app.get("/health", healthHandler);
// Vercel / frontend
app.get("/api/health", healthHandler);


/* -------------------------------------------------- */
/* 6. ATTACH USER FROM ACCESS TOKEN                   */
/* -------------------------------------------------- */
app.use((req, _, next) => {
  const at = req.cookies?.os_at;
  if (!at) return next();

  try {
    const payload = jwt.verify(at, process.env.JWT_ACCESS_SECRET);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
  } catch {}

  next();
});

/* -------------------------------------------------- */
/* 7. DB CONNECT MIDDLEWARE (ONLY FOR API ROUTES)     */
/* -------------------------------------------------- */
const dbConnectMiddleware = async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.error("❌ Database connection error:", err);
  }
  next();
};

/* -------------------------------------------------- */
/* 8. ROUTES (ALL WITH /api PREFIX)                   */
/* -------------------------------------------------- */

app.use("/api/v1/auth", dbConnectMiddleware, require("./routes/auth"));
app.use("/api/v1/categories", dbConnectMiddleware, require("./routes/categories"));
app.use("/api/v1/products", dbConnectMiddleware, require("./routes/products"));
app.use("/api/v1/blog", dbConnectMiddleware, require("./routes/blog"));
app.use("/api/v1/inquiries", dbConnectMiddleware, require("./routes/inquiries"));
app.use("/api/v1/leads", dbConnectMiddleware, require("./routes/leads"));
app.use("/api/v1/case-studies", dbConnectMiddleware, require("./routes/caseStudies"));

app.use("/api/users", dbConnectMiddleware, require("./routes/user"));
app.use("/api/upload", dbConnectMiddleware, require("./routes/upload.routes"));

/* -------------------------------------------------- */
/* 9. EXPORT EXPRESS APP FOR VERCEL                   */
/* -------------------------------------------------- */
module.exports = app;