import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/error-handler';
import { format } from 'date-fns';

function formatINR(value: number | null): string {
  if (!value) return 'Not specified';
  return `INR ${value.toLocaleString('en-IN')}`;
}

function escapeCSV(value: string | null | undefined): string {
  if (!value) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const exportService = {
  async exportTendersCSV(tenderIds: string[]): Promise<string> {
    const tenders = await prisma.tender.findMany({
      where: { id: { in: tenderIds } },
      orderBy: { publishedDate: 'desc' },
    });

    if (tenders.length === 0) {
      throw new AppError('No tenders found', 404, 'NOT_FOUND');
    }

    const headers = [
      'Title',
      'Organization',
      'Category',
      'State',
      'Estimated Value',
      'EMD',
      'Published Date',
      'Deadline',
      'Status',
      'Source Portal',
      'Reference Number',
    ];

    const rows = tenders.map((t) => [
      escapeCSV(t.title),
      escapeCSV(t.organization),
      escapeCSV(t.category),
      escapeCSV(t.state),
      formatINR(t.estimatedValue),
      formatINR(t.emdAmount),
      format(t.publishedDate, 'dd-MM-yyyy'),
      format(t.bidSubmissionDeadline, 'dd-MM-yyyy'),
      escapeCSV(t.status),
      escapeCSV(t.sourcePortal),
      escapeCSV(t.referenceNumber),
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    return csv;
  },

  async exportTenderPDF(tenderId: string): Promise<string> {
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      include: { documents: true },
    });

    if (!tender) {
      throw new AppError('Tender not found', 404, 'NOT_FOUND');
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tender.title} - TenderBazaar</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; color: #1B2845; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #FF6B35, #e55a2b); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
    .header h1 { font-size: 20px; margin-bottom: 8px; }
    .header p { font-size: 14px; opacity: 0.9; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: rgba(255,255,255,0.2); margin-right: 8px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 16px; color: #FF6B35; border-bottom: 2px solid #FF6B35; padding-bottom: 6px; margin-bottom: 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field { margin-bottom: 10px; }
    .field .label { font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; margin-bottom: 2px; }
    .field .value { font-size: 14px; font-weight: 500; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    .description { font-size: 14px; line-height: 1.6; color: #374151; }
    .docs { list-style: none; }
    .docs li { padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <div style="margin-bottom: 10px;">
      <span class="badge">${tender.category}</span>
      <span class="badge">${tender.tenderType}</span>
      <span class="badge">${tender.status}</span>
    </div>
    <h1>${tender.title}</h1>
    <p>${tender.organization}${tender.department ? ` - ${tender.department}` : ''}</p>
  </div>

  <div class="section">
    <h2>Tender Details</h2>
    <div class="grid">
      <div class="field">
        <div class="label">Reference Number</div>
        <div class="value">${tender.referenceNumber}</div>
      </div>
      <div class="field">
        <div class="label">State / District</div>
        <div class="value">${tender.state}${tender.district ? `, ${tender.district}` : ''}</div>
      </div>
      <div class="field">
        <div class="label">Estimated Value</div>
        <div class="value">${formatINR(tender.estimatedValue)}</div>
      </div>
      <div class="field">
        <div class="label">EMD Amount</div>
        <div class="value">${formatINR(tender.emdAmount)}</div>
      </div>
      <div class="field">
        <div class="label">Published Date</div>
        <div class="value">${format(tender.publishedDate, 'dd MMM yyyy')}</div>
      </div>
      <div class="field">
        <div class="label">Bid Submission Deadline</div>
        <div class="value">${format(tender.bidSubmissionDeadline, 'dd MMM yyyy, hh:mm a')}</div>
      </div>
      <div class="field">
        <div class="label">Source Portal</div>
        <div class="value">${tender.sourcePortal}</div>
      </div>
      <div class="field">
        <div class="label">Tender Type</div>
        <div class="value">${tender.tenderType}</div>
      </div>
    </div>
  </div>

  ${tender.description ? `
  <div class="section">
    <h2>Description</h2>
    <p class="description">${tender.description}</p>
  </div>` : ''}

  ${tender.aiSummary ? `
  <div class="section">
    <h2>AI Summary</h2>
    <p class="description">${tender.aiSummary}</p>
  </div>` : ''}

  <div class="section">
    <h2>Eligibility Requirements</h2>
    <div class="grid">
      <div class="field">
        <div class="label">Min Turnover</div>
        <div class="value">${formatINR(tender.minTurnover)}</div>
      </div>
      <div class="field">
        <div class="label">Min Net Worth</div>
        <div class="value">${formatINR(tender.minNetWorth)}</div>
      </div>
      <div class="field">
        <div class="label">Min Experience</div>
        <div class="value">${tender.minExperience ? `${tender.minExperience} years` : 'Not specified'}</div>
      </div>
      <div class="field">
        <div class="label">MSME Reserved</div>
        <div class="value">${tender.reservedForMSME ? 'Yes' : 'No'}</div>
      </div>
    </div>
  </div>

  ${tender.documents.length > 0 ? `
  <div class="section">
    <h2>Documents</h2>
    <ul class="docs">
      ${tender.documents.map((d) => `<li>${d.name} (${d.fileType || 'Document'})</li>`).join('')}
    </ul>
  </div>` : ''}

  <div class="footer">
    <p>Generated by TenderBazaar on ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
    <p>Source: ${tender.sourceUrl}</p>
  </div>
</body>
</html>`;

    return html;
  },

  async exportEligibilityReport(checkId: string, userId: string): Promise<string> {
    const check = await prisma.eligibilityCheck.findFirst({
      where: { id: checkId, userId },
      include: { tender: true },
    });

    if (!check) {
      throw new AppError('Eligibility check not found', 404, 'NOT_FOUND');
    }

    const criteria = check.criteria as Array<{
      name: string;
      met: boolean;
      details?: string;
    }>;

    const suggestions = check.suggestions as Array<{
      title: string;
      description: string;
    }> | null;

    const scoreColor = check.score >= 70 ? '#00D4AA' : check.score >= 40 ? '#f59e0b' : '#ef4444';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eligibility Report - ${check.tender.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; color: #1B2845; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #1B2845, #2d3f5e); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
    .header h1 { font-size: 18px; margin-bottom: 8px; }
    .header p { font-size: 14px; opacity: 0.8; }
    .score-card { text-align: center; padding: 24px; background: #f9fafb; border-radius: 12px; margin-bottom: 24px; }
    .score { font-size: 48px; font-weight: 800; color: ${scoreColor}; }
    .score-label { font-size: 14px; color: #6b7280; margin-top: 4px; }
    .eligibility { font-size: 16px; font-weight: 600; margin-top: 8px; color: ${check.isEligible ? '#00D4AA' : '#ef4444'}; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 16px; color: #FF6B35; border-bottom: 2px solid #FF6B35; padding-bottom: 6px; margin-bottom: 14px; }
    .criteria-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
    .criteria-icon { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; flex-shrink: 0; margin-top: 2px; }
    .criteria-met { background: #00D4AA; }
    .criteria-not-met { background: #ef4444; }
    .criteria-name { font-weight: 600; font-size: 14px; }
    .criteria-details { font-size: 13px; color: #6b7280; margin-top: 2px; }
    .suggestion { padding: 12px; background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 0 8px 8px 0; margin-bottom: 10px; }
    .suggestion h4 { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
    .suggestion p { font-size: 12px; color: #4b5563; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Eligibility Report</h1>
    <p>${check.tender.title}</p>
    <p style="margin-top: 4px;">${check.tender.organization}</p>
  </div>

  <div class="score-card">
    <div class="score">${Math.round(check.score)}%</div>
    <div class="score-label">Eligibility Score</div>
    <div class="eligibility">${check.isEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}</div>
  </div>

  <div class="section">
    <h2>Criteria Assessment</h2>
    ${Array.isArray(criteria) ? criteria.map((c) => `
    <div class="criteria-item">
      <div class="criteria-icon ${c.met ? 'criteria-met' : 'criteria-not-met'}">${c.met ? '✓' : '✗'}</div>
      <div>
        <div class="criteria-name">${c.name}</div>
        ${c.details ? `<div class="criteria-details">${c.details}</div>` : ''}
      </div>
    </div>`).join('') : '<p>No criteria data available.</p>'}
  </div>

  ${suggestions && suggestions.length > 0 ? `
  <div class="section">
    <h2>Suggestions for Improvement</h2>
    ${suggestions.map((s) => `
    <div class="suggestion">
      <h4>${s.title}</h4>
      <p>${s.description}</p>
    </div>`).join('')}
  </div>` : ''}

  <div class="footer">
    <p>Generated by TenderBazaar on ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
  </div>
</body>
</html>`;

    return html;
  },

  async exportSavedTendersCSV(userId: string): Promise<string> {
    const savedTenders = await prisma.savedTender.findMany({
      where: { userId },
      include: { tender: true },
      orderBy: { createdAt: 'desc' },
    });

    if (savedTenders.length === 0) {
      throw new AppError('No saved tenders found', 404, 'NOT_FOUND');
    }

    const tenderIds = savedTenders.map((st) => st.tender.id);
    return this.exportTendersCSV(tenderIds);
  },
};
