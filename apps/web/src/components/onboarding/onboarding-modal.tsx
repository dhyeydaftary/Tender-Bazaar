'use client';

import { useState, useCallback, type KeyboardEvent } from 'react';
import { X, Check, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
] as const;

const ALL_STATES_AND_UTS = [
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
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

const COMPANY_TYPES = [
  'Private Limited',
  'LLP',
  'Proprietorship',
  'Partnership',
  'Society',
  'Trust',
  'Government',
] as const;

const TENDER_CATEGORIES = ['Works', 'Goods', 'Services', 'Consultancy'] as const;

const TOTAL_STEPS = 3;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OnboardingModalProps {
  onClose: () => void;
}

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [gstin, setGstin] = useState('');

  // Step 2
  const [workCategories, setWorkCategories] = useState<string[]>([]);
  const [statesOperated, setStatesOperated] = useState<string[]>([]);
  const [msmeRegistered, setMsmeRegistered] = useState(false);
  const [msmeNumber, setMsmeNumber] = useState('');

  // Step 3
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [alertCategory, setAlertCategory] = useState('');
  const [alertState, setAlertState] = useState('');

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const toggleWorkCategory = (cat: string) => {
    setWorkCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleState = (state: string) => {
    setStatesOperated((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    );
  };

  const toggleSelectAllStates = () => {
    if (statesOperated.length === ALL_STATES_AND_UTS.length) {
      setStatesOperated([]);
    } else {
      setStatesOperated([...ALL_STATES_AND_UTS]);
    }
  };

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords((prev) => [...prev, trimmed]);
    }
    setKeywordInput('');
  };

  const removeKeyword = (kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const handleKeywordKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  // ---------------------------------------------------------------------------
  // Skip / Close
  // ---------------------------------------------------------------------------

  const handleSkip = useCallback(() => {
    localStorage.setItem('onboarding_skipped', 'true');
    onClose();
  }, [onClose]);

  // ---------------------------------------------------------------------------
  // Save step data
  // ---------------------------------------------------------------------------

  const saveStep1 = async () => {
    if (!companyName.trim()) {
      toast.error('Company name is required');
      return false;
    }
    setSaving(true);
    try {
      await api.patch('/profile/company', {
        companyName: companyName.trim(),
        companyType: companyType || undefined,
        gstin: gstin.trim() || undefined,
      });
      toast.success('Company info saved');
      return true;
    } catch {
      toast.error('Failed to save company info. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveStep2 = async () => {
    setSaving(true);
    try {
      await api.patch('/profile/company', {
        workCategories,
        statesOperated,
        msmeRegistered,
        msmeNumber: msmeRegistered ? msmeNumber.trim() || undefined : undefined,
      });
      toast.success('Capabilities saved');
      return true;
    } catch {
      toast.error('Failed to save capabilities. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveStep3 = async () => {
    setSaving(true);
    try {
      await api.post('/alerts', {
        keywords,
        categories: alertCategory ? [alertCategory] : [],
        states: alertState ? [alertState] : [],
      });
      toast.success('Alert created! You will be notified for matching tenders.');
    } catch {
      // Silently skip if the endpoint doesn't exist yet
    } finally {
      setSaving(false);
    }
    return true;
  };

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const handleNext = async () => {
    if (step === 1) {
      const ok = await saveStep1();
      if (ok) setStep(2);
    } else if (step === 2) {
      const ok = await saveStep2();
      if (ok) setStep(3);
    } else if (step === 3) {
      await saveStep3();
      localStorage.setItem('onboarding_completed', 'true');
      onClose();
    }
  };

  // ---------------------------------------------------------------------------
  // Step indicator
  // ---------------------------------------------------------------------------

  const StepDots = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-2.5 w-2.5 rounded-full transition-colors',
            i + 1 === step ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
          )}
        />
      ))}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render steps
  // ---------------------------------------------------------------------------

  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-foreground">Tell us about your company</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This helps us match you with relevant tenders
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Company Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="e.g. Acme Infrastructure Pvt Ltd"
          className="w-full border border-input rounded-lg px-4 py-3 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Company Type</label>
        <select
          value={companyType}
          onChange={(e) => setCompanyType(e.target.value)}
          className="w-full border border-input rounded-lg px-4 py-3 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">Select type...</option>
          {COMPANY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">GSTIN (optional)</label>
        <input
          type="text"
          value={gstin}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          placeholder="e.g. 22AAAAA0000A1Z5"
          maxLength={15}
          className="w-full border border-input rounded-lg px-4 py-3 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono"
        />
        <p className="text-xs text-muted-foreground mt-1">Format: 22AAAAA0000A1Z5</p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-foreground">Your capabilities</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select the categories and regions you work in
        </p>
      </div>

      {/* Work Categories */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Work Categories</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {WORK_CATEGORIES.map((cat) => (
            <label
              key={cat}
              className={cn(
                'flex items-center gap-2 text-sm px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                workCategories.includes(cat)
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400'
                  : 'border-input hover:border-primary-300'
              )}
            >
              <input
                type="checkbox"
                checked={workCategories.includes(cat)}
                onChange={() => toggleWorkCategory(cat)}
                className="sr-only"
              />
              <div
                className={cn(
                  'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                  workCategories.includes(cat)
                    ? 'bg-primary-500 border-primary-500'
                    : 'border-gray-300 dark:border-gray-600'
                )}
              >
                {workCategories.includes(cat) && <Check className="h-3 w-3 text-white" />}
              </div>
              <span className="truncate">{cat}</span>
            </label>
          ))}
        </div>
      </div>

      {/* States */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-foreground">States you operate in</label>
          <button
            type="button"
            onClick={toggleSelectAllStates}
            className="text-xs text-primary-500 hover:text-primary-600 font-medium"
          >
            {statesOperated.length === ALL_STATES_AND_UTS.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="max-h-48 overflow-y-auto border border-input rounded-lg p-3 space-y-1">
          {ALL_STATES_AND_UTS.map((state) => (
            <label
              key={state}
              className="flex items-center gap-2 text-sm py-1 cursor-pointer hover:text-primary-500 transition-colors"
            >
              <input
                type="checkbox"
                checked={statesOperated.includes(state)}
                onChange={() => toggleState(state)}
                className="sr-only"
              />
              <div
                className={cn(
                  'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                  statesOperated.includes(state)
                    ? 'bg-primary-500 border-primary-500'
                    : 'border-gray-300 dark:border-gray-600'
                )}
              >
                {statesOperated.includes(state) && <Check className="h-3 w-3 text-white" />}
              </div>
              <span>{state}</span>
            </label>
          ))}
        </div>
      </div>

      {/* MSME Toggle */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={msmeRegistered}
            onClick={() => setMsmeRegistered(!msmeRegistered)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
              msmeRegistered ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
            )}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform',
                msmeRegistered ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
          <span className="text-sm font-medium text-foreground">MSME Registered</span>
        </label>

        {msmeRegistered && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Udyam Registration Number
            </label>
            <input
              type="text"
              value={msmeNumber}
              onChange={(e) => setMsmeNumber(e.target.value.toUpperCase())}
              placeholder="e.g. UDYAM-XX-00-0000000"
              className="w-full border border-input rounded-lg px-4 py-3 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono"
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-5">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-foreground">Set up your first alert</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We&apos;ll notify you when matching tenders are published
        </p>
      </div>

      {/* Keywords tag input */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Keywords</label>
        <div className="border border-input rounded-lg px-3 py-2 bg-background focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent">
          <div className="flex flex-wrap gap-2 mb-2">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 px-3 py-1 rounded-full text-sm"
              >
                {kw}
                <button
                  type="button"
                  onClick={() => removeKeyword(kw)}
                  className="hover:text-primary-900 dark:hover:text-primary-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={handleKeywordKeyDown}
              placeholder="Type a keyword and press Enter"
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm py-1"
            />
            {keywordInput.trim() && (
              <button
                type="button"
                onClick={addKeyword}
                className="text-primary-500 hover:text-primary-600"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          e.g. road construction, IT services, medical supplies
        </p>
      </div>

      {/* Category select */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
        <select
          value={alertCategory}
          onChange={(e) => setAlertCategory(e.target.value)}
          className="w-full border border-input rounded-lg px-4 py-3 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">Select category...</option>
          {TENDER_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* State select */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">State</label>
        <select
          value={alertState}
          onChange={(e) => setAlertState(e.target.value)}
          className="w-full border border-input rounded-lg px-4 py-3 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">All states</option>
          {ALL_STATES_AND_UTS.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-card rounded-2xl shadow-2xl p-6 sm:p-8">
        <StepDots />

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className={cn(
              'px-6 py-2.5 rounded-lg font-medium text-white transition-colors',
              'bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed',
              'flex items-center gap-2'
            )}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {step === TOTAL_STEPS ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
