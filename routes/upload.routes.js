// server/routes/upload.routes.js
const express = require("express");
const { upload } = require("../middleware/upload"); // <-- CommonJS export
const cloudinary = require("../config/cloudinary");

const router = express.Router();

// POST /api/upload - single file "image"
router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file received" });

    // Stream to Cloudinary (no temp file)
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "ocean-stella" }, // optional folder
        (err, out) => (err ? reject(err) : resolve(out))
      );
      stream.end(req.file.buffer);
    });

    res.json({
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Upload failed" });
  }
});

module.exports = router;
