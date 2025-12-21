# Security Policy

## Supported versions
- Only the latest release is supported.

## Reporting a vulnerability
Please use GitHub Security Advisories to report vulnerabilities privately.
If that is not available, open an issue and avoid sharing exploit details.

Include the following in your report:
- Steps to reproduce
- Impact assessment
- Affected versions
- Proposed remediation (if available)

## Security considerations
- This extension targets MV3 and must avoid remote code execution.
- Content scripts are treated as untrusted and must validate messages.
- Permissions follow least privilege and are documented in `docs/security/permissions.md`.

## Response timeline
- Acknowledge reports within 7 days.
- Provide remediation or status updates as work progresses.
