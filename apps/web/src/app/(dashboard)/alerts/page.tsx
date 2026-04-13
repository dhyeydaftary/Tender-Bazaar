'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  Bell,
  BellRing,
  Plus,
  Pencil,
  Trash2,
  Zap,
  Clock,
  CalendarDays,
  Mail,
  Smartphone,
  MessageSquare,
  X,
  Search,
  Tag,
  MapPin,
  IndianRupee,
  Check,
  History,
  FileText,
  Shield,
  AlertTriangle,
  Bookmark,
  TrendingUp,
  ChevronDown,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLimitGate } from '@/lib/hooks/use-feature-gate';
import { UpgradeBanner } from '@/components/subscription';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface Alert {
  id: string;
  name: string;
  keywords: string[];
  categories: string[];
  states: string[];
  /* Flattened for the card UI */
  category: string;
  state: string;
  frequency: 'INSTANT' | 'DAILY' | 'WEEKLY';
  emailEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  matchesToday: number;
  isActive: boolean;
}

interface ApiNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface Notification {
  id: string;
  icon: 'tender' | 'alert' | 'eligibility' | 'deadline' | 'saved';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

interface NotificationGroup {
  label: string;
  notifications: Notification[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const CATEGORIES = ['Works', 'Goods', 'Services', 'Consultancy'];
const STATES = [
  'All India', 'Andhra Pradesh', 'Bihar', 'Delhi', 'Gujarat', 'Haryana',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Punjab',
  'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal',
];

const FREQUENCIES: {
  value: Alert['frequency'];
  label: string;
  icon: typeof Zap;
  color: string;
}[] = [
  { value: 'INSTANT', label: 'Instant', icon: Zap, color: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400' },
  { value: 'DAILY', label: 'Daily', icon: Clock, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'WEEKLY', label: 'Weekly', icon: CalendarDays, color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Map API notification type to the icon key used by the UI. */
function mapNotificationType(type: string): Notification['icon'] {
  switch (type) {
    case 'ALERT_MATCH':
    case 'ALERT':
      return 'alert';
    case 'DEADLINE':
    case 'DEADLINE_REMINDER':
      return 'deadline';
    case 'ELIGIBILITY':
      return 'eligibility';
    case 'SAVED':
    case 'SAVED_REMINDER':
      return 'saved';
    default:
      return 'tender';
  }
}

/** Human-readable relative time string. */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Return "Today", "Yesterday", or the formatted date. */
function dateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (target.getTime() === today.getTime()) return 'Today';
  if (target.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Convert flat API notifications into grouped format for the UI. */
function groupNotifications(raw: ApiNotification[]): NotificationGroup[] {
  const groups: Record<string, Notification[]> = {};
  for (const n of raw) {
    const label = dateLabel(n.createdAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push({
      id: n.id,
      icon: mapNotificationType(n.type),
      title: n.title,
      body: n.message,
      time: timeAgo(n.createdAt),
      read: n.isRead,
    });
  }
  // Preserve insertion order (API returns newest first)
  return Object.entries(groups).map(([label, notifications]) => ({ label, notifications }));
}

/** Normalise alert from API response — handles both flat and nested shapes. */
function normaliseAlert(raw: any): Alert {
  return {
    id: raw.id,
    name: raw.name,
    keywords: raw.keywords ?? [],
    categories: raw.categories ?? (raw.category ? [raw.category] : []),
    states: raw.states ?? (raw.state ? [raw.state] : []),
    category: raw.categories?.[0] ?? raw.category ?? '',
    state: raw.states?.[0] ?? raw.state ?? '',
    frequency: raw.frequency ?? 'DAILY',
    emailEnabled: raw.emailEnabled ?? false,
    pushEnabled: raw.pushEnabled ?? false,
    whatsappEnabled: raw.whatsappEnabled ?? false,
    matchesToday: raw.matchesToday ?? 0,
    isActive: raw.isActive ?? true,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOGGLE SWITCH
   ═══════════════════════════════════════════════════════════════════════════ */

function ToggleSwitch({
  checked,
  onChange,
  size = 'default',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'default' | 'small';
}) {
  const isSmall = size === 'small';
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex items-center rounded-full transition-colors shrink-0',
        checked ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600',
        isSmall ? 'h-5 w-9' : 'h-6 w-11',
      )}
    >
      <span
        className={cn(
          'inline-block transform rounded-full bg-white transition-transform shadow-sm',
          isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4',
          checked
            ? isSmall ? 'translate-x-[18px]' : 'translate-x-6'
            : 'translate-x-1',
        )}
      />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NOTIFICATION ICON
   ═══════════════════════════════════════════════════════════════════════════ */

function NotificationIcon({ type }: { type: Notification['icon'] }) {
  const map = {
    tender: { icon: FileText, bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400' },
    alert: { icon: BellRing, bg: 'bg-primary-50 dark:bg-primary-950/30', color: 'text-primary-600 dark:text-primary-400' },
    eligibility: { icon: Shield, bg: 'bg-accent-100 dark:bg-accent-900/30', color: 'text-accent-600 dark:text-accent-400' },
    deadline: { icon: AlertTriangle, bg: 'bg-amber-100 dark:bg-amber-900/30', color: 'text-amber-600 dark:text-amber-400' },
    saved: { icon: Bookmark, bg: 'bg-purple-100 dark:bg-purple-900/30', color: 'text-purple-600 dark:text-purple-400' },
  };
  const cfg = map[type];
  const Icon = cfg.icon;

  return (
    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', cfg.bg)}>
      <Icon className={cn('h-4.5 w-4.5', cfg.color)} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ALERT CARD
   ═══════════════════════════════════════════════════════════════════════════ */

function AlertCard({
  alert,
  onToggle,
  onEdit,
  onDelete,
}: {
  alert: Alert;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const freq = FREQUENCIES.find((f) => f.value === alert.frequency);

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-xl p-5 transition-all duration-200 hover:shadow-md',
        !alert.isActive && 'opacity-60',
      )}
    >
      {/* Name + Active toggle */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-body-sm font-semibold text-foreground truncate">{alert.name}</h3>
        <ToggleSwitch checked={alert.isActive} onChange={() => onToggle(alert.id)} />
      </div>

      {/* Keywords pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {alert.keywords.map((kw) => (
          <span
            key={kw}
            className="bg-primary-50 text-primary-700 dark:bg-primary-950/30 dark:text-primary-400 px-2.5 py-0.5 rounded-full text-caption font-medium"
          >
            {kw}
          </span>
        ))}
      </div>

      {/* Category + State */}
      <div className="flex items-center gap-3 mb-3 text-caption text-muted-foreground">
        <span className="flex items-center gap-1">
          <Tag className="h-3 w-3" />
          {alert.category}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {alert.state}
        </span>
      </div>

      {/* Frequency + Channels */}
      <div className="flex items-center justify-between mb-3">
        <div>
          {freq && (
            <span className={cn('text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1 w-fit', freq.color)}>
              <freq.icon className="h-3 w-3" />
              {freq.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Mail
            className={cn(
              'h-4 w-4 transition-colors',
              alert.emailEnabled ? 'text-primary-500' : 'text-muted-foreground/30',
            )}
          />
          <Smartphone
            className={cn(
              'h-4 w-4 transition-colors',
              alert.pushEnabled ? 'text-primary-500' : 'text-muted-foreground/30',
            )}
          />
          <MessageSquare
            className={cn(
              'h-4 w-4 transition-colors',
              alert.whatsappEnabled ? 'text-accent-500' : 'text-muted-foreground/30',
            )}
          />
        </div>
      </div>

      {/* Match count */}
      <div className="flex items-center gap-1.5 text-caption text-muted-foreground mb-4">
        <TrendingUp className="h-3.5 w-3.5" />
        <span>
          <span className="font-mono font-semibold text-foreground">{alert.matchesToday}</span> matches today
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <button
          onClick={() => onEdit(alert.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
        <div className="ml-auto">
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-red-500 mr-1">Delete?</span>
              <button
                onClick={() => {
                  onDelete(alert.id);
                  setConfirmDelete(false);
                }}
                className="px-2 py-1 text-[11px] font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground rounded transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CREATE ALERT FORM
   ═══════════════════════════════════════════════════════════════════════════ */

function CreateAlertForm({
  onClose,
  onSave,
  editingAlert,
}: {
  onClose: () => void;
  onSave: (data: any, id?: string) => Promise<void>;
  editingAlert?: Alert | null;
}) {
  const [name, setName] = useState(editingAlert?.name ?? '');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>(editingAlert?.keywords ?? []);
  const [category, setCategory] = useState(editingAlert?.category ?? '');
  const [state, setState] = useState(editingAlert?.state ?? '');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [frequency, setFrequency] = useState<Alert['frequency']>(editingAlert?.frequency ?? 'DAILY');
  const [emailEnabled, setEmailEnabled] = useState(editingAlert?.emailEnabled ?? true);
  const [pushEnabled, setPushEnabled] = useState(editingAlert?.pushEnabled ?? false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(editingAlert?.whatsappEnabled ?? false);
  const [isSaving, setIsSaving] = useState(false);

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
    }
    setKeywordInput('');
  };

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-heading-sm font-display text-foreground">
          {editingAlert ? 'Edit Alert' : 'Create New Alert'}
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Alert name */}
        <div>
          <label className="block text-caption font-medium text-foreground mb-1.5">Alert Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., IT Software Tenders in Maharashtra"
            className="w-full px-3 py-2.5 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Keywords */}
        <div>
          <label className="block text-caption font-medium text-foreground mb-1.5">Keywords</label>
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 dark:bg-primary-950/30 dark:text-primary-400 px-3 py-1 rounded-full text-caption"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => removeKeyword(kw)}
                    className="hover:text-primary-900 dark:hover:text-primary-200 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addKeyword();
              }
            }}
            placeholder="Type a keyword and press Enter"
            className="w-full px-3 py-2.5 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Category + State row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-caption font-medium text-foreground mb-1.5">Category</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 border border-input rounded-lg bg-background text-foreground text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-8"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-caption font-medium text-foreground mb-1.5">State / UT</label>
            <div className="relative">
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 border border-input rounded-lg bg-background text-foreground text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-8"
              >
                <option value="">All States</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Value range */}
        <div>
          <label className="block text-caption font-medium text-foreground mb-1.5">Value Range (INR)</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-body-sm text-muted-foreground">₹</span>
              <input
                type="number"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                placeholder="Min"
                className="w-full pl-7 pr-3 py-2.5 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono"
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-body-sm text-muted-foreground">₹</span>
              <input
                type="number"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                placeholder="Max"
                className="w-full pl-7 pr-3 py-2.5 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono"
              />
            </div>
          </div>
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-caption font-medium text-foreground mb-1.5">Frequency</label>
          <div className="grid grid-cols-3 gap-2">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFrequency(f.value)}
                className={cn(
                  'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-caption font-medium border transition-colors',
                  frequency === f.value
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'border-input text-muted-foreground hover:text-foreground hover:border-foreground/30',
                )}
              >
                <f.icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notification channels */}
        <div>
          <label className="block text-caption font-medium text-foreground mb-3">Channels</label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-body-sm text-foreground">Email</span>
              </div>
              <ToggleSwitch checked={emailEnabled} onChange={setEmailEnabled} size="small" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span className="text-body-sm text-foreground">Push</span>
              </div>
              <ToggleSwitch checked={pushEnabled} onChange={setPushEnabled} size="small" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-body-sm text-foreground">WhatsApp</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400">
                  Pro+
                </span>
              </div>
              <ToggleSwitch checked={whatsappEnabled} onChange={setWhatsappEnabled} size="small" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
        <button
          onClick={onClose}
          className="px-4 py-2 text-body-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          disabled={!name.trim() || isSaving}
          onClick={async () => {
            setIsSaving(true);
            try {
              const payload = {
                name: name.trim(),
                keywords,
                categories: category ? [category] : [],
                states: state ? [state] : [],
                minValue: minValue ? Number(minValue) : undefined,
                maxValue: maxValue ? Number(maxValue) : undefined,
                frequency,
                emailEnabled,
                pushEnabled,
                whatsappEnabled,
              };
              await onSave(payload, editingAlert?.id);
              onClose();
            } catch {
              // error is toasted by onSave
            } finally {
              setIsSaving(false);
            }
          }}
          className="px-5 py-2 text-body-sm font-medium bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {editingAlert ? 'Update Alert' : 'Save Alert'}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

type Tab = 'alerts' | 'history';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notificationGroups, setNotificationGroups] = useState<NotificationGroup[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('alerts');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [notifsError, setNotifsError] = useState<string | null>(null);

  // Plan limit gate
  const alertLimit = useLimitGate('maxAlerts');

  /* ─── Fetch Alerts ─── */

  const fetchAlerts = useCallback(async () => {
    setIsLoadingAlerts(true);
    setAlertsError(null);
    try {
      const res = await api.get('/alerts');
      const raw = res.data.data ?? [];
      const list = (Array.isArray(raw) ? raw : raw.alerts ?? []).map(normaliseAlert);
      setAlerts(list);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to load alerts';
      setAlertsError(msg);
      toast.error(msg);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, []);

  /* ─── Fetch Notifications ─── */

  const fetchNotifications = useCallback(async () => {
    setIsLoadingNotifs(true);
    setNotifsError(null);
    try {
      const res = await api.get('/notifications', { params: { limit: 50 } });
      const data = res.data.data;
      const raw: ApiNotification[] = data.notifications ?? data ?? [];
      setNotificationGroups(groupNotifications(raw));
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to load notifications';
      setNotifsError(msg);
      toast.error(msg);
    } finally {
      setIsLoadingNotifs(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchNotifications();
    }
  }, [activeTab, fetchNotifications]);

  /* ─── Create / Update Alert ─── */

  const handleSaveAlert = async (payload: any, id?: string) => {
    if (id) {
      const res = await api.patch(`/alerts/${id}`, payload);
      const updated = normaliseAlert(res.data.data);
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      toast.success('Alert updated');
    } else {
      const res = await api.post('/alerts', payload);
      const created = normaliseAlert(res.data.data);
      setAlerts((prev) => [created, ...prev]);
      toast.success('Alert created');
    }
  };

  /* ─── Toggle Alert Active ─── */

  const handleToggle = async (id: string) => {
    const target = alerts.find((a) => a.id === id);
    if (!target) return;
    // Optimistic update
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a)),
    );
    try {
      await api.patch(`/alerts/${id}`, { isActive: !target.isActive });
    } catch (err: any) {
      // Revert on failure
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isActive: target.isActive } : a)),
      );
      toast.error(err.response?.data?.error?.message || 'Failed to update alert');
    }
  };

  /* ─── Edit Alert ─── */

  const handleEdit = (id: string) => {
    const target = alerts.find((a) => a.id === id) ?? null;
    setEditingAlert(target);
    setShowCreateForm(true);
  };

  /* ─── Delete Alert ─── */

  const handleDelete = async (id: string) => {
    const prev = alerts;
    setAlerts((a) => a.filter((x) => x.id !== id));
    try {
      await api.delete(`/alerts/${id}`);
      toast.success('Alert deleted');
    } catch (err: any) {
      setAlerts(prev);
      toast.error(err.response?.data?.error?.message || 'Failed to delete alert');
    }
  };

  /* ─── Mark Notification as Read ─── */

  const handleMarkRead = async (notifId: string) => {
    try {
      await api.patch(`/notifications/${notifId}/read`);
      setNotificationGroups((prev) =>
        prev.map((g) => ({
          ...g,
          notifications: g.notifications.map((n) =>
            n.id === notifId ? { ...n, read: true } : n,
          ),
        })),
      );
    } catch {
      // silent fail
    }
  };

  /* ─── Stats ─── */

  const activeCount = alerts.filter((a) => a.isActive).length;
  const totalMatchesToday = alerts.reduce((sum, a) => sum + a.matchesToday, 0);

  return (
    <div>
      {/* Limit banner */}
      {!alertLimit.hasCapacity && !alertLimit.isUnlimited && (
        <div className="mb-6">
          <UpgradeBanner
            feature="Tender Alerts"
            requiredPlan="Starter"
            currentPlan={alertLimit.currentPlan}
            variant="inline"
          />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-heading-lg text-foreground font-display">Smart Alerts</h1>
          <p className="text-body-sm text-muted-foreground mt-0.5">
            <span className="font-mono font-semibold text-foreground">{activeCount}</span> active alerts
            {!alertLimit.isUnlimited && (
              <span> / {alertLimit.limit} max</span>
            )}
            {' '}&middot;{' '}
            <span className="font-mono font-semibold text-foreground">{totalMatchesToday}</span> matches today
          </p>
        </div>
        {activeTab === 'alerts' && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" />
            Create Alert
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab('alerts')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-body-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'alerts'
              ? 'border-primary-500 text-primary-500'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Bell className="h-4 w-4" />
          My Alerts
          <span className={cn(
            'font-mono text-[11px] px-1.5 py-0.5 rounded-full',
            activeTab === 'alerts' ? 'bg-primary-500/10 text-primary-500' : 'bg-muted text-muted-foreground',
          )}>
            {alerts.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-body-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'history'
              ? 'border-primary-500 text-primary-500'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <History className="h-4 w-4" />
          Notification History
        </button>
      </div>

      {/* ── MY ALERTS TAB ── */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* Create Alert Form */}
          {showCreateForm && (
            <CreateAlertForm
              editingAlert={editingAlert}
              onSave={handleSaveAlert}
              onClose={() => {
                setShowCreateForm(false);
                setEditingAlert(null);
              }}
            />
          )}

          {/* Alert Cards Grid */}
          {isLoadingAlerts ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
          ) : alertsError ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
              <h3 className="text-heading-sm font-display text-foreground mb-2">Failed to load alerts</h3>
              <p className="text-body-sm text-muted-foreground max-w-sm mx-auto mb-6">{alertsError}</p>
              <button
                onClick={fetchAlerts}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Bell className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-heading-sm font-display text-foreground mb-2">No alerts yet</h3>
              <p className="text-body-sm text-muted-foreground max-w-sm mx-auto mb-6">
                Create your first alert to get notified about matching tenders.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Alert
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── NOTIFICATION HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {isLoadingNotifs ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
          ) : notifsError ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
              <h3 className="text-heading-sm font-display text-foreground mb-2">Failed to load notifications</h3>
              <p className="text-body-sm text-muted-foreground max-w-sm mx-auto mb-6">{notifsError}</p>
              <button
                onClick={fetchNotifications}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : notificationGroups.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Bell className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-heading-sm font-display text-foreground mb-2">No notifications yet</h3>
              <p className="text-body-sm text-muted-foreground max-w-sm mx-auto">
                Your notification history will appear here.
              </p>
            </div>
          ) : (
            notificationGroups.map((group) => (
              <div key={group.label}>
                <h3 className="text-overline text-muted-foreground uppercase tracking-widest text-[10px] mb-3 px-1">
                  {group.label}
                </h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                  {group.notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (!notif.read) handleMarkRead(notif.id);
                      }}
                      className={cn(
                        'flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-muted/30',
                        !notif.read && 'bg-primary-500/[0.03] cursor-pointer',
                      )}
                    >
                      <NotificationIcon type={notif.icon} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className={cn(
                            'text-body-sm text-foreground',
                            !notif.read && 'font-semibold',
                          )}>
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-caption text-muted-foreground mt-0.5 line-clamp-1">
                          {notif.body}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70 mt-1">{notif.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
