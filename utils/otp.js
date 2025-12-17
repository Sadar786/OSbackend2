const crypto = require("crypto");

function genOtp6() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

module.exports = { genOtp6, hashOtp };
