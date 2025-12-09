const serverless = require("serverless-http");
const app = require("../server/server");

const handler = serverless(app);

// Vercel Node.js runtime expects a default export
module.exports = async (req, res) => {
  return handler(req, res);
};

// ALSO export as default for safety
exports.default = async (req, res) => {
  return handler(req, res);
};
