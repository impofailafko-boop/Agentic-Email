// Quick test script for Namecheap Private Email
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('🚀 Testing Namecheap Private Email...\n');

  // Create transporter with Namecheap settings
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.privateemail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // false for port 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    debug: true, // Show detailed logs
    logger: true
  });

  console.log('📧 Email Settings:');
  console.log(`   From: ${process.env.EMAIL_USER}`);
  console.log(`   SMTP Host: ${process.env.SMTP_HOST}`);
  console.log(`   SMTP Port: ${process.env.SMTP_PORT}\n`);

  // Test connection first
  try {
    console.log('🔌 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    process.exit(1);
  }

  // Send test email
  try {
    console.log('📨 Sending test email...');
    const info = await transporter.sendMail({
      from: `"Agentic Email Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: '✅ Test Email from Agentic Email System',
      text: 'This is a test email from your Agentic Email system using Namecheap Private Email!',
      html: `
        <h2>🎉 Success!</h2>
        <p>Your Agentic Email system is working correctly with Namecheap Private Email.</p>
        <p><strong>Sent from:</strong> ${process.env.EMAIL_USER}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated test message from the Agentic Email System.
        </p>
      `
    });

    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}\n`);
    console.log('🎉 Check your inbox at:', process.env.EMAIL_USER);

  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    if (error.code) console.error('   Error code:', error.code);
    process.exit(1);
  }
}

testEmail();
