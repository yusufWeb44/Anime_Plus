// ─── Email Service ─────────────────────────────────────────────────────────────
// Uses Brevo HTTP API (works on Render Free - bypasses SMTP port blocks)
// Required env vars: BREVO_API_KEY, EMAIL_USER (verified sender in Brevo)

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
                           style="display:inline-block;
                                  background:linear-gradient(135deg, #ac4a92, #8b2f7a);
                                  color:#ffffff; text-decoration:none;
                                  padding:15px 40px; border-radius:10px;
                                  font-size:16px; font-weight:bold; letter-spacing:0.5px;
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
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.EMAIL_USER;

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not set in environment variables.");
  }
  if (!senderEmail) {
    throw new Error("EMAIL_USER is not set in environment variables.");
  }

  const payload = {
    sender: {
      name: "AnimePlus",
      email: senderEmail, // Must be a verified sender in your Brevo account
    },
    to: [
      { email: email },
    ],
    subject: "🔑 Reset Your Password – AnimePlus",
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
  console.log(`[Email] ✅ Password reset email sent to ${email} via Brevo. MessageId: ${data.messageId}`);
  return data;
};

// ─── Verification Email Template ─────────────────────────────────────────────
function buildVerificationEmailHtml(username, verifyUrl) {
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
                    Welcome to AnimePlus! We're excited to have you on board.
                    Before you can log in and start exploring, we just need to verify your email address.
                  </p>
                  <p style="font-size:15px; color:#555; line-height:1.7; margin:0 0 30px;">
                    Click the button below to verify your account.
                  </p>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${verifyUrl}"
                           style="display:inline-block;
                                  background:linear-gradient(135deg, #10b981, #059669);
                                  color:#ffffff; text-decoration:none;
                                  padding:15px 40px; border-radius:10px;
                                  font-size:16px; font-weight:bold; letter-spacing:0.5px;
                                  box-shadow: 0 4px 15px rgba(16,185,129,0.4);">
                          ✅ Verify My Account
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Fallback link -->
                  <p style="font-size:13px; color:#999; text-align:center; margin:25px 0 0; line-height:1.6;">
                    If the button doesn't work, copy and paste this link into your browser:<br/>
                    <a href="${verifyUrl}" style="color:#10b981; word-break:break-all; font-size:12px;">
                      ${verifyUrl}
                    </a>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#f9f9f9; padding:20px 40px; border-top:1px solid #eee;">
                  <p style="font-size:12px; color:#aaa; text-align:center; margin:0;">
                    &copy; ${new Date().getFullYear()} AnimePlus &mdash; All rights reserved.<br/>
                    You're receiving this email because you recently created a new AnimePlus account.
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

exports.sendVerificationEmail = async (email, username, verifyUrl) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.EMAIL_USER;

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not set in environment variables.");
  }
  if (!senderEmail) {
    throw new Error("EMAIL_USER is not set in environment variables.");
  }

  const payload = {
    sender: {
      name: "AnimePlus",
      email: senderEmail,
    },
    to: [
      { email: email },
    ],
    subject: "✅ Verify Your AnimePlus Account",
    htmlContent: buildVerificationEmailHtml(username, verifyUrl),
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
  console.log(`[Email] ✅ Verification email sent to ${email} via Brevo. MessageId: ${data.messageId}`);
  return data;
};
