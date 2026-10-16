# Repository automation

This fork has no GitHub Actions workflows, composite actions, or Dependabot
schedule. Pushes, pull requests, tags, releases, comments, and scheduled GitHub
events have no checked-in jobs to run. This includes CI, deployment, npm and
desktop publishing, mobile builds and submissions, contributor approval, and
cache maintenance.

AI gateway cron schedules are explicitly empty in both production and staging
configuration. Existing cloud deployments are unaffected by local file changes;
applying the empty schedules requires a separately requested manual cloud change.

Local install, build, development, and test commands remain available. The install
setup builds local generated assets. Deployment commands and cloud configuration
remain available for explicitly requested manual work, including their domain
routes and database bindings. Do not run deployment commands as verification of
this change.

The upstream release and CI guides describe workflows that have been removed
from this fork. They do not establish automation here. Version checks can still
be run manually:

```sh
node scripts/check-version-lockstep.mjs
node scripts/check-plugin-sdk-version.mjs
```

## Hosted settings

Verified on October 16, 2026: GitHub Actions is disabled for
`cabra-arretado/lol`. GitHub reports no workflow runs, repository webhooks,
deployment records, check runs, or GitHub Pages site.

File removal takes effect on GitHub after these changes are committed and pushed
to the relevant branches. Hosted integrations cannot be disabled through file
removal alone. Keep the following settings in place in `cabra-arretado/lol`:

- Disable Actions under repository Settings → Actions → General.
- Cancel queued or running workflow runs.
- Review Settings → Webhooks and installed GitHub Apps for deployment integrations.
- Review connected hosting services for Git-triggered builds, deploy hooks, and
  scheduled jobs. Do not change upstream `get-bb/bb` infrastructure.

Official references: [GitHub Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
and [Cloudflare cron trigger removal](https://developers.cloudflare.com/workers/configuration/cron-triggers/#remove-a-cron-trigger).
