// server/config/db.js
const mongoose = require("mongoose");

if (process.env.MONGODB_URI) {
  console.log("🔑 MONGODB_URI found in environment variables");
} else {
  throw new Error("❌ Missing MONGODB_URI in environment variables");
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  // If already connected → return the connection
  if (cached.conn) return cached.conn;

  // If already connecting → wait for the promise
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
      })
      .then((mongoose) => {
        console.log("✅ MongoDB connected");
        return mongoose;
      })
      .catch((err) => {
        console.error("❌ MongoDB connection error:", err);
        cached.promise = null; // Reset to retry later
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
