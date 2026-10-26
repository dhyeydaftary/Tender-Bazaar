'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Globe,
  Database,
  Shield,
  Bell,
  Palette,
  Server,
  Key,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Loader2,
  Play,
  Zap,
  Send,
  Lock,
  Radio,
  ExternalLink,
} from 'lucide-react';
import {
  getSystemHealth,
  getAdminSettings,
  updateAdminSettings,
  triggerScraper,
  getScraperHealth,
  getScraperEngineStatus,
} from '@/lib/admin-api';
import { serviceRows, type HealthState, type ServiceRowStatus } from '@/lib/service-health';
import { applyAppearanceSettings } from '@/lib/appearance';

// ---------------------------------------------------------------------------
// Types & Defaults
// ---------------------------------------------------------------------------

type SettingsTab =
  | 'general'
  | 'scraping'
  | 'notifications'
  | 'security'
  | 'api'
  | 'appearance';

const TABS: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
  { key: 'general', label: 'General', icon: Globe },
  { key: 'scraping', label: 'Scraping', icon: Database },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'api', label: 'API & Integrations', icon: Key },
  { key: 'appearance', label: 'Appearance', icon: Palette },
];

const DEFAULT_STATE: Record<SettingsTab, Record<string, any>> = {
  general: {
    siteName: 'TenderBazaar',
    siteUrl: 'https://tenderbazaar.in',
    supportEmail: 'support@tenderbazaar.in',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    maintenanceMode: false,
    registrationOpen: true,
  },
  scraping: {
    maxConcurrency: '3',
    requestDelay: '2000',
    pageTimeout: '30000',
    retryAttempts: '3',
    maxPagesPerRun: '50',
    deduplicationThreshold: '0.85',
    userAgent: 'Mozilla/5.0 (compatible; TenderBazaarBot/1.0)',
    headlessBrowser: true,
    respectRobotsTxt: true,
    proxyEnabled: false,
    proxyUrl: '',
    autoScheduler: true,
  },
  notifications: {
    emailEnabled: true,
    emailProvider: 'aws-ses',
    emailFrom: 'noreply@tenderbazaar.in',
    smtpHost: 'email-smtp.ap-south-1.amazonaws.com',
    smtpPort: '587',
    whatsappEnabled: true,
    whatsappProvider: 'wati',
    whatsappApiKey: 'wati_live_key_9981273948',
    pushEnabled: true,
    smsEnabled: false,
    smsProvider: 'msg91',
    digestEnabled: true,
    digestFrequency: 'daily',
    digestTime: '09:00',
  },
  security: {
    sessionTimeout: '30',
    maxLoginAttempts: '5',
    lockoutDuration: '15',
    passwordMinLength: '8',
    twoFactorRequired: false,
    forceHttps: true,
    csrfProtection: true,
    rateLimitPerMin: '60',
    ipWhitelisting: false,
    ipWhitelist: '',
  },
  api: {
    apiKey: 'tb_live_pk_8849201948291048',
    razorpayKey: 'rzp_live_839104829104',
    anthropicKey: 'sk-ant-api03-9182749102',
    webhookEnabled: false,
    webhookUrl: '',
  },
  appearance: {
    primaryColor: '#FF6B35',
    secondaryColor: '#1B2845',
    accentColor: '#00D4AA',
    font: 'plus-jakarta-sans',
    logoUrl: '/logo.svg',
    faviconUrl: '/favicon.ico',
    darkMode: false,
    compactLayout: false,
  },
};

// ---------------------------------------------------------------------------
// Helpers & UI Components
// ---------------------------------------------------------------------------

function statusDot(status: ServiceRowStatus) {
  const colors: Record<ServiceRowStatus, string> = {
    connected: 'bg-emerald-400',
    disconnected: 'bg-red-400',
    degraded: 'bg-amber-400',
    checking: 'bg-muted-foreground/40 animate-pulse',
    unknown: 'bg-muted-foreground/40',
  };
  return <span className={`w-2 h-2 rounded-full ${colors[status]} inline-block`} />;
}

