// api/index.js
// Just use the Express app directly – no serverless-http needed.
const app = require("../server");

// Vercel's Node runtime will use this function as the handler.
module.exports = app;
