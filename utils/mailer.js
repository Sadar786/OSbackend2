const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOtpEmail(to, otp) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "Your Ocean Stella verification code",
    text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
  });
}

module.exports = { sendOtpEmail };
