#!/usr/bin/env tsx
/**
 * Phase 1 - Simple Email Test
 * Tests Namecheap SMTP by sending ONE email
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testEmailSend() {
  console.log('🚀 Phase 1: Testing Namecheap SMTP...\n');

  // Validate required env vars
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'TEST_RECIPIENT_EMAIL'];
  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\n💡 Edit .env file with your Namecheap credentials\n');
    process.exit(1);
  }

  // Create SMTP transport
  console.log('📧 Connecting to Namecheap SMTP...');
  console.log(`   Host: ${process.env.SMTP_HOST}`);
  console.log(`   Port: ${process.env.SMTP_PORT}`);
  console.log(`   User: ${process.env.EMAIL_USER}\n`);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false, // For self-signed certs
    },
  });

  // Verify connection
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified!\n');
  } catch (error) {
    console.error('❌ SMTP connection failed:');
    console.error(error);
    process.exit(1);
  }

  // Prepare test email (support multiple recipients)
  const recipients = process.env.TEST_RECIPIENT_EMAIL!.split(',').map(e => e.trim());

  const testEmail = {
    from: process.env.EMAIL_USER,
    to: recipients,
    subject: '✅ Agentic Email System - Test Email',
    text: `This is a test email from your Agentic Email System!

📋 Test Details:
- Sent at: ${new Date().toLocaleString()}
- SMTP Host: ${process.env.SMTP_HOST}
- From: ${process.env.EMAIL_USER}

🎉 If you're reading this, Phase 1 is WORKING!

Next steps:
1. ✅ Namecheap SMTP configured
2. ⏳ Build batch processing (Phase 2)
3. ⏳ Add AI personalization
4. ⏳ Integrate Ruvector & Neural-Trader

---
Powered by Agentic Email v3
`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4CAF50;">✅ Agentic Email System - Test Email</h1>

        <p>This is a test email from your Agentic Email System!</p>

        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>📋 Test Details:</h3>
          <ul>
            <li><strong>Sent at:</strong> ${new Date().toLocaleString()}</li>
            <li><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</li>
            <li><strong>From:</strong> ${process.env.EMAIL_USER}</li>
          </ul>
        </div>

        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>🎉 If you're reading this, Phase 1 is WORKING!</h3>
        </div>

        <h3>Next steps:</h3>
        <ol>
          <li>✅ Namecheap SMTP configured</li>
          <li>⏳ Build batch processing (Phase 2)</li>
          <li>⏳ Add AI personalization</li>
          <li>⏳ Integrate Ruvector & Neural-Trader</li>
        </ol>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">Powered by Agentic Email v3</p>
      </div>
    `,
  };

  // Send email
  console.log('📤 Sending test email...');
  console.log(`   From: ${testEmail.from}`);
  console.log(`   To: ${recipients.join(', ')}`);
  console.log(`   Subject: ${testEmail.subject}\n`);

  try {
    const info = await transporter.sendMail(testEmail);
    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}\n`);
    console.log('🎉 Phase 1 COMPLETE! Check your inbox at:', recipients.join(', '));
    console.log('\n💡 Next: Run "npm run phase2" to process multiple leads');
  } catch (error) {
    console.error('❌ Failed to send email:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testEmailSend().catch(console.error);
