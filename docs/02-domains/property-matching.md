# Property Matching Domain

## Canonical terminology

- **PropertyInterest**: business intent represented by the stored matching preference.
- **Preference**: normalized criteria used by the matching engine.
- **Candidate**: a source-of-truth Property Listing projection eligible for evaluation.
- **MatchScore**: deterministic score snapshot associated with a candidate and algorithm version.
- **Recommendation**: bounded snapshot of ranked candidates for a subject.
- **Feedback**: subject response to a recommendation item; state-based and independently auditable.
- **Rule**: isolated eligibility, hard-constraint, weighted, penalty, or behavioral evaluation.

## Subject ownership

Matching supports USER, CONTACT and LEAD subjects without introducing a customer aggregate. USER is self-scoped. CONTACT and LEAD access is resolved through existing CRM ownership/authorization semantics.

## Preference invariants

Preference references use existing Listing transaction semantics. Budget requires compatible currency and price frequency; ranges must satisfy min <= max. Location UUIDs are validated and coordinate pairs are atomic. Hard criteria are rejected when their required values are absent.

## Rule semantics

Hard constraints are evaluated before score calculation. A candidate that fails a hard constraint cannot be rescued by soft scoring or behavioral signals.

## Score

The initial algorithm is fixed, deterministic, normalized to 0-100 and versioned. Explanations contain safe matched/missed/penalty/contribution data. Client input may request a minimum score but cannot lower the server safety floor.

## Recommendation

Recommendations store lineage: subject, preference version, algorithm version, candidate count and generation time. Items store rank, score and a safe explanation. Current source visibility is revalidated on read.

## Feedback

Feedback is unique per recommendation item and subject. The current state can be replaced deterministically. Feedback does not silently change scoring weights or create a learning loop.

## Retention

Recommendation history is append-oriented. No automatic purge job is introduced until business retention requirements are agreed and operationally measured; this prevents accidental destruction of traceability.
