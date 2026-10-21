// pako 3.x ships an ESM build with named exports only; there is no default export.
import { inflate } from 'pako';

export interface ExtractedEntities {
  gstin: string | null;
  allGstins: string[];
  gstinState: string | null;
  pan: string | null;
  allPans: string[];
  emd: string | null;
  turnover: string | null;
  tenderRef: string | null;
  deadline: string | null;
  detectedDocType: string;
  hasGstin: boolean;
  hasPan: boolean;
  fileSnippet: string;
}

export const GST_STATE_MAP: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

/**
 * Extracts plain text from various file formats (PDF, TXT, JSON, MD, CSV, DOC)
 */
export async function extractDocumentText(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  // 1. Plain text formats
  if (
    file.type.startsWith('text/') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.json') ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.csv') ||
    fileName.endsWith('.html') ||
    fileName.endsWith('.xml')
  ) {
    try {
      return await file.text();
    } catch {
      // fallback to arrayBuffer read
    }
  }

  // 2. Binary formats (PDF / DOC / DOCX / others)
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const binaryString = new TextDecoder('latin1').decode(bytes);
    const textPieces: string[] = [];

    // PDF stream decompression
    if (fileName.endsWith('.pdf') || binaryString.startsWith('%PDF')) {
      const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
      let match: RegExpExecArray | null;
      let streamsFound = 0;

      while ((match = streamRegex.exec(binaryString)) !== null && streamsFound < 60) {
        streamsFound++;
        const rawStream = match[1];
        const streamBuffer = new Uint8Array(
          rawStream.split('').map((c) => c.charCodeAt(0))
        );

        try {
          const decompressed = inflate(streamBuffer);
          const decStr = new TextDecoder('latin1').decode(decompressed);

          // Extract text inside PDF text operator parentheses: (text) Tj
          const tjMatches = decStr.match(/\(([^)]*)\)/g);
          if (tjMatches && tjMatches.length > 0) {
            const line = tjMatches.map((m) => m.slice(1, -1)).join(' ');
            if (line.trim().length > 2) textPieces.push(line);
          } else {
            // Check for ASCII words
            const words = decStr.match(/[A-Za-z0-9\s:,\.\-\/]{4,}/g);
            if (words) textPieces.push(words.join(' '));
          }
        } catch {
          // Uncompressed stream: extract printable ASCII
          const printable = rawStream.replace(/[^\x20-\x7E\t\n\r]/g, ' ').replace(/\s+/g, ' ');
          if (printable.trim().length > 15) {
            textPieces.push(printable);
          }
        }
      }

      // Check uncompressed BT ... ET blocks
      const btRegex = /BT[\s\S]*?ET/g;
      let btMatch: RegExpExecArray | null;
      while ((btMatch = btRegex.exec(binaryString)) !== null) {
        const textObj = btMatch[0];
        const strMatches = textObj.match(/\(([^)]*)\)/g);
        if (strMatches) {
          textPieces.push(strMatches.map((m) => m.slice(1, -1)).join(' '));
        }
      }
    }

    // Direct scan across all bytes for valid Indian GSTIN and PAN patterns
    const directGst = binaryString.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/g);
    if (directGst) textPieces.push(...directGst);

    const directPan = binaryString.match(/\b[A-Z]{5}\d{4}[A-Z]{1}\b/g);
    if (directPan) textPieces.push(...directPan);

    // Filter clean text
    const combined = textPieces.join('\n').replace(/\s+/g, ' ').trim();
    if (combined.length > 20) {
      return combined.slice(0, 30000);
    }

    // Fallback: extract all readable printable strings from file
    const printableAll = binaryString.replace(/[^\x20-\x7E\t\n\r]/g, ' ').replace(/\s+/g, ' ');
    return printableAll.slice(0, 15000).trim();
  } catch (err) {
    console.warn('Document parse error:', err);
    return '';
  }
}

/**
 * Extracts Indian procurement entities (GSTIN, PAN, EMD, Turnover, NIT, Dates)
 */
