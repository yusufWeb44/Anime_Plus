const nodemailer = require("nodemailer");

// ─── Gmail SMTP Transporter ───────────────────────────────────────────────────
// Uses Gmail App Password (16-char) – set EMAIL_USER and EMAIL_PASS in .env
// For Gmail App Password: https://myaccount.google.com/apppasswords
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // 16-character App Password (no spaces)
    },
  });
};

// ─── HTML Email Template ──────────────────────────────────────────────────────
function buildEmailHtml(username, resetUrl) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    </head>
    <body style="margin:0; padding:0; background-color:#f4f4f4; font-family: Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0"
              style="background:#ffffff; border-radius:16px; overflow:hidden;
                     box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width:600px; width:100%;">
              
              <!-- Header -->
              <tr>
                <td align="center"
                  style="background: linear-gradient(135deg, #2d0a2d, #ac4a92);
                         padding: 40px 30px;">
                  <h1 style="color:#ffffff; margin:0; font-size:28px; letter-spacing:2px;">
                    Anime<span style="color:#f0a0d8;">+</span>
                  </h1>
                  <p style="color:rgba(255,255,255,0.7); margin:8px 0 0; font-size:13px;">
                    Your Ultimate Anime Experience
                  </p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 40px 40px 30px;">
                  <p style="font-size:16px; color:#333; margin:0 0 10px;">
                    Hello, <strong>${username}</strong> 👋
                  </p>
                  <p style="font-size:15px; color:#555; line-height:1.7; margin:0 0 25px;">
                    We received a request to reset your password for your AnimePlus account.
                    If you didn't make this request, you can safely ignore this email — your account is still secure.
                  </p>
                  <p style="font-size:15px; color:#555; line-height:1.7; margin:0 0 30px;">
                    Click the button below to reset your password. This link will expire in <strong>1 hour</strong>.
                  </p>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${resetUrl}"
                           style="display:inline-block; background:linear-gradient(135deg, #ac4a92, #8b2f7a);
                                  color:#ffffff; text-decoration:none; padding:15px 40px;
                                  border-radius:10px; font-size:16px; font-weight:bold;
                                  letter-spacing:0.5px;
                                  box-shadow: 0 4px 15px rgba(172,74,146,0.4);">
                          🔑 Reset My Password
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Fallback link -->
                  <p style="font-size:13px; color:#999; text-align:center; margin:25px 0 0; line-height:1.6;">
                    If the button doesn't work, copy and paste this link into your browser:<br/>
                    <a href="${resetUrl}" style="color:#ac4a92; word-break:break-all; font-size:12px;">
                      ${resetUrl}
                    </a>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#f9f9f9; padding:20px 40px; border-top:1px solid #eee;">
                  <p style="font-size:12px; color:#aaa; text-align:center; margin:0;">
                    &copy; ${new Date().getFullYear()} AnimePlus &mdash; All rights reserved.<br/>
                    You're receiving this email because a password reset was requested for your account.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ─── Main Export ──────────────────────────────────────────────────────────────
exports.sendResetPasswordEmail = async (email, username, resetUrl) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error(
      "Email service is not configured. Please set EMAIL_USER and EMAIL_PASS environment variables."
    );
  }

  const transporter = createTransporter();

  const fromName = process.env.EMAIL_FROM || "AnimePlus";
  const fromAddress = process.env.EMAIL_USER;

  const mailOptions = {
    from: `"${fromName}" <${fromAddress}>`,
    to: email,
    subject: "🔑 Reset Your Password – AnimePlus",
    html: buildEmailHtml(username, resetUrl),
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`[Email] ✅ Password reset email sent to ${email}. Message ID: ${info.messageId}`);
  return info;
};
