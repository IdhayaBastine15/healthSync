-- HealthSync — single Postgres instance, one schema per service.
-- Rationale: free-tier Postgres (Neon/Supabase) gives one database; schemas
-- preserve per-service data ownership so each service still only touches its
-- own tables, and this splits cleanly into separate DBs later (just point
-- DATABASE_URL at a different instance per schema — no app code changes).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE SCHEMA IF NOT EXISTS patient;
CREATE SCHEMA IF NOT EXISTS lab;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS analytics;

-- =====================================================================
-- PATIENT SCHEMA
-- =====================================================================

CREATE TABLE IF NOT EXISTS patient.users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                   VARCHAR(200) UNIQUE NOT NULL,
    password_hash           VARCHAR(200) NOT NULL,
    given_name              VARCHAR(200) NOT NULL,
    family_name             VARCHAR(200) NOT NULL,
    roles                   VARCHAR(50)[] NOT NULL DEFAULT '{}',
    department              VARCHAR(200),
    is_active               BOOLEAN DEFAULT TRUE,
    failed_login_attempts   INTEGER DEFAULT 0,
    locked_until            TIMESTAMPTZ,
    last_login              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient.patients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mrn                 VARCHAR(50) UNIQUE NOT NULL,
    fhir_resource       JSONB NOT NULL,
    given_name          VARCHAR(200) NOT NULL,
    family_name         VARCHAR(200) NOT NULL,
    date_of_birth       DATE NOT NULL,
    gender              VARCHAR(20),
    ppsn_hash           VARCHAR(64),
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          UUID REFERENCES patient.users(id),
    version             INTEGER DEFAULT 1,
    CONSTRAINT mrn_format CHECK (mrn ~ '^MRN-[0-9]{4}-[0-9]{6}$')
);

CREATE INDEX IF NOT EXISTS idx_patients_fhir ON patient.patients USING GIN (fhir_resource jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_patients_given_name_trgm ON patient.patients USING GIN (given_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_family_name_trgm ON patient.patients USING GIN (family_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_dob ON patient.patients(date_of_birth);

CREATE TABLE IF NOT EXISTS patient.medications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES patient.patients(id) ON DELETE RESTRICT,
    drug_name       VARCHAR(500) NOT NULL,
    snomed_code     VARCHAR(50),
    dose            VARCHAR(100),
    frequency       VARCHAR(100),
    route           VARCHAR(100),
    status          VARCHAR(20) NOT NULL CHECK (status IN ('active', 'stopped', 'on-hold')),
    prescribed_by   UUID REFERENCES patient.users(id),
    start_date      DATE NOT NULL,
    end_date        DATE,
    stop_reason     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medications_patient_id ON patient.medications(patient_id, status);

CREATE TABLE IF NOT EXISTS patient.allergies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES patient.patients(id) ON DELETE RESTRICT,
    substance       VARCHAR(500) NOT NULL,
    snomed_code     VARCHAR(50),
    reaction        TEXT,
    severity        VARCHAR(20) CHECK (severity IN ('mild', 'moderate', 'severe', 'life-threatening')),
    verified_by     UUID REFERENCES patient.users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient.admissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES patient.patients(id) ON DELETE RESTRICT,
    ward            VARCHAR(200) NOT NULL,
    admitted_at     TIMESTAMPTZ NOT NULL,
    discharged_at   TIMESTAMPTZ,
    reason          TEXT,
    care_team       UUID[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admissions_patient_id ON patient.admissions(patient_id, admitted_at DESC);

-- =====================================================================
-- LAB SCHEMA
-- =====================================================================

CREATE TABLE IF NOT EXISTS lab.lab_results (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL,           -- no FK: cross-service boundary
    fhir_resource        JSONB NOT NULL,
    report_code          VARCHAR(50) NOT NULL,
    report_display        VARCHAR(500),
    status                VARCHAR(20) NOT NULL CHECK (status IN ('preliminary', 'final', 'corrected', 'cancelled')),
    is_critical           BOOLEAN DEFAULT FALSE,
    acknowledged_by       UUID,
    acknowledged_at        TIMESTAMPTZ,
    acknowledge_note       TEXT,
    source_system         VARCHAR(200) NOT NULL,
    result_hash            VARCHAR(64) NOT NULL UNIQUE,
    effective_at           TIMESTAMPTZ NOT NULL,
    issued_at              TIMESTAMPTZ NOT NULL,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_results_patient_id ON lab.lab_results(patient_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_results_critical ON lab.lab_results(is_critical, acknowledged_at) WHERE is_critical = TRUE;
CREATE INDEX IF NOT EXISTS idx_lab_results_fhir ON lab.lab_results USING GIN (fhir_resource jsonb_path_ops);

CREATE TABLE IF NOT EXISTS lab.observations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id       UUID NOT NULL REFERENCES lab.lab_results(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL,
    loinc_code      VARCHAR(50) NOT NULL,
    display_name    VARCHAR(500) NOT NULL,
    value_quantity  NUMERIC,
    value_string    TEXT,
    unit            VARCHAR(50),
    reference_low   NUMERIC,
    reference_high  NUMERIC,
    interpretation  VARCHAR(20) CHECK (interpretation IN ('normal', 'low', 'high', 'critical-low', 'critical-high', 'abnormal')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_observations_patient_loinc ON lab.observations(patient_id, loinc_code, created_at DESC);

-- =====================================================================
-- AUDIT SCHEMA (append-only)
-- =====================================================================

CREATE TABLE IF NOT EXISTS audit.audit_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      VARCHAR(100) NOT NULL,
    user_id         UUID,
    user_role       VARCHAR(50),
    patient_id      UUID,
    resource_type   VARCHAR(100),
    resource_id     UUID,
    action          VARCHAR(50) NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    request_id      UUID,
    payload_hash    VARCHAR(64),
    outcome         VARCHAR(20),
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_patient_id ON audit.audit_events(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit.audit_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit.audit_events(event_type, created_at DESC);

-- Enforce immutability at the application layer; DB-level trigger belt-and-braces:
CREATE OR REPLACE FUNCTION audit.prevent_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only: % not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update ON audit.audit_events;
CREATE TRIGGER audit_events_no_update
    BEFORE UPDATE OR DELETE ON audit.audit_events
    FOR EACH ROW EXECUTE FUNCTION audit.prevent_mutation();

-- =====================================================================
-- ANALYTICS SCHEMA
-- =====================================================================

CREATE TABLE IF NOT EXISTS analytics.lab_turnaround (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id           UUID NOT NULL,
    patient_id          UUID NOT NULL,
    filed_at             TIMESTAMPTZ NOT NULL,
    acknowledged_at        TIMESTAMPTZ,
    is_critical           BOOLEAN DEFAULT FALSE,
    time_to_acknowledge_seconds INTEGER,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_turnaround_filed_at ON analytics.lab_turnaround(filed_at DESC);

CREATE TABLE IF NOT EXISTS analytics.record_access_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL,
    accessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_record_access_patient ON analytics.record_access_log(patient_id, accessed_at DESC);
