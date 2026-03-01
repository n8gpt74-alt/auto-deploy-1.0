# Plan: Review and Controlled Run of npx get-shit-done-cc@latest

## Goal
Provide an evidence-based safety review for npx get-shit-done-cc@latest and define the smallest safe execution path.

## Constraints
- Source code and project files must remain unchanged during planning.
- Running npx get-shit-done-cc@latest executes third-party installer code.
- User selected review-first mode before any execution.

## Facts (verified)
- Package metadata from npm:
  - version: 1.22.0
  - license: MIT
  - homepage/repo: https://github.com/glittercowboy/get-shit-done
  - maintainer: glittercowboy
  - modified: 2026-02-28T03:31:25.946Z
  - unpacked size: 1267944 bytes
- Package CLI entry point is bin/install.js.
- Installer behavior from install.js (static review):
  - writes and updates runtime config folders (.claude, .opencode, .gemini, .codex)
  - edits settings and hooks
  - creates skills, commands, agents, and config files
  - supports uninstall and can remove previously installed GSD files
- README explicitly promotes permission-relaxing workflows for some runtimes.

## Assumptions
- Intended target is project usage for Codex/OpenCode style workflows.
- Preferred blast radius is local project scope, not global home-directory install.

## Risk Assessment
- Security: high impact, medium likelihood (remote package execution + config writes).
- Reliability: medium impact, medium likelihood (interactive prompts and runtime-specific behavior).
- Operations: medium impact, high likelihood (expected filesystem/config modifications).
- Residual risk decision: reduce risk via non-interactive local-only flags and verification after run.

## Minimal-Change Proposed Flow
1. Non-mutating preflight: run npx get-shit-done-cc@latest --help.
2. If acceptable, execute local scoped install in project directory only:
   - npx get-shit-done-cc@latest --codex --local
3. Verify created files and review diffs in the project folder.
4. Stop if unexpected files/permissions appear.

## Verification
- Quick signal: help command returns usage text and exits successfully.
- Execution signal: installer reports Done for the selected runtime.
- Regression/safety check:
  - confirm only expected folders/files were created (for local codex: .codex/*)
  - inspect changed files before any commit
  - ensure no unrelated project source files were modified unexpectedly

## Rollout / Rollback
- Rollout: local only first (project scope), then optional global install later if needed.
- Rollback: run uninstall command with matching scope/runtime, then manually verify cleanup.

## Open Questions
- Proceed with preflight help command now.
- If preflight is clean, proceed with codex local install or keep review-only state.

## Latest Verification Result
- Executed preflight in project directory: C:\Users\Nikolay\Desktop\ZZZZ\oneclickdeploy
- Command run: npx get-shit-done-cc@latest --help
- Result: help/usage output displayed successfully.
- Post-check: no local runtime install directory created in project root (for example .codex).
