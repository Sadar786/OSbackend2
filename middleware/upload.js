// server/middleware/upload.js
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB (tweak if you want)
});

module.exports = { upload };
