# SPARC v2.0 - Branch-Organized Development

**Version**: 2.0
**Created**: 2025-11-21
**Methodology**: SPARC (Specification, Pseudocode, Architecture, Refinement, Completion)
**Organization**: Branch-based workflow tracking

---

## Overview

SPARC v2.0 reorganizes the methodology to align with git branch structure, making it easier to track work across different development sessions and branches.

## Structure

```
docs/sparc-v2.0/
├── README.md                       ← You are here
├── VERSION.md                      ← Version history and changelog
├── MASTER_TRACKER.md               ← Overall project status
│
├── branches/                       ← Branch-specific documentation
│   ├── initial-project-checkout/  ← Session 01DHx3UixR5tfLZc2ccEGLUk
│   ├── review-agent/               ← Session 01Gk8D2fpUbdCfZotE6SP6iy
│   └── agentic-further-dev/        ← Original auth+docker branch
│
├── sessions/                       ← Session-based progress
│   ├── session-01/                 ← Initial checkout & SPARC setup
│   ├── session-02/                 ← (future sessions)
│   └── template/                   ← Template for new sessions
│
├── milestones/                     ← Major achievements
│   ├── M1-baseline-documented.md   ← Phase 1 complete
│   ├── M2-auth-docker-recovered.md ← Recovery milestone
│   └── M3-mvp-ready.md             ← (future)
│
└── phases/                         ← SPARC phase documentation
    ├── 1-specification/
    │   ├── current-state.md
    │   ├── requirements.md
    │   └── assessments/
    ├── 2-pseudocode/
    ├── 3-architecture/
    ├── 4-refinement/
    └── 5-completion/
```

---

## Version 2.0 Improvements

### What's New

1. **Branch-Based Organization**
   - Each branch gets its own documentation folder
   - Track what work happened in which branch
   - Clear merge history and relationships

2. **Session Tracking**
   - Each development session documented separately
   - Session ID from branch name (e.g., 01DHx3UixR5tfLZc2ccEGLUk)
   - Progress tracked per session

3. **Milestone Markers**
   - Major achievements documented as milestones
   - Clear "doneness" criteria
   - Easy to see project evolution

4. **Phase Separation**
   - Each SPARC phase in its own directory
   - Sub-documents for different aspects
   - Better organization than single huge files

### Differences from v1.0

| Aspect | v1.0 | v2.0 |
|--------|------|------|
| Organization | Single flat directory | Branch/session hierarchy |
| Tracking | Single progress tracker | Master + branch trackers |
| Documentation | Large monolithic files | Smaller focused files |
| History | Linear log | Branch-aware timeline |
| Recovery | Single guide | Branch-specific guides |
| Versioning | None | Explicit version tracking |

---

## How to Use

### For Active Development

1. **Check current session**:
   ```bash
   # See MASTER_TRACKER.md for current session
   # Navigate to branches/[session-id]/
   ```

2. **Update session docs**:
   - Progress in `branches/[session-id]/PROGRESS.md`
   - Decisions in `branches/[session-id]/DECISIONS.md`
   - Issues in `branches/[session-id]/ISSUES.md`

3. **Track milestones**:
   - When major work completes, create milestone doc
   - Reference from MASTER_TRACKER.md

### For Understanding Project

1. **Start with MASTER_TRACKER.md**
   - Overall status
   - Current phase
   - Active branches

2. **Review milestones/**
   - See major achievements
   - Understand project evolution

3. **Dive into branches/**
   - Detailed session work
   - Branch-specific decisions

---

## Branch Naming Convention

Branches follow pattern: `claude/[purpose]-[session-id]`

**Examples**:
- `claude/initial-project-checkout-01DHx3UixR5tfLZc2ccEGLUk`
- `claude/review-agent-01Gk8D2fpUbdCfZotE6SP6iy`
- `claude/agentic-further-development-011CV59FqUZ8YAWjFZYJBC4p`

**Session ID**: Unique identifier for tracking (from branch name)

---

## Active Branches

### Current Branch: initial-project-checkout
**Session ID**: 01DHx3UixR5tfLZc2ccEGLUk
**Status**: Active ✅
**Phase**: 1 (Specification) - Complete
**Docs**: `branches/initial-project-checkout/`

### Other Branch: review-agent
**Session ID**: 01Gk8D2fpUbdCfZotE6SP6iy
**Status**: Merged (contains auth+docker origin)
**Phase**: N/A
**Docs**: `branches/review-agent/`

---

## Migration from v1.0

### v1.0 Files → v2.0 Location

```
v1.0 → v2.0

docs/sparc/
├── 1-specification.md              → phases/1-specification/overview.md
├── progress-tracker.md             → MASTER_TRACKER.md
├── recovery-guide.md               → branches/initial-project-checkout/recovery-guide.md
├── recovery-completion-report.md   → milestones/M2-auth-docker-recovered.md
├── assessments/                    → phases/1-specification/assessments/
│   ├── current-state.md           → (kept same)
│   ├── implementation-status.md   → (kept same)
│   └── test-coverage.md           → (kept same)
└── 2-5-*.md                       → phases/*/template.md
```

### Preserved

- All v1.0 documentation preserved in `docs/sparc/`
- v2.0 is additive, not destructive
- Cross-references maintained

---

## Contributing

When working on new features:

1. Create new branch following naming convention
2. Create `branches/[session-id]/` directory
3. Copy `sessions/template/` for structure
4. Update MASTER_TRACKER.md with new session
5. Document decisions and progress
6. Create milestone when major work completes

---

## See Also

- `MASTER_TRACKER.md` - Overall project status
- `VERSION.md` - Changelog and version history
- `branches/*/` - Session-specific documentation
- `milestones/*/` - Major achievements
- `phases/*/` - SPARC phase details

---

**Version**: 2.0
**Last Updated**: 2025-11-21
**Next Version**: TBD
