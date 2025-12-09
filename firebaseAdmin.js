// server/firebaseAdmin.js (CommonJS)
require("dotenv").config();
const admin = require("firebase-admin");

// Initialize only once
if (!admin.apps.length) {
  const projectId = process.env.FB_PROJECT_ID;
  const clientEmail = process.env.FB_CLIENT_EMAIL;
  const privateKey = (process.env.FB_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "[firebaseAdmin] Missing FB_PROJECT_ID / FB_CLIENT_EMAIL / FB_PRIVATE_KEY envs. " +
      "Google login will fail until set."
    );
  } else {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
}

module.exports = { admin };
