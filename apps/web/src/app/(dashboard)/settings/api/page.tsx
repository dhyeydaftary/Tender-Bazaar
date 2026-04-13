'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Key,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  Globe,
  Zap,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowUpRight,
  Bell,
  FileEdit,
  Clock,
  Send,
  Save,
  ChevronLeft,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

/* ------------------------------------------------------------------ */
/* Static Data                                                        */
/* ------------------------------------------------------------------ */

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/v1/tenders', description: 'Search tenders' },
  { method: 'GET', path: '/api/v1/tenders/:id', description: 'Get tender details' },
  { method: 'GET', path: '/api/v1/results', description: 'Search tender results' },
  { method: 'POST', path: '/api/v1/eligibility/check', description: 'Check eligibility' },
];

const WEBHOOK_EVENTS = [
  { id: 'new_tender_match', label: 'New Tender Match', description: 'Triggered when a new tender matches your alert criteria' },
  { id: 'tender_updated', label: 'Tender Updated', description: 'Triggered when a saved tender is updated or a corrigendum is issued' },
  { id: 'deadline_reminder', label: 'Deadline Reminder', description: 'Triggered 24 hours before a saved tender deadline' },
] as const;

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface ApiKeyInfo {
  apiKey: string; // masked
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
  plan: string;
}

interface WebhookConfig {
  url: string;
  events: string[];
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function ApiAccessPage() {
  // Loading / error states
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // API key info from server
  const [keyInfo, setKeyInfo] = useState<ApiKeyInfo | null>(null);
  const [hasKey, setHasKey] = useState(false);

  // Full key shown only once after generate/regenerate
  const [fullKey, setFullKey] = useState<string | null>(null);

  // API key UI state
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<'success' | 'error' | null>(null);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(true);

  // Plan-based access
  const [isEnterprise, setIsEnterprise] = useState(false);

  /* ---------------------------------------------------------------- */
  /* Fetch initial data                                               */
  /* ---------------------------------------------------------------- */

  const fetchKeyInfo = useCallback(async () => {
    try {
      const res = await api.get('/api-keys/info');
      const data = res.data.data as ApiKeyInfo;
      setKeyInfo(data);
      setHasKey(true);
      setIsEnterprise(true);
      setPageError(null);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // No API key exists yet — user may still be Enterprise
        setHasKey(false);
        setKeyInfo(null);
        // Check if this is plan-gated (403) or just no key
        setIsEnterprise(true);
      } else if (err.response?.status === 403) {
        // Not on Enterprise plan
        setIsEnterprise(false);
      } else {
        setPageError('Failed to load API key info. Please try again.');
      }
    }
  }, []);

  const fetchWebhookConfig = useCallback(async () => {
    try {
      const res = await api.get('/api-keys/webhook');
      const data = res.data.data as WebhookConfig;
      setWebhookUrl(data.url || '');
      setSelectedEvents(new Set(data.events || []));
    } catch {
      // Webhook not configured yet — that's fine
      setWebhookUrl('');
      setSelectedEvents(new Set());
    } finally {
      setWebhookLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setPageLoading(true);
      await fetchKeyInfo();
      await fetchWebhookConfig();
      setPageLoading(false);
    };
    init();
  }, [fetchKeyInfo, fetchWebhookConfig]);

  /* ---------------------------------------------------------------- */
  /* Handlers                                                         */
  /* ---------------------------------------------------------------- */

