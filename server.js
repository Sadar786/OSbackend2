// server.js
const express = require("express");
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
app.get("/health", (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

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
/* 7. ROUTES (VERCEL-COMPATIBLE PATHS)                */
/* -------------------------------------------------- */

app.use("/v1/auth", dbConnectMiddleware, require("./routes/auth"));
app.use("/v1/categories", dbConnectMiddleware, require("./routes/categories"));
app.use("/v1/products", dbConnectMiddleware, require("./routes/products"));
app.use("/v1/blog", dbConnectMiddleware, require("./routes/blog"));
app.use("/v1/inquiries", dbConnectMiddleware, require("./routes/inquiries"));
app.use("/v1/leads", dbConnectMiddleware, require("./routes/leads"));
app.use("/v1/case-studies", dbConnectMiddleware, require("./routes/caseStudies"));

// THESE TWO MUST NOT HAVE /v1
app.use("/users", dbConnectMiddleware, require("./routes/user"));
app.use("/upload", dbConnectMiddleware, require("./routes/upload.routes"));



/* -------------------------------------------------- */
/* 9. EXPORT EXPRESS APP FOR VERCEL                   */
/* -------------------------------------------------- */
module.exports = app;
