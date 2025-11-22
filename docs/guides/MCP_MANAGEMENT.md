# MCP Skill Management Guide

## Overview

`@foxruv/iris` treats MCPs as **on-demand skills** rather than auto-loaded tools. This approach:

- **Reduces context pollution** - MCPs aren't loaded until needed
- **Enables learning** - Every MCP call is tracked in AgentDB
- **Improves portability** - Project-local skills, not global dependencies
- **Facilitates optimization** - Iris can evaluate and improve MCP usage

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Claude Code                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  CLAUDE.md: "When you need X, check mcp-skills/"    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   mcp-skills/INDEX.md                       │
│  • stripe-billing.md                                        │
│  • github-api.md                                            │
│  • database-ops.md                                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              npx claude-flow mcp <skill-id>                 │
│                  --tool <tool-name>                         │
│                  --args '<json>'                            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      AgentDB                                │
│  • Track every MCP call                                     │
│  • Learn successful patterns                                │
│  • Detect drift and failures                                │
│  • Feed Iris for evaluation                           │
└─────────────────────────────────────────────────────────────┘
```

## Commands

### Initialize Project

```bash
npx foxruv-agent init
```

Creates:
- `CLAUDE.md` with FoxRuv operating instructions
- `mcp-skills/` directory with templates
- `docs/guides/MCP_MANAGEMENT.md` (this file)

### Import Global MCPs

```bash
npx foxruv-agent mcp import [options]
```

Options:
- `--backup` - Backup `~/.claude/settings.json` before modification (default: true)
- `--disable-global` - Remove `mcpServers` from global settings after import
- `--dry-run` - Show what would be imported without making changes

### Sync Skill Index

```bash
npx foxruv-agent mcp sync-index
```

Scans `mcp-skills/` and updates `INDEX.md` with all skill files.

## Skill File Format

Each skill is a markdown file in `mcp-skills/`:

```markdown
---
skill_id: stripe-billing
mcp_server: stripe
category: payments
tags: [billing, subscriptions, payments]
agent_db_tracking: true
---

# Stripe Billing MCP Skill

## Purpose
Manage Stripe subscriptions and billing operations.

## Tools Available

### create_subscription
Creates a new subscription for a customer.

**Usage:**
```bash
npx claude-flow mcp stripe-billing \
  --tool create_subscription \
  --args '{"customer_id":"cus_123","price_id":"price_abc"}'
```

## Examples

### Create Monthly Subscription
```bash
npx claude-flow mcp stripe-billing \
  --tool create_subscription \
  --args '{
    "customer_id": "cus_MXxYzZ123",
    "price_id": "price_monthly_pro",
    "trial_days": 14
  }'
```

## AgentDB Integration

Every call to this skill is automatically tracked in AgentDB with:
- Input/output examples
- Success/failure outcomes
- Latency and error patterns
- Usage frequency

Iris can evaluate this skill and suggest optimizations.
```

## How Claude Uses Skills

When Claude Code reads `CLAUDE.md`, it learns to:

1. **Detect when an MCP is needed**
   - User asks to "create a Stripe subscription"
   - Claude checks `mcp-skills/INDEX.md`
   - Opens `mcp-skills/stripe-billing.md`

2. **Propose a command**
   - Shows user the exact CLI command needed
   - Explains what it will do
   - Waits for approval

3. **Execute and learn**
   - Runs `npx claude-flow mcp ...`
   - Tracks result in AgentDB
   - Summarizes output for user

4. **Improve over time**
   - Iris evaluates MCP usage patterns
   - Suggests better argument patterns
   - Detects when skills are outdated

## Migration from Global MCPs

If you have MCPs in `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "stripe": {
      "command": "npx",
      "args": ["-y", "stripe-mcp-server"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    }
  }
}
```

Run:

```bash
npx foxruv-agent mcp import --backup --disable-global
```

This will:
1. Create `mcp-skills/stripe.md`
2. Create `mcp-skills/github.md`
3. Backup `~/.claude/settings.json` → `~/.claude/settings.json.backup`
4. Remove `mcpServers` block from global settings
5. Update `mcp-skills/INDEX.md`
6. Update `CLAUDE.md` MCP section

Now MCPs are project-local, versioned with your code, and tracked in AgentDB.

## Best Practices

### 1. One Skill Per MCP Server

```
mcp-skills/
  ├── stripe-billing.md      # Stripe MCP
  ├── github-api.md          # GitHub MCP
  └── postgres-db.md         # PostgreSQL MCP
```

### 2. Rich Examples

Include complete, copy-paste-ready examples:

```markdown
## Examples

### Create and Activate Subscription
```bash
# 1. Create customer
npx claude-flow mcp stripe-billing \
  --tool create_customer \
  --args '{"email":"user@example.com","name":"John Doe"}'

# 2. Create subscription
npx claude-flow mcp stripe-billing \
  --tool create_subscription \
  --args '{"customer_id":"OUTPUT_FROM_STEP_1","price_id":"price_123"}'
```
```

### 3. Document Failure Modes

```markdown
## Common Issues

### "Customer not found"
**Cause:** Invalid `customer_id`
**Fix:** Verify customer exists with `list_customers` first

### "Rate limit exceeded"
**Cause:** Too many API calls
**Fix:** Add delays between calls or batch operations
```

### 4. Link to External Docs

```markdown
## References
- [Stripe API Docs](https://stripe.com/docs/api)
- [MCP Server Repo](https://github.com/stripe/stripe-mcp-server)
- [Internal Billing Guide](../docs/billing-guide.md)
```

## Integration with Iris

Iris can:

1. **Evaluate MCP usage**
   ```bash
   npm run iris:evaluate -- --project my-app --filter mcp_usage
   ```

2. **Detect drift**
   - MCP commands that fail frequently
   - Args patterns that cause errors
   - Skills that are never used

3. **Suggest improvements**
   - "stripe-billing skill has 40% failure rate on `create_subscription` - add validation step"
   - "github-api skill unused for 30 days - consider removing"

4. **Auto-invoke on events**
   - When a new MCP is added to global settings
   - When skill docs are updated
   - When MCP call patterns change

## Troubleshooting

### MCPs not importing

Check `~/.claude/settings.json` exists and has `mcpServers` block:

```bash
cat ~/.claude/settings.json
```

### Skills not loading

Verify `CLAUDE.md` has MCP section:

```bash
grep -A 10 "MCP Skills" CLAUDE.md
```

### AgentDB not tracking

Ensure `agent_db_tracking: true` in skill frontmatter:

```yaml
---
skill_id: my-skill
agent_db_tracking: true
---
```

## Advanced: Custom Skill Generators

You can create custom skill generators for your own MCP servers:

```typescript
import { generateSkillFromMcp } from '@foxruv/iris/cli';

const skill = await generateSkillFromMcp({
  skillId: 'my-custom-skill',
  mcpServer: 'my-server',
  command: 'npx',
  args: ['-y', 'my-mcp-server'],
  category: 'custom',
  tags: ['internal', 'api']
});

await fs.writeFile('mcp-skills/my-custom-skill.md', skill);
```

See `src/cli/templates/` for template sources.