export function extractDocumentEntities(text: string, fileName?: string): ExtractedEntities {
  const clean = text || '';
  const fName = (fileName || '').toLowerCase();

  // 1. GSTIN (15-character Indian GST format)
  const gstinRegex = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/gi;
  const rawGstins = clean.match(gstinRegex) || [];
  const allGstins = Array.from(new Set(rawGstins.map((g) => g.toUpperCase())));
  const gstin = allGstins[0] || null;

  // 2. GST State
  let gstinState: string | null = null;
  if (gstin && gstin.length >= 2) {
    const code = gstin.slice(0, 2);
    gstinState = GST_STATE_MAP[code] || `State Code ${code}`;
  }

  // 3. PAN (10-character Indian PAN format)
  // Derived from GSTIN (chars 3 to 12) or matched independently
  let pan: string | null = null;
  if (gstin && gstin.length >= 12) {
    pan = gstin.slice(2, 12);
  } else {
    const panRegex = /\b[A-Z]{5}\d{4}[A-Z]{1}\b/gi;
    const rawPans = clean.match(panRegex) || [];
    pan = rawPans[0]?.toUpperCase() || null;
  }
  const allPans = pan ? [pan] : [];

  // 4. EMD Amount
  const emdPattern = /(?:EMD|Earnest\s*Money|Bid\s*Security)[^\n\r.:;]*[:\s]+(?:Rs\.?|₹)?\s*([0-9,.]+\s*(?:Lakhs?|Crores?|Cr|L|k)?)/i;
  const emdMatch = clean.match(emdPattern);
  const emd = emdMatch ? emdMatch[1].trim() : null;

  // 5. Turnover
  const turnoverPattern = /(?:Turnover|Annual\s*Turnover|Financial\s*Turnover)[^\n\r.:;]*[:\s]+(?:Rs\.?|₹)?\s*([0-9,.]+\s*(?:Lakhs?|Crores?|Cr|L|k)?)/i;
  const turnoverMatch = clean.match(turnoverPattern);
  const turnover = turnoverMatch ? turnoverMatch[1].trim() : null;

  // 6. Tender / NIT reference
  const nitPattern = /(?:NIT\s*(?:No|Number)?|Tender\s*(?:No|Number|Ref|Id|Notice\s*No)?|Bid\s*(?:No|Number)|GEM\/\d+)[^\n\r:;]*[:\s#]+([A-Z0-9\/\-_]{4,40})/i;
  const nitMatch = clean.match(nitPattern);
  const tenderRef = nitMatch ? nitMatch[1].trim() : null;

  // 7. Deadline / Dates
  const datePattern = /(?:deadline|due\s*date|submission\s*date|closing\s*date|opening\s*date)[^\n\r:;]*[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}-\d{2}-\d{2})/i;
  const dateMatch = clean.match(datePattern);
  const deadline = dateMatch ? dateMatch[1].trim() : null;

  // 8. Detected document classification
  let detectedDocType = 'Tender Document';
  if (fName.includes('gst') || fName.includes('reg-06') || (gstin && clean.toLowerCase().includes('registration'))) {
    detectedDocType = 'GST Registration Certificate';
  } else if (fName.includes('pan') || fName.includes('nsdl') || fName.includes('uti')) {
    detectedDocType = 'PAN Card Document';
  } else if (fName.includes('audit') || fName.includes('balance') || fName.includes('financial')) {
    detectedDocType = 'Audited Financial Statements';
  } else if (fName.includes('emd') || fName.includes('bank') || fName.includes('guarantee')) {
    detectedDocType = 'EMD / Bank Guarantee';
  } else if (fName.includes('nit') || fName.includes('rfp') || fName.includes('tender') || fName.includes('gem')) {
    detectedDocType = 'Tender Specification / NIT';
  }

  return {
    gstin,
    allGstins,
    gstinState,
    pan,
    allPans,
    emd,
    turnover,
    tenderRef,
    deadline,
    detectedDocType,
    hasGstin: !!gstin,
    hasPan: !!pan,
    fileSnippet: clean.slice(0, 400),
  };
}
