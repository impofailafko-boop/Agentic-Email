# Quick Email Test Instructions for Local Claude

## Context
Testing the Agentic Email system with Namecheap Private Email for horvath.jan@rewardly.online

## What You Need to Do

### 1. Clone the repo (if not already done)
```bash
git clone https://github.com/impofailafko-boop/Agentic-Email.git
cd Agentic-Email
git checkout claude/test-agentic-email-01MdMnmq274HzK71mRdryAkt
```

### 2. Install dependencies
```bash
npm install
```

### 3. Create .env file
```bash
cp .env.example .env
```

Then edit `.env` with these **exact values**:
```env
EMAIL_USER=horvath.jan@rewardly.online
EMAIL_PASS=L$9ekp/5@8CP7V#
SMTP_HOST=mail.privateemail.com
SMTP_PORT=587
SMTP_SECURE=false
IMAP_HOST=mail.privateemail.com
IMAP_PORT=993
IMAP_TLS=true
```

### 4. Run the test
```bash
node quick-test.js
```

### Expected Output
```
🚀 Testing Namecheap Private Email...
📧 Email Settings:
   From: horvath.jan@rewardly.online
   SMTP Host: mail.privateemail.com
   SMTP Port: 587

🔌 Testing SMTP connection...
✅ SMTP connection successful!

📨 Sending test email...
✅ Email sent successfully!
   Message ID: <some-id>
   Response: 250 OK

🎉 Check your inbox at: horvath.jan@rewardly.online
```

### 5. Verify
- Check inbox at https://privateemail.com
- Login with: horvath.jan@rewardly.online / L$9ekp/5@8CP7V#
- Look for test email with subject: "✅ Test Email from Agentic Email System"

## If it works ✅
Report back: "Email test successful! Message received."

## If it fails ❌
Share the error message so we can debug.

---
**Domain:** rewardly.online
**Email Service:** Namecheap Private Email
**Test Script:** quick-test.js
