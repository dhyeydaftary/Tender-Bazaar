import axios from 'axios';
import { config } from '../config';
import { assertDevFallbackAllowed } from './delivery-guard';

const MSG91_API_URL = 'https://control.msg91.com/api/v5';

export async function sendSms(
  phone: string,
  message: string
): Promise<void> {
  if (!config.sms.authKey) assertDevFallbackAllowed('SMS', 'MSG91_AUTH_KEY');
  if (config.isDev || !config.sms.authKey) {
    console.log('[SMS] Dev mode - message would be sent:');
    console.log(`  To: ${phone}`);
    console.log(`  Message: ${message}`);
    return;
  }

  try {
    const response = await axios.post(
      `${MSG91_API_URL}/flow/`,
      {
        sender: config.sms.senderId,
        route: '4', // Transactional
        country: '91',
        sms: [
          {
            message,
            to: [phone.replace(/^\+91/, '').replace(/^\+/, '')],
          },
        ],
      },
      {
        headers: {
          authkey: config.sms.authKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.type === 'success') {
      console.log(`[SMS] Sent to ${phone}`);
    } else {
      console.error(`[SMS] Failed to send to ${phone}:`, response.data);
      throw new Error(`SMS send failed: ${response.data.message || 'Unknown error'}`);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `[SMS] API error for ${phone}:`,
        error.response?.data || error.message
      );
    } else {
      console.error(`[SMS] Error sending to ${phone}:`, error);
    }
    throw error;
  }
}

export async function sendOtpSms(
  phone: string,
  otp: string
): Promise<void> {
  const message = `Your TenderBazaar verification code is ${otp}. Valid for 10 minutes. Do not share this code with anyone.`;

  if (!config.sms.authKey) assertDevFallbackAllowed('SMS', 'MSG91_AUTH_KEY');
  if (config.isDev || !config.sms.authKey) {
    console.log('[SMS] Dev mode - OTP would be sent:');
    console.log(`  To: ${phone}`);
    console.log(`  OTP: ${otp}`);
    return;
  }

  try {
    const response = await axios.post(
      `${MSG91_API_URL}/otp`,
      {
        mobile: phone.replace(/^\+/, ''),
        otp,
        sender: config.sms.senderId,
        message,
      },
      {
        headers: {
          authkey: config.sms.authKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.type === 'success') {
      console.log(`[SMS] OTP sent to ${phone}`);
    } else {
      console.error(`[SMS] OTP failed for ${phone}:`, response.data);
      throw new Error(`OTP send failed: ${response.data.message || 'Unknown error'}`);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `[SMS] OTP API error for ${phone}:`,
        error.response?.data || error.message
      );
    } else {
      console.error(`[SMS] OTP error for ${phone}:`, error);
    }
    throw error;
  }
}
