# Tagged Release Runbook

This runbook standardizes a lightweight tagged release with deterministic preflight checks.

## 1) Preconditions

- Branch is synced and CI is green.
- Working tree is clean.
- You have push permission to `origin`.
- Local Node/npm toolchain is healthy.

## 2) Dry-run preflight (required)

```bash
scripts/release/tagged-release.sh vX.Y.Z --dry-run
```

Dry-run performs:
- backend `npm run check && npm run build`
- frontend `npm run test && npm run build`
- acceptance smoke with `/api/ready` + `/api/metrics` checks enabled

No git tag is created during dry-run.

## 3) Real release tag

```bash
scripts/release/tagged-release.sh vX.Y.Z
```

This re-runs preflight and only then:
- creates annotated tag `vX.Y.Z`
- pushes tag to origin

## 4) Verify post-tag

- Confirm CI runs on tag/commit as expected.
- Confirm release notes/changelog references the tag.
- Confirm deploy pipeline picked up the new tag (if applicable).

## 5) Rollback

If regression is detected:
1. Stop rollout/traffic shift.
2. Redeploy previous known-good tag.
3. Record incident details and root-cause follow-up.
4. Publish a superseding fix tag (do not rewrite or delete history tags unless policy explicitly requires it).