  const handleCopyKey = useCallback(async () => {
    const keyToCopy = fullKey || keyInfo?.apiKey;
    if (!keyToCopy) return;
    await navigator.clipboard.writeText(keyToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [fullKey, keyInfo]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await api.post('/api-keys/generate');
      const newKey = res.data.data.apiKey || res.data.data;
      setFullKey(typeof newKey === 'string' ? newKey : newKey.apiKey);
      setShowKey(true);
      await fetchKeyInfo();
    } catch (err: any) {
      setPageError(err.response?.data?.error?.message || 'Failed to generate API key.');
    } finally {
      setGenerating(false);
    }
  }, [fetchKeyInfo]);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const res = await api.post('/api-keys/regenerate');
      const newKey = res.data.data.apiKey || res.data.data;
      setFullKey(typeof newKey === 'string' ? newKey : newKey.apiKey);
      setShowKey(true);
      setShowRegenConfirm(false);
      await fetchKeyInfo();
    } catch (err: any) {
      setPageError(err.response?.data?.error?.message || 'Failed to regenerate API key.');
    } finally {
      setRegenerating(false);
    }
  }, [fetchKeyInfo]);

  const handleRevoke = useCallback(async () => {
    setRevoking(true);
    try {
      await api.delete('/api-keys');
      setKeyInfo(null);
      setHasKey(false);
      setFullKey(null);
      setShowKey(false);
      setShowRevokeConfirm(false);
    } catch (err: any) {
      setPageError(err.response?.data?.error?.message || 'Failed to revoke API key.');
    } finally {
      setRevoking(false);
    }
  }, []);

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    setWebhookTestResult(null);
    try {
      await api.put('/api-keys/webhook', {
        url: webhookUrl,
        events: Array.from(selectedEvents),
        test: true,
      });
      setWebhookTestResult('success');
    } catch {
      setWebhookTestResult('error');
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleSaveWebhook = async () => {
    setSavingWebhook(true);
    try {
      await api.put('/api-keys/webhook', {
        url: webhookUrl,
        events: Array.from(selectedEvents),
      });
    } catch (err: any) {
      setPageError(err.response?.data?.error?.message || 'Failed to save webhook configuration.');
    } finally {
      setSavingWebhook(false);
    }
  };

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Determine displayed key text
  const displayKey = fullKey
    ? showKey
      ? fullKey
      : fullKey.slice(0, 8) + '****************************' + fullKey.slice(-4)
    : keyInfo?.apiKey || '';

  /* ---------------------------------------------------------------- */
  /* Loading state                                                    */
  /* ---------------------------------------------------------------- */
  if (pageLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Settings
        </Link>

        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Upgrade Banner (non-Enterprise)                                  */
  /* ---------------------------------------------------------------- */
  if (!isEnterprise) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Settings
        </Link>

        <div className="rounded-2xl border bg-card p-8 sm:p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center mx-auto mb-6">
            <Key className="h-8 w-8 text-primary-500" />
          </div>
          <h1 className="text-2xl font-bold mb-3">API Access</h1>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            API access is available exclusively on the Enterprise plan. Upgrade to
            integrate TenderBazaar data directly into your systems.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/subscription"
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Upgrade to Enterprise
            </Link>
            <Link
              href="/help"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Learn more
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Full API Access Page (Enterprise)                                */
  /* ---------------------------------------------------------------- */
  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center">
          <Key className="h-5 w-5 text-primary-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">API Access</h1>
          <p className="text-sm text-muted-foreground">
            Manage your API key, view usage, and configure webhooks
          </p>
        </div>
      </div>

      {/* Error banner */}
      {pageError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 mb-6 flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {pageError}
          <button
            onClick={() => setPageError(null)}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Full key warning banner — shown only right after generate/regenerate */}
      {fullKey && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 mb-6 flex items-start gap-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">
              Copy your API key now
            </p>
            <p className="text-amber-700 dark:text-amber-400">
              This is the only time your full API key will be displayed. Copy it and store it securely.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* ---- API Key Section ---- */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            API Key
          </h2>

          {!hasKey ? (
            /* No key yet — show generate button */
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-4">
                You haven&apos;t generated an API key yet. Generate one to start using the API.
              </p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4" />
                    Generate API Key
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              {/* Key display */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 font-mono text-sm bg-muted/50 rounded-lg px-4 py-3 border">
                  {showKey ? displayKey : (keyInfo?.apiKey || displayKey)}
                </div>
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="p-2.5 rounded-lg border bg-card hover:bg-muted transition-colors"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <button
                  onClick={handleCopyKey}
                  className={cn(
                    'p-2.5 rounded-lg border transition-colors',
                    copied
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                      : 'bg-card hover:bg-muted'
                  )}
                  title="Copy key"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Key metadata */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground mb-4">
                <span>
                  Created: <span className="text-foreground">{formatDate(keyInfo?.createdAt)}</span>
                </span>
                <span>
                  Last used: <span className="text-foreground">{formatDate(keyInfo?.lastUsedAt)}</span>
                </span>
                {keyInfo?.plan && (
                  <span>
                    Plan: <span className="text-foreground capitalize">{keyInfo.plan}</span>
                  </span>
                )}
              </div>

              {/* Regenerate */}
              <div className="flex items-center gap-4">
                {!showRegenConfirm ? (
                  <button
                    onClick={() => setShowRegenConfirm(true)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate Key
                  </button>
                ) : (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 w-full">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">
                          Are you sure you want to regenerate your API key?
                        </p>
                        <p className="text-sm text-muted-foreground mb-3">
                          This action cannot be undone. Your current key will be immediately
                          invalidated and all integrations using it will stop working.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleRegenerate}
                            disabled={regenerating}
                            className="inline-flex items-center gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {regenerating ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Regenerating...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-3.5 w-3.5" />
                                Yes, Regenerate
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setShowRegenConfirm(false)}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!showRegenConfirm && !showRevokeConfirm && (
                  <button
                    onClick={() => setShowRevokeConfirm(true)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Revoke Key
                  </button>
                )}
              </div>

              {/* Revoke confirmation */}
              {showRevokeConfirm && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 mt-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        Revoke your API key?
                      </p>
                      <p className="text-sm text-muted-foreground mb-3">
                        This will permanently delete your API key. You can generate a new one later.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleRevoke}
                          disabled={revoking}
                          className="inline-flex items-center gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {revoking ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Revoking...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-3.5 w-3.5" />
                              Yes, Revoke
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setShowRevokeConfirm(false)}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ---- API Documentation Quick Reference ---- */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            API Quick Reference
          </h2>

          {/* Endpoints */}
          <div className="rounded-lg border bg-muted/30 overflow-hidden mb-4">
            <div className="px-4 py-2.5 bg-muted/50 border-b">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Endpoints
              </span>
            </div>
            <div className="divide-y">
              {API_ENDPOINTS.map((ep) => (
                <div key={ep.path} className="px-4 py-3 flex items-center gap-3">
                  <span
                    className={cn(
                      'font-mono text-xs font-bold px-2 py-0.5 rounded',
                      ep.method === 'GET'
                        ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                    )}
                  >
                    {ep.method}
                  </span>
                  <code className="font-mono text-sm text-foreground flex-1">
                    {ep.path}
                  </code>
                  <span className="text-sm text-muted-foreground hidden sm:block">
                    {ep.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Auth info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border p-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Authentication
              </span>
              <p className="text-foreground">
                Pass your API key as a Bearer token in the{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  Authorization
                </code>{' '}
                header.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Rate Limits
              </span>
              <p className="text-foreground">
                100 requests per hour. Rate limit headers are included in every response.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <Link
              href="/api-docs"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-500 hover:text-primary-600 transition-colors"
            >
              View full API documentation
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* ---- Webhook Configuration ---- */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            Webhook Configuration
          </h2>

          {webhookLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Webhook URL */}
              <div className="mb-5">
                <label className="block text-sm font-medium mb-1.5">Webhook URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-domain.com/webhooks/tenderbazaar"
                  className="w-full px-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                />
              </div>

              {/* Event checkboxes */}
              <div className="mb-5">
                <label className="block text-sm font-medium mb-3">Events</label>
                <div className="space-y-3">
                  {WEBHOOK_EVENTS.map((event) => (
                    <label
                      key={event.id}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                        selectedEvents.has(event.id)
                          ? 'border-primary-500/30 bg-primary-50/50 dark:bg-primary-950/20'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.has(event.id)}
                        onChange={() => toggleEvent(event.id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                      />
                      <div>
                        <span className="text-sm font-medium block">{event.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {event.description}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Webhook test result */}
              {webhookTestResult && (
                <div
                  className={cn(
                    'rounded-lg border p-3 mb-4 flex items-center gap-2 text-sm',
                    webhookTestResult === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400'
                      : 'border-destructive/30 bg-destructive/5 text-destructive'
                  )}
                >
                  {webhookTestResult === 'success' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Webhook test successful! Your endpoint returned 200 OK.
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Webhook test failed. Please check your URL and try again.
                    </>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTestWebhook}
                  disabled={!webhookUrl.trim() || testingWebhook}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                    webhookUrl.trim() && !testingWebhook
                      ? 'hover:bg-muted'
                      : 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {testingWebhook ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Test Webhook
                    </>
                  )}
                </button>
                <button
                  onClick={handleSaveWebhook}
                  disabled={savingWebhook}
                  className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {savingWebhook ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
