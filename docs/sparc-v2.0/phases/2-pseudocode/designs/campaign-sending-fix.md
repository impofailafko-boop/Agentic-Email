# Pseudocode: Fix Campaign Sending (Remove Mock)

**File**: `src/services/campaign.service.ts`
**Problem**: Line 647 has mock code that doesn't actually send emails
**Goal**: Make campaigns actually send bulk emails to real recipients

---

## Current Code Analysis

```typescript
// Line 647 - CURRENT (BROKEN):
campaign.metrics.sent += 100; // Just increments, doesn't send!
```

**What's wrong**:
- Increments counter by 100 without sending any emails
- No actual email sending happens
- Mock recipients generated at line 660 (`user0@example.com`, etc.)
- Campaign thinks it sent emails but nothing was delivered

---

## Solution Design

### Algorithm: Real Campaign Execution

```pseudocode
FUNCTION executeCampaign(campaignId):
    // 1. Get campaign details
    campaign = GET campaign by campaignId
    IF campaign is NULL:
        THROW error "Campaign not found"
    END IF

    // 2. Validate campaign is ready
    IF campaign.status != 'scheduled':
        THROW error "Campaign is not scheduled"
    END IF

    IF campaign.recipients.length == 0:
        THROW error "No recipients for campaign"
    END IF

    // 3. Set campaign to active
    campaign.status = 'active'
    campaign.startedAt = NOW()
    UPDATE campaign in database

    // 4. Get email service (Gmail/SMTP for now)
    emailService = GET emailService instance

    // 5. Process each recipient
    totalSent = 0
    totalFailed = 0

    FOR EACH recipient IN campaign.recipients:
        TRY:
            // 5a. Generate personalized content
            subject = PERSONALIZE(campaign.content.subject, recipient)
            body = PERSONALIZE(campaign.content.body, recipient)

            // 5b. Actually send the email
            emailData = {
                to: [recipient.email],
                from: campaign.sender.email,
                subject: subject,
                body: body,
                htmlBody: campaign.content.htmlBody,
                category: 'campaign',
                metadata: {
                    campaignId: campaign.id,
                    recipientId: recipient.id
                }
            }

            result = emailService.send(emailData)

            // 5c. Track success
            totalSent++
            campaign.metrics.sent++
            campaign.metrics.delivered++ // Assume delivered for now

            // 5d. Add to sent list
            campaign.sentTo.push({
                email: recipient.email,
                sentAt: NOW(),
                messageId: result.messageId,
                status: 'sent'
            })

            // 5e. Rate limiting (avoid spam filters)
            IF totalSent % 100 == 0:
                SLEEP(1000) // 1 second pause every 100 emails
            END IF

        CATCH error:
            // 5f. Track failure
            totalFailed++
            LOG error "Failed to send to " + recipient.email

            campaign.sentTo.push({
                email: recipient.email,
                sentAt: NOW(),
                status: 'failed',
                error: error.message
            })
        END TRY

        // 5g. Update progress every 10 emails
        IF totalSent % 10 == 0:
            UPDATE campaign.metrics in database
        END IF
    END FOR

    // 6. Finalize campaign
    campaign.status = 'completed'
    campaign.completedAt = NOW()
    campaign.metrics.failed = totalFailed
    UPDATE campaign in database

    // 7. Log summary
    LOG "Campaign " + campaignId + " completed"
    LOG "Sent: " + totalSent + ", Failed: " + totalFailed

    RETURN campaign
END FUNCTION
```

---

## Helper Function: Personalization

```pseudocode
FUNCTION personalizeContent(template, recipient):
    // Replace placeholders with recipient data
    content = template

    // Standard replacements
    content = REPLACE(content, "{{firstName}}", recipient.firstName || "")
    content = REPLACE(content, "{{lastName}}", recipient.lastName || "")
    content = REPLACE(content, "{{name}}", recipient.name || recipient.firstName)
    content = REPLACE(content, "{{email}}", recipient.email)
    content = REPLACE(content, "{{company}}", recipient.company || "")
    content = REPLACE(content, "{{title}}", recipient.title || "")

    // Custom fields
    FOR EACH key, value IN recipient.customFields:
        placeholder = "{{" + key + "}}"
        content = REPLACE(content, placeholder, value)
    END FOR

    RETURN content
END FUNCTION
```

---

## Error Handling Strategy

```pseudocode
// Different types of errors during sending:

1. Transient Errors (retry):
   - Network timeout
   - Rate limit hit
   - SMTP server busy
   ACTION: Retry up to 3 times with exponential backoff

2. Permanent Errors (don't retry):
   - Invalid email address
   - Recipient blocked sender
   - Email too large
   ACTION: Mark as failed, continue to next

3. Critical Errors (pause campaign):
   - SMTP authentication failed
   - Sender email suspended
   - Out of credits
   ACTION: Pause campaign, notify admin
```

---

## Rate Limiting Design

