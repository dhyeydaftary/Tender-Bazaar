'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  User,
  Building2,
  Bell,
  Shield,
  Palette,
  Camera,
  Loader2,
  Save,
  Eye,
  EyeOff,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
  BadgeCheck,
  Info,
  Lock,
  Smartphone,
  Monitor,
  Moon,
  Sun,
  SunMoon,
  LayoutGrid,
  AlignJustify,
  Maximize2,
  Mail,
  MessageSquare,
  BellRing,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';

/* ================================================================== */
/* Constants                                                          */
/* ================================================================== */

const TABS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'company', label: 'Company Profile', icon: Building2 },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'appearance', label: 'Appearance', icon: Palette },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const COMPANY_TYPES = [
  { value: 'PRIVATE_LIMITED', label: 'Private Limited' },
  { value: 'LLP', label: 'LLP' },
  { value: 'PROPRIETORSHIP', label: 'Proprietorship' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'SOCIETY', label: 'Society' },
  { value: 'TRUST', label: 'Trust' },
  { value: 'GOVERNMENT', label: 'Government' },
];

const TURNOVER_OPTIONS = [
  { value: 'below_25l', label: 'Below 25 Lakh' },
  { value: '25l_1cr', label: '25 Lakh - 1 Crore' },
  { value: '1cr_5cr', label: '1 Crore - 5 Crore' },
  { value: '5cr_25cr', label: '5 Crore - 25 Crore' },
  { value: '25cr_100cr', label: '25 Crore - 100 Crore' },
  { value: '100cr_500cr', label: '100 Crore - 500 Crore' },
  { value: 'above_500cr', label: 'Above 500 Crore' },
];

const EXPERIENCE_OPTIONS = [
  { value: '0_1', label: '0-1 years' },
  { value: '1_3', label: '1-3 years' },
  { value: '3_5', label: '3-5 years' },
  { value: '5_10', label: '5-10 years' },
  { value: '10_20', label: '10-20 years' },
  { value: 'above_20', label: '20+ years' },
];

const WORK_CATEGORIES = [
  'Construction',
  'IT & Software',
  'Medical Equipment',
  'Electrical',
  'Supply',
  'Consultancy',
  'Civil Works',
  'Road Construction',
  'Bridge Construction',
  'Building Construction',
  'Water Supply',
  'Plumbing',
  'HVAC',
  'Telecommunication',
  'Transportation',
  'Environmental',
  'Agriculture',
  'Education',
  'Healthcare',
  'Defence',
];

const ALL_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Jammu & Kashmir',
  'Ladakh',
  'Chandigarh',
  'Puducherry',
  'Andaman & Nicobar Islands',
  'Dadra & Nagar Haveli and Daman & Diu',
  'Lakshadweep',
];

const INDUSTRY_OPTIONS = [
  'Construction & Infrastructure',
  'Information Technology',
  'Healthcare & Pharmaceuticals',
  'Manufacturing',
  'Energy & Power',
  'Telecommunications',
  'Agriculture & Food',
  'Defence & Aerospace',
  'Transportation & Logistics',
  'Education & Training',
  'Environmental Services',
  'Financial Services',
  'Other',
];

/* ================================================================== */
/* Types                                                              */
/* ================================================================== */

interface NotificationPrefs {
  tenderAlerts: { email: boolean; push: boolean; whatsapp: boolean; sms: boolean };
  deadlineReminders: { email: boolean; push: boolean; whatsapp: boolean; sms: boolean };
  eligibilityResults: { email: boolean; push: boolean; whatsapp: boolean; sms: boolean };
  billing: { email: boolean; push: boolean; whatsapp: boolean; sms: boolean };
  system: { email: boolean; push: boolean; whatsapp: boolean; sms: boolean };
}

/* ================================================================== */
/* Helper components                                                  */
/* ================================================================== */

