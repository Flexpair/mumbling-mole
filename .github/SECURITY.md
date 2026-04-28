# Security Policy

## Supported Versions

Security fixes are applied to the latest release on the `lite` branch.
Older releases are not maintained.

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| older   | :x:                |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report them privately via GitHub's
[private vulnerability reporting](https://github.com/Flexpair/mumbling-mole/security/advisories/new)
feature.

If you prefer email, write to `mail@flexpair.com` with:

- A description of the issue and its potential impact
- Steps to reproduce
- The version/commit you tested against
- Any suggested mitigation, if you have one

You should receive an initial acknowledgement within a few working days.
We will work with you on a fix and coordinate a disclosure timeline that
gives users time to update.

## Scope

In scope:

- The `mumbling-mole` web client and `auth-server`
- The Docker image published as `jafudi/mumbling-mole`
- Build scripts and configuration shipped in this repository

Out of scope:

- Third-party dependencies (please report upstream)
- Self-hosted deployments that diverge significantly from the published
  Docker image
- Issues that require physical access to a user's device
