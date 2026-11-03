import axios from 'axios';
import { config } from '../config';
import { assertDevFallbackAllowed } from './delivery-guard';

interface WatiResponse {
  result: boolean;
  info?: string;
}

export async function sendWhatsAppMessage(
  phone: string,
  templateName: string,
  params: Record<string, string>[]
): Promise<void> {
  if (!config.whatsapp.apiUrl || !config.whatsapp.apiKey) {
    assertDevFallbackAllowed('WhatsApp', 'WATI_API_URL and WATI_API_KEY');
  }
  if (config.isDev || !config.whatsapp.apiUrl || !config.whatsapp.apiKey) {
    console.log('[WhatsApp] Dev mode - message would be sent:');
    console.log(`  To: ${phone}`);
    console.log(`  Template: ${templateName}`);
    console.log(`  Params:`, JSON.stringify(params));
    return;
  }

  try {
    const url = `${config.whatsapp.apiUrl}/api/v1/sendTemplateMessage`;
    const response = await axios.post<WatiResponse>(
      url,
      {
        template_name: templateName,
        broadcast_name: `tb_${templateName}_${Date.now()}`,
        parameters: params,
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.apiKey}`,
          'Content-Type': 'application/json',
        },
        params: {
          whatsappNumber: phone.replace(/^\+/, ''),
        },
      }
    );

    if (response.data.result) {
      console.log(`[WhatsApp] Sent template '${templateName}' to ${phone}`);
    } else {
      console.error(
        `[WhatsApp] Failed to send to ${phone}:`,
        response.data.info
      );
      throw new Error(
        `WhatsApp send failed: ${response.data.info || 'Unknown error'}`
      );
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `[WhatsApp] API error for ${phone}:`,
        error.response?.data || error.message
      );
    } else {
      console.error(`[WhatsApp] Error sending to ${phone}:`, error);
    }
    throw error;
  }
}

export interface WhatsAppTenderItem {
  title: string;
  organization: string;
  estimatedValue?: number;
  bidSubmissionDeadline: Date | string;
}

function formatValueShort(value?: number): string {
  if (!value || value <= 0) return 'N/A';
  if (value >= 10_000_000) return `Rs ${(value / 10_000_000).toFixed(1)}Cr`;
  if (value >= 100_000) return `Rs ${(value / 100_000).toFixed(1)}L`;
  return `Rs ${value.toLocaleString('en-IN')}`;
}

function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

export async function sendTenderAlertWhatsApp(
  phone: string,
  alertName: string,
  tenders: WhatsAppTenderItem[]
): Promise<void> {
  // Build a formatted tender list for WhatsApp
  const tenderList = tenders
    .slice(0, 5) // Limit to 5 tenders for WhatsApp message size
    .map((t, i) => {
      const value = formatValueShort(t.estimatedValue);
      const deadline = formatDateShort(t.bidSubmissionDeadline);
      return `${i + 1}. ${t.title}\n   ${t.organization}\n   Value: ${value} | Deadline: ${deadline}`;
    })
    .join('\n\n');

  const params = [
    { name: 'alert_name', value: alertName },
    { name: 'count', value: String(tenders.length) },
    { name: 'tender_list', value: tenderList },
    { name: 'dashboard_url', value: `${config.frontendUrl}/dashboard/alerts` },
  ];

  if (!config.whatsapp.apiUrl || !config.whatsapp.apiKey) {
    assertDevFallbackAllowed('WhatsApp', 'WATI_API_URL and WATI_API_KEY');
  }
  if (
    config.isDev ||
    !config.whatsapp.apiUrl ||
    !config.whatsapp.apiKey
  ) {
    console.log('[WhatsApp] Dev mode - Tender Alert:');
    console.log(`  To: ${phone}`);
    console.log(`  Alert: ${alertName}`);
    console.log(`  Tenders (${tenders.length}):`);
    console.log(tenderList);
    return;
  }

  await sendWhatsAppMessage(phone, 'tender_alert', params);
}