```pseudocode
FUNCTION applyRateLimiting(emailsSent, provider):
    // Different limits per provider

    IF provider == "gmail":
        // Gmail: 500/day for free, 2000/day for Workspace
        IF emailsSent >= 500:
            SLEEP until next day
        END IF

        // Also: max 100/hour
        IF emailsSent % 100 == 0:
            SLEEP(3600000) // 1 hour
        END IF

    ELSE IF provider == "sendgrid":
        // SendGrid: depends on plan, typically 100k/day
        // Apply burst protection
        IF emailsSent % 1000 == 0:
            SLEEP(1000) // 1 second every 1000 emails
        END IF

    ELSE IF provider == "ses":
        // AWS SES: 14 emails/second typical limit
        SLEEP(100) // 100ms between emails = ~10/second
    END IF
END FUNCTION
```

---

## Progress Tracking Design

```pseudocode
FUNCTION updateCampaignProgress(campaign):
    // Calculate percentages
    totalRecipients = campaign.recipients.length
    sent = campaign.metrics.sent

    campaign.metrics.progress = (sent / totalRecipients) * 100
    campaign.metrics.estimatedCompletion = CALCULATE_ETA(sent, totalRecipients)

    // Update in database
    UPDATE campaign.metrics

    // Emit websocket event for real-time dashboard
    EMIT("campaign:progress", {
        campaignId: campaign.id,
        progress: campaign.metrics.progress,
        sent: sent,
        total: totalRecipients
    })
END FUNCTION
```

---

## Queue Integration (For Large Campaigns)

```pseudocode
// For campaigns with 1000+ recipients, use job queue

FUNCTION executeLargeCampaign(campaignId):
    campaign = GET campaign by campaignId
    recipients = campaign.recipients

    // Split into batches of 100
    batches = SPLIT recipients into chunks of 100

    FOR EACH batch IN batches:
        // Add job to queue
        campaignQueue.add({
            name: 'send-batch',
            data: {
                campaignId: campaign.id,
                recipients: batch,
                batchNumber: INDEX
            },
            options: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                }
            }
        })
    END FOR

    LOG "Campaign " + campaignId + " queued with " + batches.length + " batches"
END FUNCTION

// Worker processes batches
FUNCTION processCampaignBatch(job):
    campaignId = job.data.campaignId
    recipients = job.data.recipients

    FOR EACH recipient IN recipients:
        // Send email (same logic as above)
        TRY:
            SEND email to recipient
            INCREMENT campaign.metrics.sent
        CATCH error:
            LOG error
            INCREMENT campaign.metrics.failed
        END TRY
    END FOR

    UPDATE campaign progress
END FUNCTION
```

---

## Changes Required

### File: `src/services/campaign.service.ts`

**Line 640-650** (Current mock code):
```typescript
// REMOVE THIS:
campaign.metrics.sent += 100; // Mock sending

// REPLACE WITH:
await this.sendCampaignEmails(campaign);
```

**New method to add**:
```typescript
private async sendCampaignEmails(campaign: EmailCampaign): Promise<void> {
    // Implementation based on pseudocode above
}
```

### Dependencies Needed

**Already have**:
- ✅ Email service (`src/services/email.service.ts`)
- ✅ Campaign queue (Bull)
- ✅ Database service

**Don't need new packages** - everything exists!

---

## Testing Strategy

```pseudocode
TEST "Campaign sending actually sends emails":
    // Setup
    campaign = CREATE campaign with 5 test recipients
    mockEmailService = MOCK email service

    // Execute
    EXECUTE campaign

    // Verify
    ASSERT mockEmailService.send was called 5 times
    ASSERT campaign.metrics.sent == 5
    ASSERT campaign.status == 'completed'
END TEST

TEST "Campaign handles sending failures":
    // Setup
    campaign = CREATE campaign with 3 recipients
    mockEmailService = MOCK with failures on email #2

    // Execute
    EXECUTE campaign

    // Verify
    ASSERT campaign.metrics.sent == 2
    ASSERT campaign.metrics.failed == 1
    ASSERT campaign.status == 'completed'
END TEST

TEST "Campaign respects rate limits":
    // Setup
    campaign = CREATE campaign with 150 recipients (Gmail limit test)

    // Execute
    startTime = NOW()
    EXECUTE campaign
    duration = NOW() - startTime

    // Verify
    ASSERT duration >= expected time with rate limiting
    ASSERT no rate limit errors occurred
END TEST
```

---

## Migration Path

**Step 1**: Add real sending function (keep mock as fallback)
**Step 2**: Test with 1 recipient
**Step 3**: Test with 10 recipients
**Step 4**: Test with 100 recipients
**Step 5**: Remove mock code entirely
**Step 6**: Deploy to production

---

## Estimated Implementation Time

- Write `sendCampaignEmails()` method: **1 hour**
- Add personalization helper: **30 minutes**
- Add error handling: **30 minutes**
- Add rate limiting: **30 minutes**
- Write tests: **1 hour**
- Integration testing: **1 hour**

**Total**: ~4-5 hours

---

## Success Criteria

- [ ] Campaign sends to ALL recipients in list
- [ ] Each email is personalized correctly
- [ ] Failed sends are tracked and logged
- [ ] Rate limiting prevents spam filters
- [ ] Progress updates in real-time
- [ ] Tests verify actual sending (not mock)
- [ ] Zero `Mock sending` comments in code

---

**Phase**: 2 (Pseudocode)
**Next Phase**: 4 (Refinement - actual coding)
**Created**: 2025-11-21
