// server/utils/deleteImage.js
const cloudinary = require("../config/cloudinary");

async function deleteImage(publicId) {
  if (!publicId) return { skipped: true };
  try {
    const res = await cloudinary.uploader.destroy(publicId);
    return res; // { result: 'ok' } or { result: 'not found' }
  } catch (e) {
    console.error("Cloudinary delete failed:", e?.message);
    return { error: e?.message };
  }
}

module.exports = { deleteImage };
