'use client';

import { useState } from 'react';
import {
  Settings,
  Globe,
  Database,
  Shield,
  Bell,
  Palette,
  Server,
  Key,
  Mail,
  Clock,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Zap,
  HardDrive,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SettingsTab =
  | 'general'
  | 'scraping'
  | 'notifications'
  | 'security'
  | 'api'
  | 'appearance';

interface ServiceStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'degraded';
  latency?: string;
  version?: string;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const serviceStatuses: ServiceStatus[] = [
  { name: 'PostgreSQL', status: 'connected', latency: '2ms', version: '16.2' },
  { name: 'Redis', status: 'connected', latency: '1ms', version: '7.2.4' },
  { name: 'Elasticsearch', status: 'connected', latency: '8ms', version: '8.12.0' },
  { name: 'AI Service', status: 'connected', latency: '45ms', version: '1.0.0' },
  { name: 'Scraper Engine', status: 'connected', latency: '12ms', version: '0.2.0' },
  { name: 'Notification Service', status: 'connected', latency: '3ms', version: '1.0.0' },
];

const TABS: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
  { key: 'general', label: 'General', icon: Globe },
  { key: 'scraping', label: 'Scraping', icon: Database },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'api', label: 'API & Integrations', icon: Key },
  { key: 'appearance', label: 'Appearance', icon: Palette },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusDot(status: ServiceStatus['status']) {
  const colors = {
    connected: 'bg-emerald-400',
    disconnected: 'bg-red-400',
    degraded: 'bg-amber-400',
  };
  return <span className={`w-2 h-2 rounded-full ${colors[status]} inline-block`} />;
}

function ToggleSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        enabled ? 'bg-primary-500' : 'bg-border'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-6">
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mb-5">{description}</p>}
      {!description && <div className="mb-5" />}
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-foreground/80 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-foreground/80 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Content Components
// ---------------------------------------------------------------------------

