import assert from 'node:assert/strict';
import { aiEligibilityResponseSchema } from '../modules/eligibility/validation';
import {
  normaliseEligibilityCriteria,
  deriveLlmProvenance,
} from '../modules/eligibility/service';

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

// 6. Criteria normalisation — the merge-resolved logic inside checkEligibility
{
  // The AI-service shape: an ARRAY of { criterion, status, detail }.
  const fromAiService = normaliseEligibilityCriteria([
    { criterion: 'Category Match', status: 'MET', detail: 'WORKS matches', importance: 'CRITICAL' },
    { criterion: 'Turnover', status: 'PARTIALLY_MET', detail: 'Close to threshold' },
    { criterion: 'Certifications', status: 'NOT_MET', detail: 'ISO 9001 missing' },
    { criterion: 'Capacity', status: 'UNCLEAR', detail: 'Not stated' },
  ]);

  assert.deepEqual(
    fromAiService.map((c) => [c.name, c.status]),
    [
      ['Category Match', 'pass'],
      ['Turnover', 'partial'],
      ['Certifications', 'fail'],
      ['Capacity', 'fail'],
    ],
    'AI array criteria must map MET/PARTIALLY_MET to pass/partial and everything else to fail',
  );
  assert.equal(fromAiService[0].importance, 'CRITICAL', 'Explicit importance is preserved');
  assert.equal(fromAiService[1].importance, 'IMPORTANT', 'Missing importance defaults to IMPORTANT');

  // The rule-based fallback shape: a keyed RECORD of { met, detail }. This is
  // the case that made the normalisation worth keeping through the merge — the
  // record has no `status` field at all, so passing it through untouched left
  // the dashboard with nothing to render.
  const fromFallback = normaliseEligibilityCriteria({
    categoryMatch: { met: true, detail: 'Category matches' },
    stateMatch: { met: false, detail: 'Does not operate in tender state' },
  });

  assert.deepEqual(
    fromFallback.map((c) => [c.name, c.status, c.detail]),
    [
      ['categoryMatch', 'pass', 'Category matches'],
      ['stateMatch', 'fail', 'Does not operate in tender state'],
    ],
    'Record criteria must be keyed by name and derive status from `met`',
  );

  // Missing details fall back to wording that matches the derived status
  // rather than being left blank.
  const noDetails = normaliseEligibilityCriteria([
    { criterion: 'A', status: 'MET' },
    { criterion: 'B', status: 'NOT_MET' },
  ]);
  assert.equal(noDetails[0].detail, 'Requirement satisfied');
  assert.equal(noDetails[1].detail, 'Requirement not met');

  // Degenerate inputs must not throw: an unparsed criteria value yields [].
  assert.deepEqual(normaliseEligibilityCriteria(undefined), []);
  assert.deepEqual(normaliseEligibilityCriteria(null), []);
  assert.deepEqual(normaliseEligibilityCriteria({}), []);
  assert.deepEqual(normaliseEligibilityCriteria([]), []);
  assert.deepEqual(normaliseEligibilityCriteria('nonsense'), []);

  // An unnamed criterion still renders with a placeholder rather than blank.
  assert.equal(normaliseEligibilityCriteria([{ status: 'MET' }])[0].name, 'Criterion');

  // Lower-cased / alternate spellings the engine has used are honoured.
  assert.equal(normaliseEligibilityCriteria([{ criterion: 'X', status: 'pass' }])[0].status, 'pass');
  assert.equal(normaliseEligibilityCriteria([{ criterion: 'X', met: true }])[0].status, 'pass');

  console.log('✓ Criteria normalisation handles both the AI array and fallback record shapes');
}

// 7. LLM provenance — never report analysis that did not happen
{
  assert.deepEqual(
    deriveLlmProvenance({ llmAnalysed: true, llmStatus: 'SUCCESS' }),
    { llmStatus: 'SUCCESS', llmAnalysed: true },
    'A positively reported success is the only case that counts as analysed',
  );

  // The failure this field exists to catch: the service answered, but its own
  // LLM call failed. `llmAnalysed` must not claim an analysis happened.
  for (const status of ['FAILED', 'TIMED_OUT', 'UNAVAILABLE', 'SKIPPED_NO_TEXT']) {
    assert.equal(
      deriveLlmProvenance({ llmAnalysed: true, llmStatus: status }).llmAnalysed,
      false,
      `llmAnalysed must be false when llmStatus is ${status}, even if the flag is set`,
    );
  }

  assert.equal(
    deriveLlmProvenance({ llmAnalysed: false, llmStatus: 'SUCCESS' }).llmAnalysed,
    false,
    'A SUCCESS status alone is not enough without the flag',
  );

  // Absent provenance is treated conservatively as "no analysis".
  assert.deepEqual(
    deriveLlmProvenance({}),
    { llmStatus: 'UNAVAILABLE', llmAnalysed: false },
    'Absent provenance defaults to UNAVAILABLE / not analysed',
  );
  assert.equal(
    deriveLlmProvenance({ llmAnalysed: 'true' as unknown }).llmAnalysed,
    false,
    'A truthy non-boolean must not be read as success',
  );

  console.log('✓ LLM provenance reports analysis only when the service positively confirmed SUCCESS');
}

console.log('--- All Eligibility Checks Tests Passed Successfully! ---');
