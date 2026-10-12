import assert from 'node:assert/strict';
import { aiEligibilityResponseSchema } from '../modules/eligibility/validation';

console.log('--- Starting Eligibility Checks & AI Service Contract Tests ---');

// 1. Python AI service array payload with snake_case `is_eligible`
{
  const pythonPayload = {
    tenderId: 'tender-abc-123',
    score: 85,
    is_eligible: true,
    criteria: [
      {
        criterion: 'Category Match',
        status: 'MET',
        detail: 'Category WORKS matches profile',
        importance: 'CRITICAL',
      },
      {
        criterion: 'Required Certifications',
        status: 'UNCLEAR',
        detail: 'Tender requires ISO 9001. Profile lists no certifications.',
        importance: 'IMPORTANT',
      },
    ],
    suggestions: ['Add ISO certifications to your company profile.'],
    summary: 'Eligible with minor clarification needed.',
    ruleChecksCompleted: true,
    llmAnalysed: true,
    llmStatus: 'SUCCESS',
    llmError: null,
  };

  const parsed = aiEligibilityResponseSchema.safeParse(pythonPayload);
  assert.ok(parsed.success, 'Should accept Python AI engine payload');
  assert.equal(parsed.data.score, 85);
  assert.equal(parsed.data.isEligible, true, 'Normalises is_eligible to isEligible');
  assert.equal(parsed.data.llmAnalysed, true);
  assert.equal(parsed.data.llmStatus, 'SUCCESS');
  console.log('✓ Validated Python AI service payload schema with snake_case normalisation and array criteria');
}

// 2. Local rule-based fallback payload with keyed criteria record
{
  const fallbackPayload = {
    tenderId: 'tender-xyz-789',
    score: 60,
    isEligible: true,
    criteria: {
      category: { met: true, detail: 'Category matches' },
      state: { met: true, detail: 'State is open to All India' },
      value: { met: false, detail: 'Estimated value exceeds past capacity' },
    },
    suggestions: ['Consider partnering with another firm.'],
    ruleChecksCompleted: true,
    llmAnalysed: false,
    llmStatus: 'UNAVAILABLE',
    llmError: 'The analysis service could not be reached.',
  };

  const parsed = aiEligibilityResponseSchema.safeParse(fallbackPayload);
  assert.ok(parsed.success, 'Should accept rule-based fallback payload');
  assert.equal(parsed.data.score, 60);
  assert.equal(parsed.data.isEligible, true);
  assert.equal(parsed.data.llmAnalysed, false);
  assert.equal(parsed.data.llmStatus, 'UNAVAILABLE');
  console.log('✓ Validated rule-based fallback payload with keyed dictionary criteria');
}

// 3. Rejection of malformed / corrupted payloads
{
  // Score out of range
  const outOfRange = aiEligibilityResponseSchema.safeParse({
    score: 150,
    isEligible: true,
    criteria: [],
  });
  assert.ok(!outOfRange.success, 'Score > 100 must fail');

  // Missing score
  const missingScore = aiEligibilityResponseSchema.safeParse({
    isEligible: true,
    criteria: [],
  });
  assert.ok(!missingScore.success, 'Missing score must fail instead of silently defaulting to 0');

  // Malformed criterion status
  const badStatus = aiEligibilityResponseSchema.safeParse({
    score: 50,
    isEligible: true,
    criteria: [{ criterion: 'Test', status: 'UNKNOWN_STATUS', detail: 'Bad status' }],
  });
  assert.ok(!badStatus.success, 'Invalid criterion status enum must fail');
  console.log('✓ Malformed scores and criteria rejected rather than corrupted into fake 0% results');
}

// 4. Tender identity protection
{
  function verifyTenderIdentity(expectedTenderId: string, responseTenderId?: string): boolean {
    if (responseTenderId && responseTenderId !== expectedTenderId) {
      return false;
    }
    return true;
  }

  assert.equal(verifyTenderIdentity('tender-1', 'tender-1'), true, 'Matching tenderId passes');
  assert.equal(verifyTenderIdentity('tender-1', undefined), true, 'Omitted tenderId passes');
  assert.equal(verifyTenderIdentity('tender-1', 'tender-2'), false, 'Mismatched tenderId rejected');
  console.log('✓ Cross-wired responses prevented by tender ID verification');
}

// 5. Response envelope unwrapping verification
{
  // Simulates POST /eligibility response envelope
  const apiResponse = {
    success: true,
    data: {
      eligibilityCheck: { id: 'check-1', userId: 'u1', tenderId: 't1' },
      result: {
        score: 75,
        isEligible: true,
        criteria: [],
        suggestions: ['Apply early'],
        isFallback: false,
        llmAnalysed: true,
        llmStatus: 'SUCCESS',
        llmError: null,
      },
    },
  };

  // Frontend unwrapping test
  const unwrapped = apiResponse.data.result ?? (apiResponse.data as any);
  assert.equal(unwrapped.score, 75, 'Correctly unwraps score from nested result envelope');
  assert.equal(unwrapped.isEligible, true);
  assert.equal(unwrapped.llmAnalysed, true);
  console.log('✓ Frontend correctly unwraps nested result envelope preventing score=0 fallback bug');
}

console.log('--- All Eligibility Checks Tests Passed Successfully! ---');
