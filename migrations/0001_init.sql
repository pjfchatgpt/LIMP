-- ============================================================================
-- LIMS on Cloudflare D1 (SQLite) - baseline schema
-- Applied with:  npx wrangler d1 migrations apply lims --local   (or --remote)
--
-- Conventions
--   * All timestamps are UTC strings written by datetime('now').
--   * All dates are ISO-8601 calendar dates (YYYY-MM-DD), no time part.
--   * `sub_label` exists because real specifications and COAs carry sub-rows
--     (e.g. sieve 1.1 / 1.2, emulsion 3.1 Cream / 3.2 Free oil). It is ''
--     rather than NULL so the UNIQUE constraints behave in SQLite.
-- ============================================================================

-- ---------------------------------------------------------------- people ----
CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  name_th     TEXT,
  role        TEXT    NOT NULL CHECK (role IN ('CHEMIST', 'TM', 'LAB_MANAGER', 'SYSADMIN')),
  email       TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX ux_users_name ON users (name);

-- ------------------------------------------------------------- suppliers ----
CREATE TABLE suppliers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  address       TEXT,
  contact_name  TEXT,
  contact_email TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX ux_suppliers_name ON suppliers (name);

-- ------------------------------------------------------------- materials ----
CREATE TABLE materials (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  category      TEXT    NOT NULL CHECK (category IN ('RM', 'WIP', 'FG')),
  product_group TEXT,
  formulation   TEXT,
  unit          TEXT    NOT NULL DEFAULT 'kg',
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX ux_materials_code ON materials (code);
CREATE INDEX ix_materials_name ON materials (name);

-- -------------------------------------------------------- test parameters ----
CREATE TABLE test_parameters (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT    NOT NULL,
  name           TEXT    NOT NULL,
  name_th        TEXT,
  unit           TEXT,
  result_type    TEXT    NOT NULL CHECK (result_type IN ('NUMERIC', 'TEXT')),
  default_method TEXT,
  instrument     TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX ux_parameters_code ON test_parameters (code);

-- -------------------------------------------------------- specifications ----
CREATE TABLE specifications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id   INTEGER NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
  parameter_id  INTEGER NOT NULL REFERENCES test_parameters (id) ON DELETE RESTRICT,
  sub_label     TEXT    NOT NULL DEFAULT '',
  spec_text     TEXT    NOT NULL,
  min_value     REAL,
  max_value     REAL,
  expected_text TEXT,
  -- overrides the parameter default when a material expresses the same
  -- parameter in a different unit (e.g. AI as %w/v for liquids, %w/w for GR)
  unit          TEXT,
  method        TEXT,
  instrument    TEXT,
  tat_minutes   INTEGER,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value)
);
CREATE UNIQUE INDEX ux_specs_material_param
  ON specifications (material_id, parameter_id, sub_label);
CREATE INDEX ix_specs_material ON specifications (material_id);

-- --------------------------------------------------------------- samples ----
CREATE TABLE samples (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_code     TEXT    NOT NULL,
  material_id     INTEGER NOT NULL REFERENCES materials (id) ON DELETE RESTRICT,
  supplier_id     INTEGER REFERENCES suppliers (id) ON DELETE SET NULL,
  external_lot_no TEXT,
  quantity        REAL,
  quantity_unit   TEXT,
  sample_type     TEXT    NOT NULL DEFAULT 'RM' CHECK (sample_type IN ('RM', 'WIP', 'FG')),
  received_date   TEXT    NOT NULL,
  due_date        TEXT,
  status          TEXT    NOT NULL DEFAULT 'RECEIVED'
                  CHECK (status IN ('RECEIVED', 'IN_TESTING', 'PENDING_REVIEW',
                                    'APPROVED', 'REJECTED', 'RETEST')),
  notes           TEXT,
  created_by      TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX ux_samples_code ON samples (sample_code);
CREATE INDEX ix_samples_status ON samples (status);
CREATE INDEX ix_samples_material ON samples (material_id);
CREATE INDEX ix_samples_received ON samples (received_date);

-- ---------------------------------------------------------- test results ----
CREATE TABLE test_results (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id     INTEGER NOT NULL REFERENCES samples (id) ON DELETE CASCADE,
  parameter_id  INTEGER NOT NULL REFERENCES test_parameters (id) ON DELETE RESTRICT,
  specification_id INTEGER REFERENCES specifications (id) ON DELETE SET NULL,
  sub_label     TEXT    NOT NULL DEFAULT '',
  -- snapshot of the specification as applied at the time of analysis
  spec_text     TEXT,
  spec_min      REAL,
  spec_max      REAL,
  result_value  REAL,
  result_text   TEXT,
  unit          TEXT,
  verdict       TEXT    NOT NULL DEFAULT 'NA' CHECK (verdict IN ('PASS', 'FAIL', 'NA')),
  method        TEXT,
  instrument    TEXT,
  analysed_date TEXT,
  analyst_name  TEXT,
  remark        TEXT,
  entered_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX ux_results_sample_param
  ON test_results (sample_id, parameter_id, sub_label);
CREATE INDEX ix_results_sample ON test_results (sample_id);

-- ------------------------------------------------------------- approvals ----
CREATE TABLE approvals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id     INTEGER NOT NULL REFERENCES samples (id) ON DELETE CASCADE,
  action        TEXT    NOT NULL CHECK (action IN ('APPROVE', 'REJECT', 'RETEST')),
  decided_by    TEXT    NOT NULL,
  decided_role  TEXT,
  comment       TEXT,
  decided_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_approvals_sample ON approvals (sample_id);

-- ------------------------------------------------------------- audit log ----
CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entity     TEXT    NOT NULL,
  entity_id  INTEGER,
  action     TEXT    NOT NULL,
  actor      TEXT,
  detail     TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_audit_entity ON audit_log (entity, entity_id);

-- -------------------------------------------------------------- counters ----
-- Per-prefix running numbers used to mint internal sample IDs.
CREATE TABLE counters (
  key   TEXT    PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
