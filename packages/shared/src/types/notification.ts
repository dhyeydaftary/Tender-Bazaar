export enum NotificationType {
  TENDER_ALERT = 'TENDER_ALERT',
  DEADLINE_REMINDER = 'DEADLINE_REMINDER',
  SUBSCRIPTION_EXPIRY = 'SUBSCRIPTION_EXPIRY',
  NEW_CORRIGENDUM = 'NEW_CORRIGENDUM',
  TENDER_RESULT = 'TENDER_RESULT',
  ELIGIBILITY_RESULT = 'ELIGIBILITY_RESULT',
  SYSTEM = 'SYSTEM',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
}

export enum AlertFrequency {
  INSTANT = 'INSTANT',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
}

export interface Alert {
  id: string;
  userId: string;
  name: string;
  keywords: string[];
  categories: string[];
  states: string[];
  minValue?: number;
  maxValue?: number;
  organizations: string[];
  tenderTypes: string[];
  frequency: AlertFrequency;
  emailEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  isActive: boolean;
  lastMatchedAt?: Date;
  matchCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channel: NotificationChannel;
  isRead: boolean;
  createdAt: Date;
}