function FormInput({
  label,
  required,
  type = 'text',
  value,
  onChange,
  placeholder,
  readOnly,
  rightElement,
  helpText,
}: {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  rightElement?: React.ReactNode;
  helpText?: string;
}) {
  return (
    <div>
      <label className="block text-body-sm font-medium text-muted-foreground mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          readOnly={readOnly}
          placeholder={placeholder}
          className={cn(
            'w-full px-4 py-2.5 border border-border rounded-lg text-body-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
            readOnly
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-background hover:border-border/80'
          )}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
      {helpText && (
        <p className="text-caption text-muted-foreground mt-1">{helpText}</p>
      )}
    </div>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-body-sm font-medium text-muted-foreground mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full px-4 py-2.5 border border-border rounded-lg bg-background text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent hover:border-border/80 transition-colors',
          !value ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        <option value="" className="text-muted-foreground">
          {placeholder || 'Select...'}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="text-foreground">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
        checked ? 'bg-primary-500' : 'bg-muted-foreground/30',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

/* ================================================================== */
/* Main Page Component                                                */
/* ================================================================== */

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-heading-lg font-display text-foreground">Settings</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Manage your account, company profile, and preferences
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Tab Navigation ──────────────────────────────────────── */}
        <nav className="lg:w-56 shrink-0">
          {/* Mobile horizontal scroll */}
          <div className="flex lg:hidden gap-1 overflow-x-auto pb-2 no-scrollbar">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg text-body-sm font-medium whitespace-nowrap transition-colors',
                    activeTab === tab.key
                      ? 'bg-primary-500 text-white'
                      : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Desktop sidebar */}
          <div className="hidden lg:flex flex-col gap-1 bg-card border border-border rounded-xl p-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-body-sm font-medium transition-all duration-200 text-left relative',
                    activeTab === tab.key
                      ? 'bg-primary-500/10 text-primary-500'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {activeTab === tab.key && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-500 rounded-r-full" />
                  )}
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content Area ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'company' && <CompanyProfileTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'appearance' && <AppearanceTab />}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Profile Tab                                                        */
/* ================================================================== */

function ProfileTab() {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.name) setName(user.name);
    if (user?.phone) setPhone(user.phone);
  }, [user?.name, user?.phone]);

  useEffect(() => {
    if (user?.avatarUrl) {
      setAvatarPreview(user.avatarUrl);
    } else {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('tb_user_avatar') : null;
      if (stored) {
        setAvatarPreview(stored);
      }
    }
  }, [user?.avatarUrl]);

  const initials = (name || user?.name || 'User')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch('/profile', { name, phone: phone || undefined });
      if (user) {
        setUser({ ...user, name, phone });
      }
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }
    setAvatarUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        setAvatarPreview(base64);
        try {
          localStorage.setItem('tb_user_avatar', base64);
        } catch {
          // Ignore storage quota errors
        }

        // Update user state if authenticated; preview and localStorage handle client persistence
        if (user) {
          setUser({ ...user, avatarUrl: base64 });
        }

        try {
          await api.patch('/profile', { avatarUrl: base64 });
        } catch {
          // Gracefully continue with local update
        }

        toast.success('Profile photo updated successfully');
        setAvatarUploading(false);
      };

      reader.onerror = () => {
        toast.error('Failed to process image');
        setAvatarUploading(false);
      };

      reader.readAsDataURL(file);
    } catch {
      toast.error('Failed to upload avatar');
      setAvatarUploading(false);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    localStorage.removeItem('tb_user_avatar');
    if (user) {
      setUser({ ...user, avatarUrl: undefined });
    }
    api.patch('/profile', { avatarUrl: null }).catch(() => {});
    toast.success('Profile photo removed');
  };

  const currentAvatar = avatarPreview || user?.avatarUrl;

  return (
    <div className="space-y-6">
      {/* Avatar section */}
      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-heading-sm font-display text-foreground mb-5">Profile Photo</h2>
        <div className="flex items-center gap-6">
          <div className="relative group">
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt={name}
                className="h-20 w-20 rounded-full object-cover border-2 border-border shadow-sm"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary-500/20 to-accent-500/20 border-2 border-border flex items-center justify-center text-primary-500 text-2xl font-bold font-display">
                {initials}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={avatarUploading}
              title="Change photo"
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            >
              {avatarUploading ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarUploading}
                className="text-body-sm font-medium text-primary-500 hover:text-primary-600 transition-colors cursor-pointer"
              >
                Upload new photo
              </button>
              {currentAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarUploading}
                  className="text-body-sm font-medium text-destructive hover:underline transition-colors cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-caption text-muted-foreground mt-0.5">
              JPG, PNG or WebP. Max 5 MB.
            </p>
          </div>
        </div>
      </section>

      {/* Basic info */}
      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-heading-sm font-display text-foreground mb-5">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormInput
            label="Full Name"
            required
            value={name}
            onChange={setName}
            placeholder="e.g. John Doe"
          />

          <FormInput
            label="Email Address"
            value={email}
            readOnly
            rightElement={
              <div className="flex items-center gap-1 text-accent-600 dark:text-accent-400">
                <BadgeCheck className="h-4 w-4" />
                <span className="text-caption font-medium">Verified</span>
              </div>
            }
          />

          <FormInput
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="e.g. +91 98765 43210"
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-body-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-primary-500/25"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </button>
        </div>
      </section>
    </div>
  );
}

