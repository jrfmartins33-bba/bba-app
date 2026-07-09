---
description: Check GitHub Actions CI status and Vercel deployment status for the current branch (or a given PR/branch), report what's failing, and say whether it's still safe to keep watching or done.
---

Check the health of the current push/PR without the user having to poll manually. Target: `$ARGUMENTS` (a branch name or PR number) if given, otherwise the current git branch (`git branch --show-current`) and its latest commit (`git rev-parse HEAD`).

## 1. CI (GitHub Actions)

Repo is `jrfmartins33-bba/bba-app` (see `.github/workflows/ci.yml` — single job: typecheck, lint, build, test). `gh` CLI is not installed locally, so use the REST API directly:

```
curl -s "https://api.github.com/repos/jrfmartins33-bba/bba-app/actions/runs?branch=<branch>&per_page=3"
```

If a run's `conclusion` is `failure`, fetch its jobs (`.../actions/runs/<id>/jobs`) and pull the failing step name plus enough of the log to show why (the workflow uploads `test-output.log` as an artifact on failure too — mention it exists, don't try to download it via unauthenticated curl since artifact downloads need an auth token).

## 2. Deploy (Vercel)

Use the Vercel MCP tools, not curl: `list_deployments` (filter to this branch/commit), then `get_deployment` for its state. If `ERROR`, pull `get_deployment_build_logs`. If `READY`, check `get_runtime_errors` for anything new since the last check.

## 3. Report

One line per check: ✅ passed / ❌ failed (with the specific failing step + one-line cause) / ⏳ still running. Then one verdict:

- **Everything green** → say so plainly, and say the loop can stop (if this was invoked from `/loop`, that's the signal to call `ScheduleWakeup` with `stop: true`).
- **Still running** → say what's still pending, nothing to act on yet.
- **Something failed** → name the file/test/step, don't just say "CI failed." If the fix is obvious and small (e.g. a lint rule), say so; otherwise stop and let the user decide — this command reports, it does not push fixes on its own.

Don't re-explain what CI or Vercel are. Keep the report under ~10 lines unless there's a failure that needs the detail.
