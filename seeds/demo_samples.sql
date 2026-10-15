-- ============================================================================
-- OPTIONAL demo data - not part of the schema migrations.
--   npm run db:demo:local        (after npm run db:migrate:local)
--
-- Creates three samples that exercise the whole workflow:
--   FG6900001  Butachlor    RECEIVED        nothing analysed yet
--   FG6900002  Fipronil     PENDING_REVIEW  one out-of-specification result
--   FG6900003  Glyphosate   APPROVED        all pass, with an approval row
--
-- Remove them again with:
--   DELETE FROM samples WHERE sample_code LIKE 'FG690000%'
--
-- Note: results are written with one CASE-driven INSERT ... SELECT per sample.
-- D1 rejects both long UNION ALL chains ("too many terms in compound SELECT")
-- and CREATE TEMP TABLE ("not authorized"), so this is the portable form.
-- ============================================================================

INSERT INTO samples
  (sample_code, material_id, supplier_id, external_lot_no, quantity, quantity_unit,
   sample_type, received_date, status, notes, created_by, created_at, updated_at)
VALUES
  ('FG6900001',
   (SELECT id FROM materials WHERE code = 'DEMO-EC-001'),
   (SELECT id FROM suppliers WHERE name = 'Demo Supplier A Co., Ltd.'),
   '20260411', 2000, 'kg', 'FG', '2026-09-01', 'RECEIVED',
   'Consignment held for routine testing.', 'Analyst 1', '2026-09-01 02:15:00', '2026-09-01 02:15:00'),
  ('FG6900002',
   (SELECT id FROM materials WHERE code = 'DEMO-SC-001'),
   (SELECT id FROM suppliers WHERE name = 'Demo Supplier B Co., Ltd.'),
   '6904024', 1000, 'L', 'FG', '2026-09-02', 'PENDING_REVIEW',
   NULL, 'Analyst 1', '2026-09-02 03:00:00', '2026-09-02 04:20:00'),
  ('FG6900003',
   (SELECT id FROM materials WHERE code = 'DEMO-SL-002'),
   (SELECT id FROM suppliers WHERE name = 'Demo Supplier A Co., Ltd.'),
   '20260620/5', 5000, 'L', 'FG', '2026-08-28', 'APPROVED',
   NULL, 'Analyst 1', '2026-08-28 01:30:00', '2026-08-30 06:00:00');

-- Keep the minting counter ahead of the codes used above.
UPDATE counters SET value = 3 WHERE key = 'SAMPLE:FG';

-- ------------------------------------------------- FG6900002 (one failure) ----
-- Fipronil 5% w/v SC: pH 8.40 is above the 6.00 - 8.00 limit, everything else passes.
INSERT INTO test_results
  (sample_id, parameter_id, specification_id, sub_label, spec_text, spec_min, spec_max,
   result_value, result_text, unit, verdict, method, instrument, analysed_date,
   analyst_name, remark, entered_at, updated_at)
SELECT s.id, p.id, sp.id, sp.sub_label, sp.spec_text, sp.min_value, sp.max_value,
       CASE p.code
         WHEN 'PH'    THEN 8.40
         WHEN 'DEN20' THEN 1.044
         WHEN 'DEN30' THEN 1.041
         WHEN 'AI'    THEN 5.22
         WHEN 'VISC'  THEN 980
         ELSE NULL
       END,
       CASE p.code
         WHEN 'SOL' THEN 'ละลายได้ดีในน้ำ'
         ELSE NULL
       END,
       sp.unit,
       CASE p.code WHEN 'PH' THEN 'FAIL' ELSE 'PASS' END,
       sp.method, sp.instrument, '2026-09-02', 'Analyst 1',
       CASE p.code
         WHEN 'PH' THEN 'Above the upper limit, buffer re-checked before repeating.'
         ELSE NULL
       END,
       '2026-09-02 04:15:00', '2026-09-02 04:15:00'
FROM samples s
JOIN specifications sp ON sp.material_id = s.material_id
JOIN test_parameters p ON p.id = sp.parameter_id
WHERE s.sample_code = 'FG6900002'
  AND p.code IN ('PH', 'DEN20', 'DEN30', 'SOL', 'AI', 'VISC');

-- ------------------------------------------------- FG6900003 (approved) ------
-- Glyphosate 48% SL (IPA): every line within specification.
INSERT INTO test_results
  (sample_id, parameter_id, specification_id, sub_label, spec_text, spec_min, spec_max,
   result_value, result_text, unit, verdict, method, instrument, analysed_date,
   analyst_name, remark, entered_at, updated_at)
SELECT s.id, p.id, sp.id, sp.sub_label, sp.spec_text, sp.min_value, sp.max_value,
       CASE p.code
         WHEN 'PH'    THEN 5.48
         WHEN 'DEN20' THEN 1.187
         WHEN 'DEN30' THEN 1.183
         WHEN 'AI'    THEN 48.15
         WHEN 'SUSP'  THEN 0.0
         ELSE NULL
       END,
       CASE p.code
         WHEN 'SOL' THEN 'ละลายได้ดีในน้ำ'
         ELSE NULL
       END,
       sp.unit, 'PASS', sp.method, sp.instrument, '2026-08-29', 'Analyst 1', NULL,
       '2026-08-29 05:30:00', '2026-08-29 05:30:00'
FROM samples s
JOIN specifications sp ON sp.material_id = s.material_id
JOIN test_parameters p ON p.id = sp.parameter_id
WHERE s.sample_code = 'FG6900003'
  AND p.code IN ('PH', 'DEN20', 'DEN30', 'SOL', 'AI', 'SUSP');

INSERT INTO approvals (sample_id, action, decided_by, decided_role, comment, decided_at)
VALUES
  ((SELECT id FROM samples WHERE sample_code = 'FG6900003'),
   'APPROVE', 'TM 1', 'TM', 'Results verified against the specification.', '2026-08-30 03:00:00'),
  ((SELECT id FROM samples WHERE sample_code = 'FG6900003'),
   'APPROVE', 'Lab Manager 1', 'LAB_MANAGER', 'Certificate released.',
   '2026-08-30 06:00:00');

INSERT INTO audit_log (entity, entity_id, action, actor, detail, created_at)
VALUES
  ('sample', (SELECT id FROM samples WHERE sample_code = 'FG6900001'), 'CREATED', 'Analyst 1',
   'Sample FG6900001 registered with status RECEIVED (lot 20260411)', '2026-09-01 02:15:00'),
  ('sample', (SELECT id FROM samples WHERE sample_code = 'FG6900002'), 'CREATED', 'Analyst 1',
   'Sample FG6900002 registered with status RECEIVED (lot 6904024)', '2026-09-02 03:00:00'),
  ('sample', (SELECT id FROM samples WHERE sample_code = 'FG6900002'), 'RESULTS_SAVED', 'Analyst 1',
   '6 result line(s) recorded, overall FAIL, status PENDING_REVIEW', '2026-09-02 04:15:00'),
  ('sample', (SELECT id FROM samples WHERE sample_code = 'FG6900003'), 'APPROVE', 'Lab Manager 1',
   'FG6900003 set to APPROVED - Certificate released.', '2026-08-30 06:00:00');
