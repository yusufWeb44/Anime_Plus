const nodemailer = require("nodemailer");

// Create transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: (process.env.SMTP_PORT === "465"), // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.sendResetPasswordEmail = async (email, username, resetUrl) => {
  const mailOptions = {
    from: `"AnimePlus" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset Your Password - AnimePlus",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #fbfbfb;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #ac4a92; margin: 0;">AnimePlus</h2>
          <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">Your Ultimate Anime Experience</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 16px; color: #333;">Hello <strong>${username}</strong>,</p>
        <p style="font-size: 16px; color: #555; line-height: 1.5;">
          We received a request to reset your password for your AnimePlus account. If you did not make this request, you can safely ignore this email.
        </p>
        <p style="font-size: 16px; color: #555; line-height: 1.5;">
          To reset your password, click the button below. This link is valid for <strong>1 hour</strong>.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #ac4a92; color: #ffffff; text-decoration: none; padding: 12px 30px; font-size: 16px; font-weight: bold; border-radius: 8px; display: inline-block; box-shadow: 0 4px 10px rgba(172, 74, 146, 0.3);">
            Reset Password
          </a>
        </div>
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px; text-align: left;">
          <p style="font-size: 13px; color: #b45309; margin: 0; line-height: 1.5;">
            <strong>Localhost Testing Note:</strong> Since the server is running on your local machine, make sure to click this link on the same computer where the server is running. It will not work on mobile phones or external devices.
          </p>
        </div>
        <p style="font-size: 14px; color: #999; line-height: 1.5; text-align: center;">
          If the button above doesn't work, copy and paste the following link into your browser: <br />
          <a href="${resetUrl}" style="color: #ac4a92; word-break: break-all;">${resetUrl}</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} AnimePlus. All rights reserved.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};