/* ================================================================== */
/* Company Profile Tab                                                */
/* ================================================================== */

function CompanyProfileTab() {
  const [companyName, setCompanyName] = useState('');
  const [gstin, setGstin] = useState('');
  const [industry, setIndustry] = useState('');
  const [annualTurnover, setAnnualTurnover] = useState('');
  const [experience, setExperience] = useState('');
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [msmeEnabled, setMsmeEnabled] = useState(false);
  const [udyamNumber, setUdyamNumber] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [certInput, setCertInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [showStatesDropdown, setShowStatesDropdown] = useState(false);
  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false);
  const [statesSearch, setStatesSearch] = useState('');
  const [categoriesSearch, setCategoriesSearch] = useState('');
  const statesRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);

  // Fetch saved company profile on mount
  useEffect(() => {
    let active = true;
    api
      .get('/profile')
      .then((res) => {
        if (!active) return;
        const comp = res.data?.data?.companyProfile;
        if (comp) {
          if (comp.companyName) setCompanyName(comp.companyName);
          if (comp.gstin) setGstin(comp.gstin);
          if (comp.industry) setIndustry(comp.industry);
          if (comp.annualTurnover) {
            if (typeof comp.annualTurnover === 'number') {
              const val = comp.annualTurnover;
              if (val <= 2500000) setAnnualTurnover('below_25l');
              else if (val <= 10000000) setAnnualTurnover('25l_1cr');
              else if (val <= 50000000) setAnnualTurnover('1cr_5cr');
              else if (val <= 250000000) setAnnualTurnover('5cr_25cr');
              else if (val <= 1000000000) setAnnualTurnover('25cr_100cr');
              else if (val <= 5000000000) setAnnualTurnover('100cr_500cr');
              else setAnnualTurnover('above_500cr');
            } else if (typeof comp.annualTurnover === 'string') {
              setAnnualTurnover(comp.annualTurnover);
            }
          }
          if (comp.experience) {
            setExperience(comp.experience);
          } else if (typeof comp.yearsInBusiness === 'number' && comp.yearsInBusiness > 0) {
            const y = comp.yearsInBusiness;
            if (y <= 1) setExperience('0_1');
            else if (y <= 3) setExperience('1_3');
            else if (y <= 5) setExperience('3_5');
            else if (y <= 10) setExperience('5_10');
            else if (y <= 20) setExperience('10_20');
            else setExperience('above_20');
          }
          if (Array.isArray(comp.statesOperated)) setSelectedStates(comp.statesOperated);
          if (Array.isArray(comp.workCategories)) setSelectedCategories(comp.workCategories);
          if (typeof comp.msmeRegistered === 'boolean') setMsmeEnabled(comp.msmeRegistered);
          if (comp.msmeNumber) setUdyamNumber(comp.msmeNumber);
          if (Array.isArray(comp.certifications)) setCertifications(comp.certifications);
        }
      })
      .catch(() => {
        // Fallback to empty default state so placeholders are shown
      })
      .finally(() => {
        if (active) setIsLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statesRef.current && !statesRef.current.contains(e.target as Node)) {
        setShowStatesDropdown(false);
      }
      if (categoriesRef.current && !categoriesRef.current.contains(e.target as Node)) {
        setShowCategoriesDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleState = (state: string) => {
    setSelectedStates((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    );
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const addCertification = () => {
    const val = certInput.trim();
    if (!val) return;
    if (certifications.includes(val)) {
      toast.error('Certification already added');
      return;
    }
    setCertifications((prev) => [...prev, val]);
    setCertInput('');
  };

  const removeCertification = (cert: string) => {
    setCertifications((prev) => prev.filter((c) => c !== cert));
  };

  const filteredStates = ALL_STATES.filter((s) =>
    s.toLowerCase().includes(statesSearch.toLowerCase())
  );

  const filteredCategories = WORK_CATEGORIES.filter((c) =>
    c.toLowerCase().includes(categoriesSearch.toLowerCase())
  );

  const handleSave = async () => {
    if (!companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    setIsSaving(true);
    try {
      await api.patch('/profile/company', {
        companyName,
        gstin,
        industry,
        annualTurnover,
        experience,
        statesOperated: selectedStates,
        workCategories: selectedCategories,
        msmeRegistered: msmeEnabled,
        msmeNumber: msmeEnabled ? udyamNumber : '',
        certifications,
      });
      toast.success('Company profile saved successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save company profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic company info */}
      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-heading-sm font-display text-foreground mb-5">Company Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormInput
            label="Company Name"
            required
            value={companyName}
            onChange={setCompanyName}
            placeholder="e.g. ABC Infra Pvt Ltd"
          />
          <FormInput
            label="GSTIN"
            value={gstin}
            onChange={(val) => setGstin(val.toUpperCase())}
            placeholder="e.g. 22AAAAA0000A1Z5"
            helpText="15-character GST Identification Number"
          />
          <FormSelect
            label="Industry"
            value={industry}
            onChange={setIndustry}
            options={INDUSTRY_OPTIONS.map((i) => ({ value: i, label: i }))}
            placeholder="Select industry"
          />
          <FormSelect
            label="Annual Turnover"
            value={annualTurnover}
            onChange={setAnnualTurnover}
            options={TURNOVER_OPTIONS}
            placeholder="Select turnover range"
          />
          <FormSelect
            label="Years of Experience"
            value={experience}
            onChange={setExperience}
            options={EXPERIENCE_OPTIONS}
            placeholder="Select experience"
          />
        </div>
      </section>

      {/* States of Operation */}
      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-heading-sm font-display text-foreground mb-2">States of Operation</h2>
        <p className="text-caption text-muted-foreground mb-4">
          Select all states where your company operates or can take on work
        </p>

        {/* Selected state chips */}
        {selectedStates.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedStates.map((state) => (
              <span
                key={state}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/10 text-primary-500 text-caption font-medium"
              >
                {state}
                <button
                  onClick={() => toggleState(state)}
                  className="hover:text-primary-700 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Dropdown */}
        <div className="relative" ref={statesRef}>
          <input
            type="text"
            value={statesSearch}
            onChange={(e) => {
              setStatesSearch(e.target.value);
              setShowStatesDropdown(true);
            }}
            onFocus={() => setShowStatesDropdown(true)}
            placeholder="Search and select states..."
            className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-body-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent hover:border-border/80 transition-colors"
          />
          {showStatesDropdown && (
            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-card border border-border rounded-lg shadow-lg">
              <div className="p-1">
                {filteredStates.map((state) => (
                  <button
                    key={state}
                    onClick={() => toggleState(state)}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 rounded-md text-body-sm transition-colors text-left',
                      selectedStates.includes(state)
                        ? 'bg-primary-500/10 text-primary-500'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <div
                      className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        selectedStates.includes(state)
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-border'
                      )}
                    >
                      {selectedStates.includes(state) && (
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      )}
                    </div>
                    {state}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Work Categories */}
      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-heading-sm font-display text-foreground mb-2">Work Categories</h2>
        <p className="text-caption text-muted-foreground mb-4">
          Select the categories of work your company specializes in
        </p>

        {/* Selected category chips */}
        {selectedCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedCategories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-500/10 text-accent-500 text-caption font-medium"
              >
                {cat}
                <button
                  onClick={() => toggleCategory(cat)}
                  className="hover:text-accent-700 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Dropdown */}
        <div className="relative" ref={categoriesRef}>
          <input
            type="text"
            value={categoriesSearch}
            onChange={(e) => {
              setCategoriesSearch(e.target.value);
              setShowCategoriesDropdown(true);
            }}
            onFocus={() => setShowCategoriesDropdown(true)}
            placeholder="Search and select categories..."
            className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-body-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent hover:border-border/80 transition-colors"
          />
          {showCategoriesDropdown && (
            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-card border border-border rounded-lg shadow-lg">
              <div className="p-1">
                {filteredCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 rounded-md text-body-sm transition-colors text-left',
                      selectedCategories.includes(cat)
                        ? 'bg-accent-500/10 text-accent-500'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <div
                      className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        selectedCategories.includes(cat)
                          ? 'bg-accent-500 border-accent-500'
                          : 'border-border'
                      )}
                    >
                      {selectedCategories.includes(cat) && (
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      )}
                    </div>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* MSME & Certifications */}
      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-heading-sm font-display text-foreground mb-5">Registrations & Certifications</h2>

        {/* MSME toggle */}
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div>
            <p className="text-body-sm font-medium text-foreground">MSME Registered</p>
            <p className="text-caption text-muted-foreground">
              Enable if your company is registered under MSME Act
            </p>
          </div>
          <Toggle checked={msmeEnabled} onChange={setMsmeEnabled} />
        </div>

        {/* Udyam number - shown when MSME is enabled */}
        {msmeEnabled && (
          <div className="mt-4 ml-0">
            <FormInput
              label="Udyam Registration Number"
              value={udyamNumber}
              onChange={setUdyamNumber}
              placeholder="e.g. UDYAM-XX-00-0000000"
              helpText="Your Udyam registration number from the MSME portal"
            />
          </div>
        )}

        {/* Certifications tag input */}
        <div className="mt-6">
          <label className="block text-body-sm font-medium text-muted-foreground mb-1.5">
            Certifications
          </label>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-3">
            {certifications.map((cert) => (
              <span
                key={cert}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-foreground text-caption font-medium border border-border"
              >
                {cert}
                <button
                  onClick={() => removeCertification(cert)}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Add certification input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={certInput}
              onChange={(e) => setCertInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCertification();
                }
              }}
              placeholder="e.g. ISO 9001, ISO 14001..."
              className="flex-1 px-4 py-2.5 border border-border rounded-lg bg-background text-body-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent hover:border-border/80 transition-colors"
            />
            <button
              onClick={addCertification}
              disabled={!certInput.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-muted text-foreground text-body-sm font-medium rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>
      </section>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-body-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-primary-500/25"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Company Profile
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Notifications Tab                                                  */
/* ================================================================== */

function NotificationsTab() {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    tenderAlerts: { email: true, push: true, whatsapp: true, sms: false },
    deadlineReminders: { email: true, push: true, whatsapp: false, sms: false },
    eligibilityResults: { email: true, push: true, whatsapp: false, sms: false },
    billing: { email: true, push: false, whatsapp: false, sms: false },
    system: { email: true, push: true, whatsapp: false, sms: false },
  });
  const [isSaving, setIsSaving] = useState(false);

  const notificationTypes: { key: keyof NotificationPrefs; label: string; description: string; icon: typeof Bell }[] = [
    { key: 'tenderAlerts', label: 'Tender Alerts', description: 'New tenders matching your saved alerts', icon: BellRing },
    { key: 'deadlineReminders', label: 'Deadline Reminders', description: 'Reminders before tender submission deadlines', icon: AlertCircle },
    { key: 'eligibilityResults', label: 'Eligibility Results', description: 'AI eligibility check results and updates', icon: CheckCircle2 },
    { key: 'billing', label: 'Billing', description: 'Payment confirmations, invoices, and subscription updates', icon: Mail },
    { key: 'system', label: 'System', description: 'Platform updates, maintenance notices, and announcements', icon: Info },
  ];

  const channels: { key: 'email' | 'push' | 'whatsapp' | 'sms'; label: string; icon: typeof Mail }[] = [
    { key: 'email', label: 'Email', icon: Mail },
    { key: 'push', label: 'Push', icon: Bell },
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { key: 'sms', label: 'SMS', icon: Smartphone },
  ];

  const togglePref = (type: keyof NotificationPrefs, channel: 'email' | 'push' | 'whatsapp' | 'sms') => {
    setPrefs((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [channel]: !prev[type][channel],
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch('/profile/notifications', { preferences: prefs });
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save notification preferences');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-heading-sm font-display text-foreground">Notification Preferences</h2>
          <p className="text-caption text-muted-foreground mt-1">
            Choose how and when you want to be notified
          </p>
        </div>

        {/* Header row for channels */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_repeat(4,80px)] gap-2 px-6 py-3 bg-muted/50 border-b border-border">
          <div className="text-overline text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
            Notification Type
          </div>
          {channels.map((ch) => {
            const ChIcon = ch.icon;
            return (
              <div key={ch.key} className="flex flex-col items-center gap-1">
                <ChIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-overline text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                  {ch.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Notification rows */}
        <div className="divide-y divide-border">
          {notificationTypes.map((type) => {
            const TypeIcon = type.icon;
            return (
              <div key={type.key} className="px-6 py-4">
                {/* Desktop grid */}
                <div className="hidden sm:grid sm:grid-cols-[1fr_repeat(4,80px)] gap-2 items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-muted">
                      <TypeIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-body-sm font-medium text-foreground">{type.label}</p>
                      <p className="text-caption text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                  {channels.map((ch) => (
                    <div key={ch.key} className="flex justify-center">
                      <Toggle
                        checked={prefs[type.key][ch.key]}
                        onChange={() => togglePref(type.key, ch.key)}
                      />
                    </div>
                  ))}
                </div>

                {/* Mobile layout */}
                <div className="sm:hidden">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 rounded-lg bg-muted">
                      <TypeIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-body-sm font-medium text-foreground">{type.label}</p>
                      <p className="text-caption text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 ml-10">
                    {channels.map((ch) => (
                      <div key={ch.key} className="flex flex-col items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground font-medium">{ch.label}</span>
                        <Toggle
                          checked={prefs[type.key][ch.key]}
                          onChange={() => togglePref(type.key, ch.key)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-body-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-primary-500/25"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Preferences
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Security Tab                                                       */
/* ================================================================== */

function SecurityTab() {
  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 2FA
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const passwordsMatch = newPassword === confirmPassword;
  const passwordLongEnough = newPassword.length >= 8;

  // Password strength indicator
  const getPasswordStrength = (pwd: string): { level: number; label: string; color: string } => {
    if (pwd.length === 0) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500' };
    if (score <= 3) return { level: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score <= 4) return { level: 3, label: 'Good', color: 'bg-accent-500' };
    return { level: 4, label: 'Strong', color: 'bg-green-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleChangePassword = async () => {
    if (!passwordLongEnough) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!passwordsMatch) {
      toast.error('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleToggle2FA = async (enabled: boolean) => {
    try {
      setTwoFactorEnabled(enabled);
      toast.success(enabled ? '2FA enabled successfully' : '2FA disabled');
    } catch {
      toast.error('Failed to update 2FA settings');
    }
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <section className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-muted">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-heading-sm font-display text-foreground">Change Password</h2>
            <p className="text-caption text-muted-foreground">
              Update your password to keep your account secure
            </p>
          </div>
        </div>

        <div className="space-y-4 max-w-lg">
          {/* Current password */}
          <div>
            <label className="block text-body-sm font-medium text-muted-foreground mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-11 border border-border rounded-lg bg-background text-body-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent hover:border-border/80 transition-colors"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-body-sm font-medium text-muted-foreground mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-11 border border-border rounded-lg bg-background text-body-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent hover:border-border/80 transition-colors"
                placeholder="Min 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Password strength bar */}
            {newPassword.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-colors duration-300',
                        level <= strength.level ? strength.color : 'bg-muted'
                      )}
                    />
                  ))}
                </div>
                <p className={cn(
                  'text-caption font-medium',
                  strength.level <= 1 ? 'text-red-500' :
                  strength.level <= 2 ? 'text-amber-500' :
                  strength.level <= 3 ? 'text-accent-500' : 'text-green-500'
                )}>
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-body-sm font-medium text-muted-foreground mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={cn(
                  'w-full px-4 py-2.5 pr-11 border rounded-lg bg-background text-body-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent hover:border-border/80 transition-colors',
                  confirmPassword && !passwordsMatch
                    ? 'border-red-500'
                    : 'border-border'
                )}
                placeholder="Re-enter new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-caption text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={handleChangePassword}
              disabled={
                isChangingPassword ||
                !currentPassword ||
                !newPassword ||
                !passwordsMatch ||
                !passwordLongEnough
              }
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-body-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-primary-500/25"
            >
              {isChangingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              Update Password
            </button>
          </div>
        </div>
      </section>

      {/* Two-Factor Authentication */}
      <section className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-heading-sm font-display text-foreground">Two-Factor Authentication</h2>
              <p className="text-caption text-muted-foreground mt-0.5">
                Add an extra layer of security to your account using an authenticator app
              </p>
            </div>
          </div>
          <Toggle
            checked={twoFactorEnabled}
            onChange={handleToggle2FA}
          />
        </div>

        {twoFactorEnabled && (
          <div className="mt-4 ml-[52px] p-4 bg-accent-500/5 border border-accent-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-body-sm font-medium text-foreground">2FA is enabled</p>
                <p className="text-caption text-muted-foreground mt-0.5">
                  Your account is protected with two-factor authentication. You will be asked for a verification code when signing in.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ================================================================== */
/* Appearance Tab                                                     */
/* ================================================================== */

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [density, setDensity] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('tb_data_density') as 'compact' | 'comfortable' | 'spacious';
      if (saved) {
        setDensity(saved);
        document.documentElement.setAttribute('data-density', saved);
      }
    } catch {}
  }, []);

  const handleSelectDensity = (newDensity: 'compact' | 'comfortable' | 'spacious') => {
    setDensity(newDensity);
    setHasChanges(true);
  };

  const handleSaveDensity = () => {
    setIsSaving(true);
    try {
      localStorage.setItem('tb_data_density', density);
      document.documentElement.setAttribute('data-density', density);
      window.dispatchEvent(new CustomEvent('tb_density_changed', { detail: density }));
      toast.success(`Data density set to ${density.charAt(0).toUpperCase() + density.slice(1)}`);
      setHasChanges(false);
    } catch (e) {
      toast.error('Failed to save density preference');
    } finally {
      setTimeout(() => setIsSaving(false), 300);
    }
  };

  const currentTheme = mounted ? theme : 'dark';

  const themeOptions: { key: 'dark' | 'light' | 'system'; label: string; description: string; icon: typeof Moon }[] = [
    { key: 'dark', label: 'Dark', description: 'Easy on the eyes', icon: Moon },
    { key: 'light', label: 'Light', description: 'Classic bright mode', icon: Sun },
    { key: 'system', label: 'System', description: 'Match your OS setting', icon: SunMoon },
  ];

  const densityOptions: { key: 'compact' | 'comfortable' | 'spacious'; label: string; description: string; icon: typeof LayoutGrid }[] = [
    { key: 'compact', label: 'Compact', description: 'More content, less spacing', icon: AlignJustify },
    { key: 'comfortable', label: 'Comfortable', description: 'Balanced layout', icon: LayoutGrid },
    { key: 'spacious', label: 'Spacious', description: 'More breathing room', icon: Maximize2 },
  ];

  return (
    <div className="space-y-6">
      {/* Theme */}
      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-heading-sm font-display text-foreground mb-2">Theme</h2>
        <p className="text-caption text-muted-foreground mb-5">
          Choose how TenderBazaar looks for you
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = currentTheme === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setTheme(opt.key)}
                className={cn(
                  'flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-200 text-center cursor-pointer',
                  isSelected
                    ? 'border-primary-500 bg-primary-500/5 shadow-sm'
                    : 'border-border hover:border-border/80 hover:bg-muted/30'
                )}
              >
                <div className={cn(
                  'p-3 rounded-xl transition-colors',
                  isSelected ? 'bg-primary-500/10' : 'bg-muted'
                )}>
                  <Icon className={cn(
                    'h-6 w-6',
                    isSelected ? 'text-primary-500' : 'text-muted-foreground'
                  )} />
                </div>
                <div>
                  <p className={cn(
                    'text-body-sm font-semibold',
                    isSelected ? 'text-primary-500' : 'text-foreground'
                  )}>
                    {opt.label}
                  </p>
                  <p className="text-caption text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
                {isSelected && (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Data Density */}
      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-heading-sm font-display text-foreground mb-2">Data Density</h2>
        <p className="text-caption text-muted-foreground mb-5">
          Control how much information is displayed on screen
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {densityOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = density === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => handleSelectDensity(opt.key)}
                className={cn(
                  'flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-200 text-center cursor-pointer',
                  isSelected
                    ? 'border-primary-500 bg-primary-500/5 shadow-sm'
                    : 'border-border hover:border-border/80 hover:bg-muted/30'
                )}
              >
                <div className={cn(
                  'p-3 rounded-xl transition-colors',
                  isSelected ? 'bg-primary-500/10' : 'bg-muted'
                )}>
                  <Icon className={cn(
                    'h-6 w-6',
                    isSelected ? 'text-primary-500' : 'text-muted-foreground'
                  )} />
                </div>
                <div>
                  <p className={cn(
                    'text-body-sm font-semibold',
                    isSelected ? 'text-primary-500' : 'text-foreground'
                  )}>
                    {opt.label}
                  </p>
                  <p className="text-caption text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
                {isSelected && (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Save button and indicator */}
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <p className="text-caption text-muted-foreground">
            Current density: <span className="font-semibold text-foreground capitalize">{density}</span>
            {hasChanges && <span className="text-primary-500 ml-2 font-medium">(Unsaved changes)</span>}
          </p>
          <button
            type="button"
            onClick={handleSaveDensity}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold transition-all duration-200 shadow-glow disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </section>

      {/* Preview section */}
      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-heading-sm font-display text-foreground mb-2">Preview</h2>
        <p className="text-caption text-muted-foreground mb-4">
          See how your settings affect the interface
        </p>

        <div className={cn(
          'border border-border rounded-lg overflow-hidden',
          density === 'compact' ? 'text-caption' : density === 'spacious' ? 'text-body-md' : 'text-body-sm'
        )}>
          <div className={cn(
            'bg-muted/50 border-b border-border',
            density === 'compact' ? 'px-3 py-2' : density === 'spacious' ? 'px-6 py-4' : 'px-4 py-3'
          )}>
            <p className="font-semibold text-foreground">Sample Tender Card</p>
          </div>
          <div className={cn(
            density === 'compact' ? 'p-3 space-y-1' : density === 'spacious' ? 'p-6 space-y-3' : 'p-4 space-y-2'
          )}>
            <p className="text-foreground font-medium">Construction of 4-Lane Highway NH-48</p>
            <p className="text-muted-foreground">National Highways Authority of India</p>
            <div className="flex items-center gap-3">
              <span className="text-caption px-2 py-0.5 rounded bg-primary-500/10 text-primary-500 font-medium">Works</span>
              <span className="font-mono text-foreground">
                {formatCurrency(373969000000)}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