function GeneralSettings() {
  const [siteName, setSiteName] = useState('TenderBazaar');
  const [siteUrl, setSiteUrl] = useState('https://tenderbazaar.in');
  const [supportEmail, setSupportEmail] = useState('support@tenderbazaar.in');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [currency, setCurrency] = useState('INR');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);

  return (
    <>
      <SectionCard title="Site Information" description="Basic platform configuration.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <InputField label="Site Name" value={siteName} onChange={setSiteName} />
          <InputField
            label="Site URL"
            value={siteUrl}
            onChange={setSiteUrl}
            placeholder="https://..."
          />
          <InputField
            label="Support Email"
            value={supportEmail}
            onChange={setSupportEmail}
            type="email"
          />
          <SelectField
            label="Timezone"
            value={timezone}
            onChange={setTimezone}
            options={[
              { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30)' },
              { value: 'UTC', label: 'UTC' },
            ]}
          />
          <SelectField
            label="Currency"
            value={currency}
            onChange={setCurrency}
            options={[
              { value: 'INR', label: 'INR - Indian Rupee' },
              { value: 'USD', label: 'USD - US Dollar' },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="Platform Controls" description="Toggle major platform features.">
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Maintenance Mode</p>
              <p className="text-xs text-muted-foreground">
                Disable user access during maintenance windows.
              </p>
            </div>
            <ToggleSwitch enabled={maintenanceMode} onChange={setMaintenanceMode} />
          </div>
          <div className="border-t border-border" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">User Registration</p>
              <p className="text-xs text-muted-foreground">Allow new users to create accounts.</p>
            </div>
            <ToggleSwitch enabled={registrationOpen} onChange={setRegistrationOpen} />
          </div>
        </div>
      </SectionCard>

      {/* Service Health */}
      <SectionCard
        title="Service Health"
        description="Live status of connected backend services."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Service
                </th>
                <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Latency
                </th>
                <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Version
                </th>
              </tr>
            </thead>
            <tbody>
              {serviceStatuses.map((svc) => (
                <tr
                  key={svc.name}
                  className="border-b border-border hover:bg-muted/50 transition-colors"
                >
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <Server className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{svc.name}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm capitalize">
                      {statusDot(svc.status)}
                      <span
                        className={
                          svc.status === 'connected'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : svc.status === 'degraded'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }
                      >
                        {svc.status}
                      </span>
                    </span>
                  </td>
                  <td className="py-3 text-sm text-muted-foreground">{svc.latency ?? '-'}</td>
                  <td className="py-3 text-sm text-muted-foreground">{svc.version ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

function ScrapingSettings() {
  const [maxConcurrency, setMaxConcurrency] = useState('3');
  const [requestDelay, setRequestDelay] = useState('2000');
  const [pageTimeout, setPageTimeout] = useState('30000');
  const [retryAttempts, setRetryAttempts] = useState('3');
  const [respectRobotsTxt, setRespectRobotsTxt] = useState(true);
  const [headlessBrowser, setHeadlessBrowser] = useState(true);
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('');
  const [autoScheduler, setAutoScheduler] = useState(true);
  const [deduplicationThreshold, setDeduplicationThreshold] = useState('0.85');
  const [maxPagesPerRun, setMaxPagesPerRun] = useState('50');
  const [userAgent, setUserAgent] = useState(
    'Mozilla/5.0 (compatible; TenderBazaarBot/1.0)'
  );

  return (
    <>
      <SectionCard
        title="Scraper Defaults"
        description="Default configuration for all portal scrapers."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <InputField
            label="Max Concurrency"
            value={maxConcurrency}
            onChange={setMaxConcurrency}
            type="number"
            hint="Maximum parallel scraping jobs"
          />
          <InputField
            label="Request Delay (ms)"
            value={requestDelay}
            onChange={setRequestDelay}
            type="number"
            hint="Delay between requests to same portal"
          />
          <InputField
            label="Page Timeout (ms)"
            value={pageTimeout}
            onChange={setPageTimeout}
            type="number"
            hint="Max wait time for page load"
          />
          <InputField
            label="Retry Attempts"
            value={retryAttempts}
            onChange={setRetryAttempts}
            type="number"
            hint="Number of retries on failure"
          />
          <InputField
            label="Max Pages Per Run"
            value={maxPagesPerRun}
            onChange={setMaxPagesPerRun}
            type="number"
            hint="Pagination limit per scraping run"
          />
          <InputField
            label="Deduplication Threshold"
            value={deduplicationThreshold}
            onChange={setDeduplicationThreshold}
            hint="Levenshtein similarity threshold (0-1)"
          />
        </div>
      </SectionCard>

      <SectionCard title="Browser & Network" description="Playwright and proxy settings.">
        <InputField
          label="User Agent"
          value={userAgent}
          onChange={setUserAgent}
          hint="User-Agent string sent with requests"
        />
        <div className="space-y-4 mt-2">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Headless Browser</p>
              <p className="text-xs text-muted-foreground">
                Run Playwright in headless mode (recommended for production).
              </p>
            </div>
            <ToggleSwitch enabled={headlessBrowser} onChange={setHeadlessBrowser} />
          </div>
          <div className="border-t border-border" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Respect robots.txt</p>
              <p className="text-xs text-muted-foreground">
                Honor crawl-delay and disallow rules from portals.
              </p>
            </div>
            <ToggleSwitch enabled={respectRobotsTxt} onChange={setRespectRobotsTxt} />
          </div>
          <div className="border-t border-border" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Proxy Rotation</p>
              <p className="text-xs text-muted-foreground">
                Route requests through rotating proxy pool.
              </p>
            </div>
            <ToggleSwitch enabled={proxyEnabled} onChange={setProxyEnabled} />
          </div>
          {proxyEnabled && (
            <InputField
              label="Proxy URL"
              value={proxyUrl}
              onChange={setProxyUrl}
              placeholder="http://user:pass@proxy.example.com:8080"
              hint="SOCKS5 or HTTP proxy endpoint"
            />
          )}
        </div>
      </SectionCard>

      <SectionCard title="Scheduler" description="Automatic scraping schedule control.">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Auto-Scheduler</p>
            <p className="text-xs text-muted-foreground">
              Automatically run scrapers based on their cron schedules.
            </p>
          </div>
          <ToggleSwitch enabled={autoScheduler} onChange={setAutoScheduler} />
        </div>
      </SectionCard>
    </>
  );
}

function NotificationSettings() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailProvider, setEmailProvider] = useState('aws-ses');
  const [emailFrom, setEmailFrom] = useState('noreply@tenderbazaar.in');
  const [smtpHost, setSmtpHost] = useState('email-smtp.ap-south-1.amazonaws.com');
  const [smtpPort, setSmtpPort] = useState('587');

  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [whatsappProvider, setWhatsappProvider] = useState('wati');
  const [whatsappApiKey, setWhatsappApiKey] = useState('wati_api_••••••••••••');
  const [showWhatsappKey, setShowWhatsappKey] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [smsProvider, setSmsProvider] = useState('msg91');

  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestFrequency, setDigestFrequency] = useState('daily');
  const [digestTime, setDigestTime] = useState('09:00');

  return (
    <>
      <SectionCard title="Email" description="Email delivery configuration.">
        <div className="flex items-center justify-between py-2 mb-4">
          <div>
            <p className="text-sm font-medium text-foreground">Email Notifications</p>
            <p className="text-xs text-muted-foreground">Send emails for alerts and digests.</p>
          </div>
          <ToggleSwitch enabled={emailEnabled} onChange={setEmailEnabled} />
        </div>
        {emailEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <SelectField
              label="Email Provider"
              value={emailProvider}
              onChange={setEmailProvider}
              options={[
                { value: 'aws-ses', label: 'AWS SES' },
                { value: 'sendgrid', label: 'SendGrid' },
                { value: 'smtp', label: 'Custom SMTP' },
              ]}
            />
            <InputField
              label="From Address"
              value={emailFrom}
              onChange={setEmailFrom}
              type="email"
            />
            <InputField label="SMTP Host" value={smtpHost} onChange={setSmtpHost} />
            <InputField label="SMTP Port" value={smtpPort} onChange={setSmtpPort} />
          </div>
        )}
      </SectionCard>

      <SectionCard title="WhatsApp" description="WhatsApp Business API settings.">
        <div className="flex items-center justify-between py-2 mb-4">
          <div>
            <p className="text-sm font-medium text-foreground">WhatsApp Notifications</p>
            <p className="text-xs text-muted-foreground">
              Send tender alerts via WhatsApp Business.
            </p>
          </div>
          <ToggleSwitch enabled={whatsappEnabled} onChange={setWhatsappEnabled} />
        </div>
        {whatsappEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <SelectField
              label="Provider"
              value={whatsappProvider}
              onChange={setWhatsappProvider}
              options={[
                { value: 'wati', label: 'WATI' },
                { value: 'twilio', label: 'Twilio' },
                { value: 'gupshup', label: 'Gupshup' },
              ]}
            />
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showWhatsappKey ? 'text' : 'password'}
                  value={whatsappApiKey}
                  onChange={(e) => setWhatsappApiKey(e.target.value)}
                  className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                />
                <button
                  onClick={() => setShowWhatsappKey(!showWhatsappKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80"
                >
                  {showWhatsappKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Push & SMS" description="Mobile push and SMS channel settings.">
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Push Notifications (FCM)</p>
              <p className="text-xs text-muted-foreground">
                Firebase Cloud Messaging for mobile and web push.
              </p>
            </div>
            <ToggleSwitch enabled={pushEnabled} onChange={setPushEnabled} />
          </div>
          <div className="border-t border-border" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">SMS Notifications (MSG91)</p>
              <p className="text-xs text-muted-foreground">
                Transactional SMS via {smsProvider.toUpperCase()}.
              </p>
            </div>
            <ToggleSwitch enabled={smsEnabled} onChange={setSmsEnabled} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Digest Settings" description="Configure periodic digest emails.">
        <div className="flex items-center justify-between py-2 mb-4">
          <div>
            <p className="text-sm font-medium text-foreground">Digest Emails</p>
            <p className="text-xs text-muted-foreground">
              Send summary emails with matching tenders.
            </p>
          </div>
          <ToggleSwitch enabled={digestEnabled} onChange={setDigestEnabled} />
        </div>
        {digestEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <SelectField
              label="Frequency"
              value={digestFrequency}
              onChange={setDigestFrequency}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly (Monday)' },
                { value: 'biweekly', label: 'Bi-weekly' },
              ]}
            />
            <InputField
              label="Send Time (IST)"
              value={digestTime}
              onChange={setDigestTime}
              type="time"
              hint="Time in IST when digest emails are dispatched"
            />
          </div>
        )}
      </SectionCard>
    </>
  );
}

function SecuritySettings() {
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [maxLoginAttempts, setMaxLoginAttempts] = useState('5');
  const [lockoutDuration, setLockoutDuration] = useState('15');
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [ipWhitelisting, setIpWhitelisting] = useState(false);
  const [ipWhitelist, setIpWhitelist] = useState('');
  const [rateLimitPerMin, setRateLimitPerMin] = useState('60');
  const [forceHttps, setForceHttps] = useState(true);
  const [csrfProtection, setCsrfProtection] = useState(true);
  const [passwordMinLength, setPasswordMinLength] = useState('8');

  return (
    <>
      <SectionCard
        title="Authentication"
        description="Login and session security controls."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <InputField
            label="Session Timeout (minutes)"
            value={sessionTimeout}
            onChange={setSessionTimeout}
            type="number"
            hint="Auto-logout after inactivity"
          />
          <InputField
            label="Max Login Attempts"
            value={maxLoginAttempts}
            onChange={setMaxLoginAttempts}
            type="number"
            hint="Before account lockout"
          />
          <InputField
            label="Lockout Duration (minutes)"
            value={lockoutDuration}
            onChange={setLockoutDuration}
            type="number"
            hint="How long to lock after max attempts"
          />
          <InputField
            label="Minimum Password Length"
            value={passwordMinLength}
            onChange={setPasswordMinLength}
            type="number"
          />
        </div>

        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
              <p className="text-xs text-muted-foreground">
                Require 2FA for all admin accounts.
              </p>
            </div>
            <ToggleSwitch enabled={twoFactorRequired} onChange={setTwoFactorRequired} />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Network Security"
        description="IP restrictions and request protection."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Force HTTPS</p>
              <p className="text-xs text-muted-foreground">
                Redirect all HTTP requests to HTTPS.
              </p>
            </div>
            <ToggleSwitch enabled={forceHttps} onChange={setForceHttps} />
          </div>
          <div className="border-t border-border" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">CSRF Protection</p>
              <p className="text-xs text-muted-foreground">
                Cross-site request forgery token validation.
              </p>
            </div>
            <ToggleSwitch enabled={csrfProtection} onChange={setCsrfProtection} />
          </div>
          <div className="border-t border-border" />
          <InputField
            label="API Rate Limit (requests/min)"
            value={rateLimitPerMin}
            onChange={setRateLimitPerMin}
            type="number"
            hint="Per-IP rate limiting for API endpoints"
          />
          <div className="border-t border-border" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">IP Whitelisting</p>
              <p className="text-xs text-muted-foreground">
                Only allow admin access from specified IPs.
              </p>
            </div>
            <ToggleSwitch enabled={ipWhitelisting} onChange={setIpWhitelisting} />
          </div>
          {ipWhitelisting && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Allowed IPs
              </label>
              <textarea
                value={ipWhitelist}
                onChange={(e) => setIpWhitelist(e.target.value)}
                placeholder="One IP per line, e.g.&#10;103.21.244.0/22&#10;192.168.1.100"
                rows={4}
                className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                CIDR notation supported. One entry per line.
              </p>
            </div>
          )}
        </div>
      </SectionCard>
    </>
  );
}

function ApiSettings() {
  const [apiKey, setApiKey] = useState('tb_live_sk_••••••••••••••••••••••••');
  const [showApiKey, setShowApiKey] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [razorpayKey, setRazorpayKey] = useState('rzp_live_••••••••••••');
  const [showRzpKey, setShowRzpKey] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState('sk-ant-••••••••••••');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <>
      <SectionCard title="API Keys" description="Manage internal API access credentials.">
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Platform API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors font-mono"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80"
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <button
              onClick={() => copyToClipboard(apiKey, 'apiKey')}
              className="px-3 py-2.5 bg-muted border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Copy"
            >
              {copied === 'apiKey' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              className="px-3 py-2.5 bg-muted border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Regenerate"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Used for server-to-server communication.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Third-Party Integrations"
        description="External service API credentials."
      >
        {/* Razorpay */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Razorpay API Key
          </label>
          <div className="relative">
            <input
              type={showRzpKey ? 'text' : 'password'}
              value={razorpayKey}
              onChange={(e) => setRazorpayKey(e.target.value)}
              className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors font-mono"
            />
            <button
              onClick={() => setShowRzpKey(!showRzpKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80"
            >
              {showRzpKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Payment gateway for subscriptions.</p>
        </div>

        {/* Anthropic */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">
            Anthropic API Key
          </label>
          <div className="relative">
            <input
              type={showAnthropicKey ? 'text' : 'password'}
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors font-mono"
            />
            <button
              onClick={() => setShowAnthropicKey(!showAnthropicKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80"
            >
              {showAnthropicKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Powers AI eligibility checks and document analysis.
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Webhooks" description="Receive real-time event notifications.">
        <div className="flex items-center justify-between py-2 mb-4">
          <div>
            <p className="text-sm font-medium text-foreground">Enable Webhooks</p>
            <p className="text-xs text-muted-foreground">
              POST events to an external URL on tender/user changes.
            </p>
          </div>
          <ToggleSwitch enabled={webhookEnabled} onChange={setWebhookEnabled} />
        </div>
        {webhookEnabled && (
          <InputField
            label="Webhook URL"
            value={webhookUrl}
            onChange={setWebhookUrl}
            placeholder="https://your-server.com/webhook"
            hint="We'll send JSON payloads with event type and data."
          />
        )}
      </SectionCard>
    </>
  );
}

function AppearanceSettings() {
  const [primaryColor, setPrimaryColor] = useState('#FF6B35');
  const [secondaryColor, setSecondaryColor] = useState('#1B2845');
  const [accentColor, setAccentColor] = useState('#00D4AA');
  const [font, setFont] = useState('plus-jakarta-sans');
  const [logoUrl, setLogoUrl] = useState('/logo.svg');
  const [faviconUrl, setFaviconUrl] = useState('/favicon.ico');
  const [darkMode, setDarkMode] = useState(true);
  const [compactLayout, setCompactLayout] = useState(false);

  return (
    <>
      <SectionCard title="Brand Colors" description="Customize the platform color scheme.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Primary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-border bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 font-mono uppercase focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Saffron Orange</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Secondary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-border bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="flex-1 bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 font-mono uppercase focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Deep Navy</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Accent Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-border bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="flex-1 bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 font-mono uppercase focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Teal Green</p>
          </div>
        </div>

        {/* Preview swatch */}
        <div className="mt-5 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Preview:</span>
          <div
            className="w-8 h-8 rounded-md border border-border"
            style={{ backgroundColor: primaryColor }}
          />
          <div
            className="w-8 h-8 rounded-md border border-border"
            style={{ backgroundColor: secondaryColor }}
          />
          <div
            className="w-8 h-8 rounded-md border border-border"
            style={{ backgroundColor: accentColor }}
          />
        </div>
      </SectionCard>

      <SectionCard title="Typography & Assets" description="Font and logo settings.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <SelectField
            label="Font Family"
            value={font}
            onChange={setFont}
            options={[
              { value: 'plus-jakarta-sans', label: 'Plus Jakarta Sans' },
              { value: 'inter', label: 'Inter' },
              { value: 'poppins', label: 'Poppins' },
              { value: 'dm-sans', label: 'DM Sans' },
            ]}
          />
          <InputField
            label="Logo URL"
            value={logoUrl}
            onChange={setLogoUrl}
            hint="Path or URL to the platform logo"
          />
          <InputField
            label="Favicon URL"
            value={faviconUrl}
            onChange={setFaviconUrl}
            hint="Path or URL to the browser favicon"
          />
        </div>
      </SectionCard>

      <SectionCard title="Layout" description="Admin dashboard display preferences.">
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Dark Mode</p>
              <p className="text-xs text-muted-foreground">
                Use dark theme for the admin dashboard.
              </p>
            </div>
            <ToggleSwitch enabled={darkMode} onChange={setDarkMode} />
          </div>
          <div className="border-t border-border" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Compact Layout</p>
              <p className="text-xs text-muted-foreground">
                Reduce spacing for denser information display.
              </p>
            </div>
            <ToggleSwitch enabled={compactLayout} onChange={setCompactLayout} />
          </div>
        </div>
      </SectionCard>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 1200);
  }

  function handleReset() {
    // In production, reset to server-stored defaults
  }

  return (
    <div className="">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary-500" />
            Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure platform settings, integrations, and preferences.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2.5 text-sm font-medium text-muted-foreground bg-muted border border-border rounded-lg hover:bg-muted hover:text-foreground transition-colors inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium text-foreground bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-8 overflow-x-auto pb-1 border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2 -mb-[1px] ${
                isActive
                  ? 'border-primary-500 text-primary-500 bg-card/50'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl">
        {activeTab === 'general' && <GeneralSettings />}
        {activeTab === 'scraping' && <ScrapingSettings />}
        {activeTab === 'notifications' && <NotificationSettings />}
        {activeTab === 'security' && <SecuritySettings />}
        {activeTab === 'api' && <ApiSettings />}
        {activeTab === 'appearance' && <AppearanceSettings />}
      </div>

      {/* Toast notification */}
      {saved && (
        <div className="fixed bottom-6 right-6 bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm font-medium animate-in slide-in-from-bottom-4 z-50">
          <CheckCircle2 className="w-5 h-5" />
          Settings saved successfully
        </div>
      )}
    </div>
  );
}
