-- DOMIKNOW Multi-Criteria Property Recommendation
-- Canonical formula: MC-REC-v1.0
-- Run in the Supabase SQL editor before enabling recommendation-run reporting.

CREATE TABLE IF NOT EXISTS recommendation_runs (
    id UUID PRIMARY KEY,
    formula_version VARCHAR(40) NOT NULL,
    tenant_id UUID REFERENCES users(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    tenant_input_snapshot JSONB NOT NULL,
    active_criteria TEXT[] NOT NULL,
    raw_importance JSONB NOT NULL,
    normalized_weights JSONB NOT NULL,
    platform_priors JSONB NOT NULL,
    candidate_count INTEGER NOT NULL CHECK (candidate_count >= 0),
    eligible_count INTEGER NOT NULL CHECK (eligible_count >= 0),
    excluded_count INTEGER NOT NULL CHECK (excluded_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendation_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_run_id UUID NOT NULL REFERENCES recommendation_runs(id) ON DELETE CASCADE,
    -- Deliberately not a foreign key: the historical property identifier remains
    -- reproducible even if the mutable property record is later removed.
    property_id UUID NOT NULL,
    rank INTEGER NOT NULL CHECK (rank > 0),
    eligibility_passed BOOLEAN NOT NULL DEFAULT TRUE,
    raw_score DOUBLE PRECISION NOT NULL CHECK (raw_score >= 0 AND raw_score <= 100),
    display_score NUMERIC(5, 2) NOT NULL CHECK (display_score >= 0 AND display_score <= 100),
    criterion_scores JSONB NOT NULL,
    fallback_flags JSONB NOT NULL,
    property_input_snapshot JSONB NOT NULL,
    explanation_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (recommendation_run_id, property_id),
    UNIQUE (recommendation_run_id, rank)
);

CREATE TABLE IF NOT EXISTS recommendation_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_run_id UUID NOT NULL REFERENCES recommendation_runs(id) ON DELETE CASCADE,
    property_id UUID NOT NULL,
    reason_codes TEXT[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (recommendation_run_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_recommendation_runs_tenant_generated
    ON recommendation_runs (tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_candidates_run_rank
    ON recommendation_candidates (recommendation_run_id, rank);
CREATE INDEX IF NOT EXISTS idx_recommendation_exclusions_run
    ON recommendation_exclusions (recommendation_run_id);

ALTER TABLE recommendation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_exclusions ENABLE ROW LEVEL SECURITY;

-- Preserve the unrounded JavaScript score for deterministic ranking and replay.
-- This also upgrades installations created from an earlier draft of this file.
ALTER TABLE recommendation_candidates
    ALTER COLUMN raw_score TYPE DOUBLE PRECISION
    USING raw_score::DOUBLE PRECISION;

-- These snapshots are written and read by the trusted server service role.
-- No direct browser/anonymous table policies are intentionally created.
