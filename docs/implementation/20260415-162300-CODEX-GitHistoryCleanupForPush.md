# Git History Cleanup For Push

## Overview
Clean the local Git history so generated runtime artifacts and local Playwright MCP files are not present in the repository history, then push the cleaned `main` branch to the already-created private GitHub repository.

## Acceptance Criteria
- The repository history no longer contains `server/data/` blobs.
- The repository history no longer contains `.playwright-mcp/` blobs.
- `.gitignore` ignores those generated paths going forward.
- `git push -u origin main` succeeds against `https://github.com/ArchieDB-ai/AskEIDS.git`.

## Definition Of Done
- Cleanup method is documented.
- Validation commands are captured.
- Remote `main` is pushed successfully.
- Continuity ledger is updated with the cleanup outcome.

## Validation Mapping
- History cleanup: validate with `git rev-list --objects --all` path checks.
- Oversize object cleanup: validate with `git count-objects -vH` and remote push success.
- Ignore coverage: validate with `git diff -- .gitignore`.

## Implementation Checklist
- [x] Confirm the runtime artifact paths are safe to remove from Git history.
- [x] Update `.gitignore` to ignore generated runtime paths.
- [ ] Rewrite local history to remove `server/data/` and `.playwright-mcp/`.
- [ ] Verify the cleaned history no longer references those paths.
- [ ] Push cleaned `main` to `origin`.
- [ ] Update this document and the continuity ledger with proof.

## Notes
- Traditional automated tests are not the right proof layer for this task.
- The proof method here is Git-object inspection plus a successful push to the remote.
