/**
 * Turn `pnpm audit --json` output into a human-readable finding count and write
 * it to the workflow run summary.
 *
 * Why this exists: the Security Audit workflow used to run
 * `pnpm audit --audit-level=high || true`, which made the job succeed no matter
 * what it found. The scheduled run on `main` (39187891265) was green while the
 * tree carried 6 critical and 109 high advisories, so the only signal the
 * workflow produced was a misleading one.
 *
 * This reports what was found instead of hiding it. It deliberately does NOT
 * fail the run: the critical advisories currently on this tree need a Next.js
 * 15 migration and transitive-dependency work that an audit job cannot do, and
 * a job that fails every week is a job everyone learns to ignore. It exits
 * non-zero only when it cannot produce a trustworthy answer at all, because
 * "the audit did not run" must never look like "the audit found nothing".
 *
 * Usage: node scripts/audit-summary.js <audit.json>
 */
'use strict';

const fs = require('fs');

const SEVERITIES = ['critical', 'high', 'moderate', 'low', 'info'];

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: node scripts/audit-summary.js <audit.json>');
    return 2;
  }

  let report;
  try {
    report = JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    // An unreadable or unparseable report means the audit itself failed. Fail
    // loudly rather than reporting zero findings.
    console.error(`Could not read ${path} as pnpm audit JSON: ${error.message}`);
    return 2;
  }

  const counts = (report.metadata && report.metadata.vulnerabilities) || {};
  const at = (severity) => Number(counts[severity]) || 0;
  const total = SEVERITIES.reduce((sum, severity) => sum + at(severity), 0);

  const lines = [
    '## pnpm audit',
    '',
    '| Severity | Advisories |',
    '| --- | --- |',
    ...SEVERITIES.map((severity) => `| ${severity} | ${at(severity)} |`),
    `| **total** | **${total}** |`,
    '',
  ];

  // Name the critical packages, so the summary is actionable without digging
  // through the raw log.
  const advisories = Object.values(report.advisories || {});
  const critical = advisories.filter((advisory) => advisory.severity === 'critical');
  if (critical.length > 0) {
    lines.push('### Critical', '');
    for (const advisory of critical) {
      const fixed = advisory.patched_versions || 'no patch listed';
      lines.push(`- **${advisory.module_name}** ${advisory.vulnerable_versions} → fixed in ${fixed}`);
    }
    lines.push('');
  }

  const summary = lines.join('\n');
  console.log(summary);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }

  if (at('critical') > 0) {
    console.log(`::warning::${at('critical')} critical advisories - see the job summary`);
  }

  return 0;
}

process.exit(main());
