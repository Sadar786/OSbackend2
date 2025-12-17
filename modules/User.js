// server/modules/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String }, // empty for Google users
    
    emailVerified: { type: Boolean, default: false },

    emailOtpHash: { type: String, default: null },
    emailOtpExpiresAt: { type: Date, default: null },
    emailOtpLastSentAt: { type: Date, default: null },
    emailOtpAttempts: { type: Number, default: 0 },

    role: { type: String, default: "viewer" },
    status: { type: String, enum: ["active", "disabled"], default: "active" },

    // you already have this as a string in Google login:
    avatar: { type: String }, // stores the URL (e.g., https://res.cloudinary.com/.../image.jpg)

    // ⬇⬇ NEW field (add this line)
    avatarPublicId: { type: String }, // stores Cloudinary public_id for clean deletions

    // optional provider fields you might already have:
    provider: { type: String }, // "google" etc.
    providerId: { type: String },

    lastLoginAt: { type: Date },


  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
