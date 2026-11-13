# Security Policy

## Supported Versions

Security fixes are applied to the **latest published version** of each package released from this repository. Older versions do not receive backported fixes, so please upgrade to the latest release to get security updates.

| Version        | Supported          |
| -------------- | ------------------ |
| Latest release | :white_check_mark: |
| Older releases | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, report them privately using one of the following channels:

1. **GitHub Private Vulnerability Reporting** (preferred): open the [Security tab](https://github.com/telperiontech/telperion/security) of this repository and click **"Report a vulnerability"**.
2. **Email**: send details to **alisahinozcelik@gmail.com** with the subject line `[SECURITY] <package-name>: <short summary>`.

Please include as much of the following as you can:

- The affected package(s) and version(s) (e.g. `@telperion/js-utils@1.2.3`)
- The type of issue (e.g. XSS, prototype pollution, ReDoS, path traversal)
- Step-by-step instructions to reproduce the issue
- A minimal proof of concept or exploit code, if available
- The potential impact, including how an attacker might exploit it

## What to Expect

- **Acknowledgement** within 3 business days of your report.
- **Initial assessment** within 7 business days, including whether the report is accepted and its estimated severity.
- **Status updates** as the fix progresses.
- **Coordinated disclosure:** once a fix is released, we will publish a GitHub Security Advisory. We are happy to credit you in the advisory unless you prefer to remain anonymous.

Please give us a reasonable amount of time to address the issue before disclosing it publicly.

## Scope

This policy covers all packages and applications in this monorepo (`libs/*` and `apps/*`). Vulnerabilities in third-party dependencies should be reported to their respective maintainers; if such a vulnerability affects one of our packages in an exploitable way, please let us know as well.
