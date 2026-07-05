const { ContactMessage } = require("../models");
const nodemailer = require("nodemailer");
const xss = require("xss");

// Create a reusable transporter using default SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Handles contact form submission.
 */
exports.submitContactForm = async (req, res, next) => {
  try {
    let { name, email, subject, message } = req.body;

    // 1. Validation & Trimming
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: "All fields are required." });
    }

    name = name.trim();
    email = email.trim().toLowerCase();
    subject = subject.trim();
    message = message.trim();

    // Length limits
    if (name.length > 100) return res.status(400).json({ error: "Name is too long." });
    if (subject.length > 200) return res.status(400).json({ error: "Subject is too long." });
    if (message.length > 5000) return res.status(400).json({ error: "Message is too long." });

    // Basic email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    // 2. XSS Sanitization
    name = xss(name);
    subject = xss(subject);
    message = xss(message);

    // 3. Save to Database (Source of Truth)
    const newContactMessage = await ContactMessage.create({
      name,
      email,
      subject,
      message,
    });

    // 4. Return response immediately to frontend
    res.status(200).json({ success: true, message: "Your message has been sent successfully!" });

    // 5. Send email asynchronously
    sendEmailAsync(newContactMessage);
    
  } catch (error) {
    console.error("[Contact Controller] Error:", error);
    res.status(500).json({ error: "Internal server error. Please try again later." });
  }
};

/**
 * Asynchronously sends an email notification.
 */
async function sendEmailAsync(contactRecord) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || !process.env.EMAIL_USER) {
      console.warn("[Contact Controller] Email not configured. Skipping email delivery.");
      return;
    }

    const htmlContent = `
      <h2>New Contact Message from AnimePlus</h2>
      <p><strong>Name:</strong> ${contactRecord.name}</p>
      <p><strong>Email:</strong> ${contactRecord.email}</p>
      <p><strong>Subject:</strong> ${contactRecord.subject}</p>
      <hr />
      <h3>Message:</h3>
      <p>${contactRecord.message.replace(/\n/g, '<br>')}</p>
    `;

    await transporter.sendMail({
      from: `"AnimePlus Contact" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `New Contact Request: ${contactRecord.subject}`,
      html: htmlContent,
      replyTo: contactRecord.email,
    });

    console.log(`[Contact Controller] Email sent successfully for message ID: ${contactRecord.id}`);
  } catch (error) {
    console.error("[Contact Controller] Failed to send email asynchronously:", error);
    // Since this is async, we just log the failure. 
    // The message is already safely stored in the database.
  }
}
