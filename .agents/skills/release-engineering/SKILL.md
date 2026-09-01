---
name: release-engineering
description: Defines production release readiness, versioning, deployment evidence, rollback and release governance for software delivery.
---

# Release Engineering Skill

Use this skill for production releases, version changes, deployment preparation and release readiness.

## Required checks

- Requirements and acceptance criteria are complete.
- Lint, typecheck, tests and build pass.
- Security blockers are resolved.
- Database migrations are reviewed and deployable.
- Required environment variable names are documented without secret values.
- Observability exists for critical flows.
- Rollback or recovery steps are documented.
- Breaking changes are explicitly identified.
- Changelog/release notes are updated when appropriate.

## Release principle

A release is not "ready" because the code builds.

It is ready when:
- the change is understood,
- the risks are known,
- the system can be observed,
- the deployment is controlled,
- and recovery is possible.