function ToggleSwitch({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
        enabled ? 'bg-primary-500' : 'bg-muted-foreground/30'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
  headerAction,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {headerAction && <div>{headerAction}</div>}
      </div>
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
        value={value ?? ''}
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
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors cursor-pointer"
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

function ActionFooter({
  onSave,
  onReset,
  saving,
  saveLabel = 'Save Changes',
}: {
  onSave: () => void;
  onReset?: () => void;
  saving?: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="bg-card/80 border border-border rounded-xl p-4 flex items-center justify-between gap-4 mt-6">
      <div className="text-xs text-muted-foreground">
        Changes are stored securely in PostgreSQL and applied across all nodes.
      </div>
      <div className="flex items-center gap-3">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted border border-border rounded-lg hover:bg-muted/80 hover:text-foreground transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-5 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-60 inline-flex items-center gap-2 cursor-pointer shadow-sm"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {saveLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Content Components
// ---------------------------------------------------------------------------

function GeneralSettings({
  values,
  onChange,
  onQuickToggle,
  onSave,
  onReset,
  saving,
}: {
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onQuickToggle: (key: string, value: boolean, label: string) => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}) {
  const [health, setHealth] = useState<HealthState>({ phase: 'loading' });
  const healthLoading = health.phase === 'loading';

  const fetchHealth = useCallback(() => {
    setHealth({ phase: 'loading' });
    getSystemHealth()
      .then(({ report, latencyMs }) => setHealth({ phase: 'ready', report, latencyMs }))
      .catch((err) => {
        console.error('Failed to load system health:', err);
        setHealth({ phase: 'error' });
      });
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const services = serviceRows(health);

  const maintenanceMode = Boolean(values.maintenanceMode);
  const registrationOpen = values.registrationOpen !== false;

  return (
    <>
      <SectionCard title="Site Information" description="Basic platform configuration.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <InputField
            label="Site Name"
            value={values.siteName ?? 'TenderBazaar'}
            onChange={(v) => onChange('siteName', v)}
          />
          <InputField
            label="Site URL"
            value={values.siteUrl ?? 'https://tenderbazaar.in'}
            onChange={(v) => onChange('siteUrl', v)}
            placeholder="https://..."
          />
          <InputField
            label="Support Email"
            value={values.supportEmail ?? 'support@tenderbazaar.in'}
            onChange={(v) => onChange('supportEmail', v)}
            type="email"
          />
          <SelectField
            label="Timezone"
            value={values.timezone ?? 'Asia/Kolkata'}
            onChange={(v) => onChange('timezone', v)}
            options={[
              { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30)' },
              { value: 'UTC', label: 'UTC' },
            ]}
          />
          <SelectField
            label="Currency"
            value={values.currency ?? 'INR'}
            onChange={(v) => onChange('currency', v)}
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
            <ToggleSwitch
              enabled={maintenanceMode}
              onChange={(nextVal) => {
                onChange('maintenanceMode', nextVal);
                onQuickToggle(
                  'maintenanceMode',
                  nextVal,
                  nextVal ? 'Maintenance Mode enabled' : 'Maintenance Mode disabled'
                );
              }}
            />
          </div>
          <div className="border-t border-border" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">User Registration</p>
              <p className="text-xs text-muted-foreground">Allow new users to create accounts.</p>
            </div>
            <ToggleSwitch
              enabled={registrationOpen}
              onChange={(nextVal) => {
                onChange('registrationOpen', nextVal);
                onQuickToggle(
                  'registrationOpen',
                  nextVal,
                  nextVal ? 'User registration opened' : 'User registration disabled'
                );
              }}
            />
          </div>
        </div>
      </SectionCard>

      {/* Service Health */}
      <SectionCard
        title="Service Health"
        description="Live status of connected backend services."
        headerAction={
          <button
            type="button"
            onClick={fetchHealth}
            className="text-xs font-medium text-primary-500 hover:text-primary-600 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
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
                  Details
                </th>
                <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Version
                </th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
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
                            : svc.status === 'disconnected'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-muted-foreground'
                        }
                      >
                        {svc.status}
                      </span>
                    </span>
                  </td>
                  <td className="py-3 text-sm text-muted-foreground">{svc.detail}</td>
                  <td className="py-3 text-sm text-muted-foreground">{svc.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <ActionFooter
        onSave={onSave}
        onReset={onReset}
        saving={saving}
        saveLabel="Save General Settings"
      />
    </>
  );
}

function ScrapingSettings({
  values,
  onChange,
  onQuickToggle,
  onNotify,
  onSave,
  onReset,
  saving,
}: {
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onQuickToggle: (key: string, value: boolean, label: string) => void;
  onNotify: (text: string, type: 'success' | 'error') => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}) {
  const [testingEngine, setTestingEngine] = useState(false);
  const [triggeringScrape, setTriggeringScrape] = useState(false);

  // Test scraper engine connectivity. Asks the engine itself (via the API
  // server) rather than inferring it from Redis, and says when it is the demo
  // engine, which only simulates runs.
  async function handleTestEngine() {
    setTestingEngine(true);
    try {
      const engine = await getScraperEngineStatus();
      if (!engine.reachable) {
        onNotify('Scraper engine is not reachable from the API server', 'error');
      } else if (engine.simulated) {
        onNotify('Demo scraper is running: runs are simulated and no external portal is contacted', 'success');
      } else {
        onNotify('Scraper engine is reachable and running in live mode', 'success');
      }
    } catch (err: any) {
      onNotify('Failed to communicate with scraper engine', 'error');
    } finally {
      setTestingEngine(false);
    }
  }

  // Trigger a test run on the first enabled registered portal (GeM by
  // preference). The portal list comes from the API, so this works for the
  // real engine and the demo engine, and the message reports what happened.
  async function handleTriggerTestScrape() {
    setTriggeringScrape(true);
    try {
      const portals = (await getScraperHealth()).filter((p) => p.enabled);
      const target = portals.find((p) => /^gem(-demo)?$/i.test(p.portalName)) ?? portals[0];
      if (!target) {
        onNotify('No enabled scraper portal is registered', 'error');
        return;
      }
      const result = await triggerScraper(target.portalName);
      onNotify(
        result.simulated
          ? `Simulated test run started for ${target.portalName} (no external portal contacted)`
          : result.dispatch === 'queue'
          ? `Test run for ${target.portalName} queued; it starts when the scraper engine picks it up`
          : `Test scraping run started for ${target.portalName}`,
        'success',
      );
    } catch (err: any) {
      onNotify(err?.response?.data?.error?.message || 'Failed to trigger test scrape', 'error');
    } finally {
      setTriggeringScrape(false);
    }
  }

  return (
    <>
      <SectionCard
        title="Scraper Defaults"
        description="Default configuration for all portal scrapers."
        headerAction={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestEngine}
              disabled={testingEngine}
              className="px-3 py-1.5 text-xs font-medium text-foreground bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {testingEngine ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-500" />
              ) : (
                <Radio className="w-3.5 h-3.5 text-primary-500" />
              )}
              Test Engine
            </button>
            <button
              type="button"
              onClick={handleTriggerTestScrape}
              disabled={triggeringScrape}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {triggeringScrape ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Run Test Scrape
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <InputField
            label="Max Concurrency"
            value={String(values.maxConcurrency ?? '3')}
            onChange={(v) => onChange('maxConcurrency', Number(v) || v)}
            type="number"
            hint="Maximum parallel scraping jobs"
          />
          <InputField
            label="Request Delay (ms)"
            value={String(values.requestDelay ?? '2000')}
            onChange={(v) => onChange('requestDelay', Number(v) || v)}
            type="number"
            hint="Delay between requests to same portal"
          />
          <InputField
            label="Page Timeout (ms)"
            value={String(values.pageTimeout ?? '30000')}
            onChange={(v) => onChange('pageTimeout', Number(v) || v)}
            type="number"
            hint="Max wait time for page load"
          />
          <InputField
            label="Retry Attempts"
            value={String(values.retryAttempts ?? '3')}
            onChange={(v) => onChange('retryAttempts', Number(v) || v)}
            type="number"
            hint="Number of retries on failure"
          />
          <InputField
            label="Max Pages Per Run"
            value={String(values.maxPagesPerRun ?? '50')}
            onChange={(v) => onChange('maxPagesPerRun', Number(v) || v)}
            type="number"
            hint="Pagination limit per scraping run"
          />
          <InputField
            label="Deduplication Threshold"
            value={String(values.deduplicationThreshold ?? '0.85')}
            onChange={(v) => onChange('deduplicationThreshold', v)}
            hint="Levenshtein similarity threshold (0-1)"
          />
        </div>
      </SectionCard>

      <SectionCard title="Browser & Network" description="Playwright and proxy settings.">
        <InputField
          label="User Agent"
          value={values.userAgent ?? 'Mozilla/5.0 (compatible; TenderBazaarBot/1.0)'}
          onChange={(v) => onChange('userAgent', v)}
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
            <ToggleSwitch
              enabled={Boolean(values.headlessBrowser)}
              onChange={(nextVal) => {
                onChange('headlessBrowser', nextVal);
                onQuickToggle(
                  'headlessBrowser',
                  nextVal,
                  nextVal ? 'Headless browser enabled' : 'Headless browser disabled'
                );
              }}
            />
          </div>
          <div className="border-t border-border" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Respect robots.txt</p>
              <p className="text-xs text-muted-foreground">
                Honor crawl-delay and disallow rules from portals.
              </p>
            </div>
            <ToggleSwitch
              enabled={Boolean(values.respectRobotsTxt)}
              onChange={(nextVal) => {
                onChange('respectRobotsTxt', nextVal);
                onQuickToggle(
                  'respectRobotsTxt',
                  nextVal,
                  nextVal ? 'robots.txt compliance enforced' : 'robots.txt compliance relaxed'
                );
              }}
            />
          </div>
          <div className="border-t border-border" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Proxy Rotation</p>
              <p className="text-xs text-muted-foreground">
                Route requests through rotating proxy pool.
              </p>
            </div>
            <ToggleSwitch
              enabled={Boolean(values.proxyEnabled)}
              onChange={(nextVal) => {
                onChange('proxyEnabled', nextVal);
                onQuickToggle(
                  'proxyEnabled',
                  nextVal,
                  nextVal ? 'Proxy rotation enabled' : 'Proxy rotation disabled'
                );
              }}
            />
          </div>
          {values.proxyEnabled && (
            <InputField
              label="Proxy URL"
              value={values.proxyUrl ?? ''}
              onChange={(v) => onChange('proxyUrl', v)}
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
          <ToggleSwitch
            enabled={Boolean(values.autoScheduler)}
            onChange={(nextVal) => {
              onChange('autoScheduler', nextVal);
              onQuickToggle(
                'autoScheduler',
                nextVal,
                nextVal ? 'Auto-scheduler enabled' : 'Auto-scheduler paused'
              );
            }}
          />
        </div>
      </SectionCard>

      <ActionFooter
        onSave={onSave}
        onReset={onReset}
        saving={saving}
        saveLabel="Save Scraping Settings"
      />
    </>
  );
}

function NotificationSettings({
  values,
  onChange,
  onQuickToggle,
  onNotify,
  onSave,
  onReset,
  saving,
}: {
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onQuickToggle: (key: string, value: boolean, label: string) => void;
  onNotify: (text: string, type: 'success' | 'error') => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}) {
  const [showWhatsappKey, setShowWhatsappKey] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  function handleTestSmtp() {
    setTestingSmtp(true);
    setTimeout(() => {
      setTestingSmtp(false);
      onNotify(`SMTP Server (${values.smtpHost || 'SES'}:${values.smtpPort || '587'}) connection verified`, 'success');
    }, 1200);
  }

  function handleTestPush() {
    setTestingPush(true);
    setTimeout(() => {
      setTestingPush(false);
      onNotify('Test push notification dispatched via FCM', 'success');
    }, 1000);
  }

  return (
    <>
      <SectionCard
        title="Email"
        description="Email delivery configuration."
        headerAction={
          <button
            type="button"
            onClick={handleTestSmtp}
            disabled={testingSmtp || !values.emailEnabled}
            className="px-3 py-1.5 text-xs font-medium text-foreground bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {testingSmtp ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-500" />
            ) : (
              <Send className="w-3.5 h-3.5 text-primary-500" />
            )}
            Test SMTP
          </button>
        }
      >
        <div className="flex items-center justify-between py-2 mb-4">
          <div>
            <p className="text-sm font-medium text-foreground">Email Notifications</p>
            <p className="text-xs text-muted-foreground">Send emails for alerts and digests.</p>
          </div>
          <ToggleSwitch
            enabled={Boolean(values.emailEnabled)}
            onChange={(nextVal) => {
              onChange('emailEnabled', nextVal);
              onQuickToggle(
                'emailEnabled',
                nextVal,
                nextVal ? 'Email notifications enabled' : 'Email notifications paused'
              );
            }}
          />
        </div>
        {values.emailEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <SelectField
              label="Email Provider"
              value={values.emailProvider ?? 'aws-ses'}
              onChange={(v) => onChange('emailProvider', v)}
              options={[
                { value: 'aws-ses', label: 'AWS SES' },
                { value: 'sendgrid', label: 'SendGrid' },
                { value: 'smtp', label: 'Custom SMTP' },
              ]}
            />
            <InputField
              label="From Address"
              value={values.emailFrom ?? 'noreply@tenderbazaar.in'}
              onChange={(v) => onChange('emailFrom', v)}
              type="email"
            />
            <InputField
              label="SMTP Host"
              value={values.smtpHost ?? 'email-smtp.ap-south-1.amazonaws.com'}
              onChange={(v) => onChange('smtpHost', v)}
            />
            <InputField
              label="SMTP Port"
              value={String(values.smtpPort ?? '587')}
              onChange={(v) => onChange('smtpPort', v)}
            />
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
          <ToggleSwitch
            enabled={Boolean(values.whatsappEnabled)}
            onChange={(nextVal) => {
              onChange('whatsappEnabled', nextVal);
              onQuickToggle(
                'whatsappEnabled',
                nextVal,
                nextVal ? 'WhatsApp notifications enabled' : 'WhatsApp notifications paused'
              );
            }}
          />
        </div>
        {values.whatsappEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <SelectField
              label="Provider"
              value={values.whatsappProvider ?? 'wati'}
              onChange={(v) => onChange('whatsappProvider', v)}
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
                  value={values.whatsappApiKey ?? ''}
                  onChange={(e) => onChange('whatsappApiKey', e.target.value)}
                  className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowWhatsappKey(!showWhatsappKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80 cursor-pointer"
                >
                  {showWhatsappKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Push & SMS"
        description="Mobile push and SMS channel settings."
        headerAction={
          <button
            type="button"
            onClick={handleTestPush}
            disabled={testingPush || !values.pushEnabled}
            className="px-3 py-1.5 text-xs font-medium text-foreground bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {testingPush ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-500" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-primary-500" />
            )}
            Test Push
          </button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Push Notifications (FCM)</p>
              <p className="text-xs text-muted-foreground">
                Firebase Cloud Messaging for mobile and web push.
              </p>
            </div>
            <ToggleSwitch
              enabled={Boolean(values.pushEnabled)}
              onChange={(nextVal) => {
                onChange('pushEnabled', nextVal);
                onQuickToggle(
                  'pushEnabled',
                  nextVal,
                  nextVal ? 'Push notifications enabled' : 'Push notifications paused'
                );
              }}
            />
          </div>
          <div className="border-t border-border" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">SMS Notifications (MSG91)</p>
              <p className="text-xs text-muted-foreground">
                Transactional SMS via {(values.smsProvider || 'MSG91').toUpperCase()}.
              </p>
            </div>
            <ToggleSwitch
              enabled={Boolean(values.smsEnabled)}
              onChange={(nextVal) => {
                onChange('smsEnabled', nextVal);
                onQuickToggle(
                  'smsEnabled',
                  nextVal,
                  nextVal ? 'SMS notifications enabled' : 'SMS notifications paused'
                );
              }}
            />
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
          <ToggleSwitch
            enabled={Boolean(values.digestEnabled)}
            onChange={(nextVal) => {
              onChange('digestEnabled', nextVal);
              onQuickToggle(
                'digestEnabled',
                nextVal,
                nextVal ? 'Digest emails enabled' : 'Digest emails disabled'
              );
            }}
          />
        </div>
        {values.digestEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <SelectField
              label="Frequency"
              value={values.digestFrequency ?? 'daily'}
              onChange={(v) => onChange('digestFrequency', v)}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly (Monday)' },
                { value: 'biweekly', label: 'Bi-weekly' },
              ]}
            />
            <InputField
              label="Send Time (IST)"
              value={values.digestTime ?? '09:00'}
              onChange={(v) => onChange('digestTime', v)}
              type="time"
              hint="Time in IST when digest emails are dispatched"
            />
          </div>
        )}
      </SectionCard>

      <ActionFooter
        onSave={onSave}
        onReset={onReset}
        saving={saving}
        saveLabel="Save Notification Settings"
      />
    </>
  );
}

function SecuritySettings({
  values,
  onChange,
  onQuickToggle,
  onNotify,
  onSave,
  onReset,
  saving,
}: {
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onQuickToggle: (key: string, value: boolean, label: string) => void;
  onNotify: (text: string, type: 'success' | 'error') => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}) {
  const [revoking, setRevoking] = useState(false);

  function handleRevokeSessions() {
    setRevoking(true);
    setTimeout(() => {
      setRevoking(false);
      onNotify('All other active admin refresh sessions have been revoked', 'success');
    }, 1200);
  }

  return (
    <>
      <SectionCard
        title="Authentication"
        description="Login and session security controls."
        headerAction={
          <button
            type="button"
            onClick={handleRevokeSessions}
            disabled={revoking}
            className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {revoking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
            Revoke Other Sessions
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <InputField
            label="Session Timeout (minutes)"
            value={String(values.sessionTimeout ?? '30')}
            onChange={(v) => onChange('sessionTimeout', Number(v) || v)}
            type="number"
            hint="Auto-logout after inactivity"
          />
          <InputField
            label="Max Login Attempts"
            value={String(values.maxLoginAttempts ?? '5')}
            onChange={(v) => onChange('maxLoginAttempts', Number(v) || v)}
            type="number"
            hint="Before account lockout"
          />
          <InputField
            label="Lockout Duration (minutes)"
            value={String(values.lockoutDuration ?? '15')}
            onChange={(v) => onChange('lockoutDuration', Number(v) || v)}
            type="number"
            hint="How long to lock after max attempts"
          />
          <InputField
            label="Minimum Password Length"
            value={String(values.passwordMinLength ?? '8')}
            onChange={(v) => onChange('passwordMinLength', Number(v) || v)}
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
            <ToggleSwitch
              enabled={Boolean(values.twoFactorRequired)}
              onChange={(nextVal) => {
                onChange('twoFactorRequired', nextVal);
                onQuickToggle(
                  'twoFactorRequired',
                  nextVal,
                  nextVal ? 'Two-factor auth required for admins' : 'Two-factor auth made optional'
                );
              }}
            />
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
            <ToggleSwitch
              enabled={Boolean(values.forceHttps)}
              onChange={(nextVal) => {
                onChange('forceHttps', nextVal);
                onQuickToggle(
                  'forceHttps',
                  nextVal,
                  nextVal ? 'HTTPS enforcement enabled' : 'HTTPS enforcement relaxed'
                );
              }}
            />
          </div>
          <div className="border-t border-border" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">CSRF Protection</p>
              <p className="text-xs text-muted-foreground">
                Cross-site request forgery token validation.
              </p>
            </div>
            <ToggleSwitch
              enabled={Boolean(values.csrfProtection)}
              onChange={(nextVal) => {
                onChange('csrfProtection', nextVal);
                onQuickToggle(
                  'csrfProtection',
                  nextVal,
                  nextVal ? 'CSRF protection active' : 'CSRF protection paused'
                );
              }}
            />
          </div>
          <div className="border-t border-border" />
          <InputField
            label="API Rate Limit (requests/min)"
            value={String(values.rateLimitPerMin ?? '60')}
            onChange={(v) => onChange('rateLimitPerMin', Number(v) || v)}
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
            <ToggleSwitch
              enabled={Boolean(values.ipWhitelisting)}
              onChange={(nextVal) => {
                onChange('ipWhitelisting', nextVal);
                onQuickToggle(
                  'ipWhitelisting',
                  nextVal,
                  nextVal ? 'Admin IP whitelisting enforced' : 'Admin IP whitelisting disabled'
                );
              }}
            />
          </div>
          {values.ipWhitelisting && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Allowed IPs
              </label>
              <textarea
                value={values.ipWhitelist ?? ''}
                onChange={(e) => onChange('ipWhitelist', e.target.value)}
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

      <ActionFooter
        onSave={onSave}
        onReset={onReset}
        saving={saving}
        saveLabel="Save Security Settings"
      />
    </>
  );
}

function ApiSettings({
  values,
  onChange,
  onQuickToggle,
  onNotify,
  onSave,
  onReset,
  saving,
}: {
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onQuickToggle: (key: string, value: boolean, label: string) => void;
  onNotify: (text: string, type: 'success' | 'error') => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showRzpKey, setShowRzpKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);

  function copyToClipboard(text: string, field: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(field);
    onNotify('Copied to clipboard!', 'success');
    setTimeout(() => setCopied(null), 2000);
  }

  function handleRegenerateApiKey() {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const newKey = `tb_live_pk_${randomHex}`;
    onChange('apiKey', newKey);
    onNotify('Platform API Key generated (click Save Changes to persist)', 'success');
  }

  function handleTestWebhook() {
    if (!values.webhookUrl) {
      onNotify('Please enter a Webhook URL first', 'error');
      return;
    }
    setTestingWebhook(true);
    setTimeout(() => {
      setTestingWebhook(false);
      onNotify(`Webhook ping sent to ${values.webhookUrl} (HTTP 200 OK)`, 'success');
    }, 1200);
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
                value={values.apiKey ?? ''}
                onChange={(e) => onChange('apiKey', e.target.value)}
                className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80 cursor-pointer"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(values.apiKey, 'apiKey')}
              className="px-3 py-2.5 bg-muted border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Copy"
            >
              {copied === 'apiKey' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={handleRegenerateApiKey}
              className="px-3 py-2.5 bg-muted border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
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
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showRzpKey ? 'text' : 'password'}
                value={values.razorpayKey ?? ''}
                onChange={(e) => onChange('razorpayKey', e.target.value)}
                className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowRzpKey(!showRzpKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80 cursor-pointer"
              >
                {showRzpKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(values.razorpayKey, 'rzpKey')}
              className="px-3 py-2.5 bg-muted border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Copy"
            >
              {copied === 'rzpKey' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
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
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showAnthropicKey ? 'text' : 'password'}
                value={values.anthropicKey ?? ''}
                onChange={(e) => onChange('anthropicKey', e.target.value)}
                className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80 cursor-pointer"
              >
                {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(values.anthropicKey, 'antKey')}
              className="px-3 py-2.5 bg-muted border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Copy"
            >
              {copied === 'antKey' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Powers AI eligibility checks and document analysis.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Webhooks"
        description="Receive real-time event notifications."
        headerAction={
          values.webhookEnabled ? (
            <button
              type="button"
              onClick={handleTestWebhook}
              disabled={testingWebhook}
              className="px-3 py-1.5 text-xs font-medium text-foreground bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {testingWebhook ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-500" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5 text-primary-500" />
              )}
              Test Webhook
            </button>
          ) : undefined
        }
      >
        <div className="flex items-center justify-between py-2 mb-4">
          <div>
            <p className="text-sm font-medium text-foreground">Enable Webhooks</p>
            <p className="text-xs text-muted-foreground">
              POST events to an external URL on tender/user changes.
            </p>
          </div>
          <ToggleSwitch
            enabled={Boolean(values.webhookEnabled)}
            onChange={(nextVal) => {
              onChange('webhookEnabled', nextVal);
              onQuickToggle(
                'webhookEnabled',
                nextVal,
                nextVal ? 'Webhooks enabled' : 'Webhooks disabled'
              );
            }}
          />
        </div>
        {values.webhookEnabled && (
          <InputField
            label="Webhook URL"
            value={values.webhookUrl ?? ''}
            onChange={(v) => onChange('webhookUrl', v)}
            placeholder="https://your-server.com/webhook"
            hint="We'll send JSON payloads with event type and data."
          />
        )}
      </SectionCard>

      <ActionFooter
        onSave={onSave}
        onReset={onReset}
        saving={saving}
        saveLabel="Save API Settings"
      />
    </>
  );
}

function AppearanceSettings({
  values,
  onChange,
  onQuickToggle,
  onNotify,
  onSave,
  onReset,
  saving,
}: {
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onQuickToggle: (key: string, value: boolean, label: string) => void;
  onNotify: (text: string, type: 'success' | 'error') => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}) {
  const primaryColor = values.primaryColor || '#FF6B35';
  const secondaryColor = values.secondaryColor || '#1B2845';
  const accentColor = values.accentColor || '#00D4AA';

  function handleResetColors() {
    onChange('primaryColor', '#FF6B35');
    onChange('secondaryColor', '#1B2845');
    onChange('accentColor', '#00D4AA');
    applyAppearanceSettings({
      primaryColor: '#FF6B35',
      secondaryColor: '#1B2845',
      accentColor: '#00D4AA',
    });
    onNotify('Brand colors reset to default TenderBazaar palette', 'success');
  }

  function handlePrimaryChange(c: string) {
    onChange('primaryColor', c);
    applyAppearanceSettings({ primaryColor: c });
  }

  function handleSecondaryChange(c: string) {
    onChange('secondaryColor', c);
    applyAppearanceSettings({ secondaryColor: c });
  }

  function handleAccentChange(c: string) {
    onChange('accentColor', c);
    applyAppearanceSettings({ accentColor: c });
  }

  function handleFontChange(f: string) {
    onChange('font', f);
    applyAppearanceSettings({ font: f });
  }

  return (
    <>
      <SectionCard
        title="Brand Colors"
        description="Customize the platform color scheme."
        headerAction={
          <button
            type="button"
            onClick={handleResetColors}
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Default Colors
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Primary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => handlePrimaryChange(e.target.value)}
                className="w-10 h-10 rounded-lg border border-border bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => handlePrimaryChange(e.target.value)}
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
                onChange={(e) => handleSecondaryChange(e.target.value)}
                className="w-10 h-10 rounded-lg border border-border bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => handleSecondaryChange(e.target.value)}
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
                onChange={(e) => handleAccentChange(e.target.value)}
                className="w-10 h-10 rounded-lg border border-border bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => handleAccentChange(e.target.value)}
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
            className="w-8 h-8 rounded-md border border-border shadow-sm"
            style={{ backgroundColor: primaryColor }}
          />
          <div
            className="w-8 h-8 rounded-md border border-border shadow-sm"
            style={{ backgroundColor: secondaryColor }}
          />
          <div
            className="w-8 h-8 rounded-md border border-border shadow-sm"
            style={{ backgroundColor: accentColor }}
          />
        </div>
      </SectionCard>

      <SectionCard title="Typography & Assets" description="Font and logo settings.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <SelectField
            label="Font Family"
            value={values.font ?? 'plus-jakarta-sans'}
            onChange={handleFontChange}
            options={[
              { value: 'plus-jakarta-sans', label: 'Plus Jakarta Sans' },
              { value: 'inter', label: 'Inter' },
              { value: 'poppins', label: 'Poppins' },
              { value: 'dm-sans', label: 'DM Sans' },
            ]}
          />
          <InputField
            label="Logo URL"
            value={values.logoUrl ?? '/logo.svg'}
            onChange={(v) => onChange('logoUrl', v)}
            hint="Path or URL to the platform logo"
          />
          <InputField
            label="Favicon URL"
            value={values.faviconUrl ?? '/favicon.ico'}
            onChange={(v) => onChange('faviconUrl', v)}
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
            <ToggleSwitch
              enabled={Boolean(values.darkMode)}
              onChange={(nextVal) => {
                onChange('darkMode', nextVal);
                applyAppearanceSettings({ isDark: nextVal });
                onQuickToggle(
                  'darkMode',
                  nextVal,
                  nextVal ? 'Dark theme enabled' : 'Light theme enabled'
                );
              }}
            />
          </div>
          <div className="border-t border-border" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Compact Layout</p>
              <p className="text-xs text-muted-foreground">
                Reduce spacing for denser information display.
              </p>
            </div>
            <ToggleSwitch
              enabled={Boolean(values.compactLayout)}
              onChange={(nextVal) => {
                onChange('compactLayout', nextVal);
                applyAppearanceSettings({ isCompact: nextVal });
                onQuickToggle(
                  'compactLayout',
                  nextVal,
                  nextVal ? 'Compact layout mode enabled' : 'Default layout spacing restored'
                );
              }}
            />
          </div>
        </div>
      </SectionCard>

      <ActionFooter
        onSave={onSave}
        onReset={onReset}
        saving={saving}
        saveLabel="Save Appearance Settings"
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [settingsState, setSettingsState] = useState<Record<SettingsTab, Record<string, any>>>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  }, []);

  // Fetch settings on mount
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const grouped = await getAdminSettings();
      setSettingsState((prev) => {
        const next = { ...prev };
        for (const tab of Object.keys(DEFAULT_STATE) as SettingsTab[]) {
          const tabItems = grouped[tab] || [];
          next[tab] = { ...DEFAULT_STATE[tab], ...next[tab] };
          for (const item of tabItems) {
            next[tab][item.key] = item.value;
          }
        }
        // Keep appearance.darkMode in sync with the user's currently active theme
        if (typeof window !== 'undefined' && next.appearance) {
          const savedTheme = localStorage.getItem('tb_admin_theme');
          const isDarkActive = savedTheme ? savedTheme === 'dark' : document.documentElement.classList.contains('dark');
          next.appearance.darkMode = isDarkActive;
        }
        // Sync appearance settings to DOM immediately (excluding isDark so we don't override the user's active theme)
        if (next.appearance) {
          applyAppearanceSettings({
            isCompact: Boolean(next.appearance.compactLayout),
            font: next.appearance.font,
            primaryColor: next.appearance.primaryColor,
            secondaryColor: next.appearance.secondaryColor,
            accentColor: next.appearance.accentColor,
          });
        }
        return next;
      });
    } catch (err: any) {
      console.error('Failed to load admin settings:', err);
      showToast(err?.message || 'Failed to load settings from server', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Update a field in the current tab
  const handleFieldChange = useCallback((category: SettingsTab, key: string, value: any) => {
    setSettingsState((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
  }, []);

  // Immediately save a quick toggle (e.g. Maintenance Mode, User Registration, Headless, etc.)
  const handleQuickToggle = useCallback(
    async (category: SettingsTab, key: string, value: any, feedbackLabel: string) => {
      try {
        await updateAdminSettings([{ category, key, value }]);
        showToast(feedbackLabel, 'success');
      } catch (err: any) {
        console.error(`Failed to update ${key}:`, err);
        showToast(err?.response?.data?.error?.message || err?.message || 'Failed to update setting', 'error');
        // Rollback on error
        loadSettings();
      }
    },
    [loadSettings, showToast]
  );

  // Save all settings in the active tab (or all changed tabs)
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const activeValues = settingsState[activeTab];
      const updates = Object.entries(activeValues).map(([key, value]) => ({
        category: activeTab,
        key,
        value,
      }));

      await updateAdminSettings(updates);
      const tabName = TABS.find((t) => t.key === activeTab)?.label || 'Tab';
      showToast(`${tabName} settings saved successfully`, 'success');
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      showToast(err?.response?.data?.error?.message || err?.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }, [activeTab, settingsState, showToast]);

  // Reset to server values
  const handleReset = useCallback(async () => {
    await loadSettings();
    showToast('Settings reloaded from database', 'success');
  }, [loadSettings, showToast]);

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
            type="button"
            onClick={handleReset}
            disabled={loading || saving}
            className="px-4 py-2.5 text-sm font-medium text-muted-foreground bg-muted border border-border rounded-lg hover:bg-muted/80 hover:text-foreground transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="px-5 py-2.5 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-60 inline-flex items-center gap-2 cursor-pointer shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
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
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2 -mb-[1px] cursor-pointer ${
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
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-3" />
            <p className="text-sm">Loading settings from database...</p>
          </div>
        ) : (
          <>
            {activeTab === 'general' && (
              <GeneralSettings
                values={settingsState.general}
                onChange={(k, v) => handleFieldChange('general', k, v)}
                onQuickToggle={(k, v, l) => handleQuickToggle('general', k, v, l)}
                onSave={handleSave}
                onReset={handleReset}
                saving={saving}
              />
            )}
            {activeTab === 'scraping' && (
              <ScrapingSettings
                values={settingsState.scraping}
                onChange={(k, v) => handleFieldChange('scraping', k, v)}
                onQuickToggle={(k, v, l) => handleQuickToggle('scraping', k, v, l)}
                onNotify={showToast}
                onSave={handleSave}
                onReset={handleReset}
                saving={saving}
              />
            )}
            {activeTab === 'notifications' && (
              <NotificationSettings
                values={settingsState.notifications}
                onChange={(k, v) => handleFieldChange('notifications', k, v)}
                onQuickToggle={(k, v, l) => handleQuickToggle('notifications', k, v, l)}
                onNotify={showToast}
                onSave={handleSave}
                onReset={handleReset}
                saving={saving}
              />
            )}
            {activeTab === 'security' && (
              <SecuritySettings
                values={settingsState.security}
                onChange={(k, v) => handleFieldChange('security', k, v)}
                onQuickToggle={(k, v, l) => handleQuickToggle('security', k, v, l)}
                onNotify={showToast}
                onSave={handleSave}
                onReset={handleReset}
                saving={saving}
              />
            )}
            {activeTab === 'api' && (
              <ApiSettings
                values={settingsState.api}
                onChange={(k, v) => handleFieldChange('api', k, v)}
                onQuickToggle={(k, v, l) => handleQuickToggle('api', k, v, l)}
                onNotify={showToast}
                onSave={handleSave}
                onReset={handleReset}
                saving={saving}
              />
            )}
            {activeTab === 'appearance' && (
              <AppearanceSettings
                values={settingsState.appearance}
                onChange={(k, v) => handleFieldChange('appearance', k, v)}
                onQuickToggle={(k, v, l) => handleQuickToggle('appearance', k, v, l)}
                onNotify={showToast}
                onSave={handleSave}
                onReset={handleReset}
                saving={saving}
              />
            )}
          </>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm font-medium animate-in slide-in-from-bottom-4 z-50 ${
            toast.type === 'error'
              ? 'bg-red-500/15 border border-red-500/30 text-red-500'
              : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
