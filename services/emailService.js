const nodemailer = require("nodemailer");

// ─── Brevo HTTP API (works on Render - bypasses SMTP port blocks) ───────────
async function sendViaBrevoAPI(to, username, resetUrl) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY is not set.");

  const senderEmail = process.env.EMAIL_FROM || "noreply@animeplusnow.com";
  const senderName = "AnimePlus";

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to }],
    subject: "Reset Your Password - AnimePlus",
    htmlContent: buildEmailHtml(username, resetUrl),
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo API Error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  console.log("[Email] Sent via Brevo API. MessageId:", data.messageId);
  return data;
}

// ─── Nodemailer SMTP fallback (for local development) ───────────────────────
async function sendViaSMTP(to, username, resetUrl) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"AnimePlus" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Reset Your Password - AnimePlus",
    html: buildEmailHtml(username, resetUrl),
  });

  console.log("[Email] Sent via SMTP.");
}

// ─── Email HTML Template ─────────────────────────────────────────────────────
function buildEmailHtml(username, resetUrl) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;
                border: 1px solid #e0e0e0; border-radius: 12px; background-color: #fbfbfb;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #ac4a92; margin: 0;">AnimePlus</h2>
        <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">Your Ultimate Anime Experience</p>
      </div>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 16px; color: #333;">Hello <strong>${username}</strong>,</p>
      <p style="font-size: 16px; color: #555; line-height: 1.5;">
        We received a request to reset the password for your AnimePlus account.
        If you did not make this request, you can safely ignore this email.
      </p>
      <p style="font-size: 16px; color: #555; line-height: 1.5;">
        Click the button below to reset your password. This link is valid for <strong>1 hour</strong>.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}"
           style="background-color: #ac4a92; color: #ffffff; text-decoration: none;
                  padding: 14px 36px; font-size: 16px; font-weight: bold;
                  border-radius: 8px; display: inline-block;
                  box-shadow: 0 4px 10px rgba(172, 74, 146, 0.3);">
          Reset Password
        </a>
      </div>
      <p style="font-size: 14px; color: #999; line-height: 1.5; text-align: center;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${resetUrl}" style="color: #ac4a92; word-break: break-all;">${resetUrl}</a>
      </p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;" />
      <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
        &copy; ${new Date().getFullYear()} AnimePlus. All rights reserved.
      </p>
    </div>
  `;
}

// ─── Main exported function ──────────────────────────────────────────────────
exports.sendResetPasswordEmail = async (email, username, resetUrl) => {
  // Production: Use Brevo HTTP API (works on Render Free tier)
  if (process.env.BREVO_API_KEY) {
    return sendViaBrevoAPI(email, username, resetUrl);
  }

  // Development: Use SMTP (Gmail / local mailer)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return sendViaSMTP(email, username, resetUrl);
  }

  throw new Error("No email provider configured. Please set BREVO_API_KEY or EMAIL_USER/EMAIL_PASS.");
};
