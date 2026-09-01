---
name: async-systems
description: Reusable guidance for async systems.
---

# Async Systems Skill
Assume duplicated/delayed delivery. Make jobs idempotent, bounded, observable and retry-safe. Prefer transactional outbox when DB state must couple atomically to emitted work.
