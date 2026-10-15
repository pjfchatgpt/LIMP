-- ============================================================================
-- Seed migration - minimal master data
--
-- The specifications below are the real limits recorded in the handover package
-- `LIMS-Form-Data.xlsx` (sheet 04_Spec_Matrix), which in turn came from
-- `1. LIMs data  for IT.xlsx` ("Product spec, Method, TAT_LAB" r5-r15) and the
-- eight issued COAs in `10-COA Template/COA-WIP/`.
--
-- Item codes prefixed DEMO- are placeholders: the source spec sheet does not
-- define an item code for these eleven products (see finding DQ-07 in
-- LIMS-Form-Data.xlsx). Replace them with your 365 item codes before go-live.
--
-- Two unresolved source conflicts are deliberately preserved here; see findings
-- DQ-08 to DQ-10:
--   * Butachlor free oil: spec sheet says "not more than 2 cc", COA LB69/233
--     says "not more than 1 ml". The spec-sheet value is seeded.
--   * Cartap pH: spec sheet 3.00-5.00, COA LB69/123 3.00-6.00.
-- ============================================================================

-- ------------------------------------------------------------- parameters ----
INSERT INTO test_parameters (code, name, name_th, unit, result_type, default_method, instrument, sort_order) VALUES
  ('CLR',   'Appearance / Colour',              'ลักษณะทางกายภาพ / สี',                    '-',     'TEXT',    'Color comparison',                              'Visual',              10),
  ('PH',    'pH (1 % dilution)',                'ความเป็น กรด - ด่าง (pH 1 % Dilution)',   '-',     'NUMERIC', 'CIPAC Method (MT 75.3), Vol. J',                'pH meter',            20),
  ('DEN20', 'Density at 20 °C',                 'ความหนาแน่น ที่ 20 °C (กรัมต่อมิลลิลิตร)', 'g/ml',  'NUMERIC', 'Density meter',                                 'Density meter',       30),
  ('DEN30', 'Density at 30 °C',                 'ความหนาแน่น ที่ 30 °C (กรัมต่อมิลลิลิตร)', 'g/ml',  'NUMERIC', 'Density meter',                                 'Density meter',       40),
  ('SOL',   'Solubility',                       'ความสามารถในการละลาย',                    '-',     'TEXT',    'CIPAC Method (MT 174), Vol. F',                 'Visual',              50),
  ('FOAM',  'Foam persistence after 1 minute',  'ความคงทนของฟองที่ 1 นาที',                'ml',    'NUMERIC', 'CIPAC Method (MT 75.3), Vol. K',                'Graduated cylinder',  60),
  ('AI',    'Active ingredient (AI)',           'ปริมาณสารออกฤทธิ์',                       '%w/v',  'NUMERIC', 'In-house method based on CIPAC',                'GC / HPLC',           70),
  ('SUSP',  'Emulsion stability in hard water', 'การคงสภาพเมื่อผสมรวมกับน้ำกระด้าง',       'ml',    'NUMERIC', 'CIPAC Method (MT 36.3), Vol. K',                'Visual',              80),
  ('VISC',  'Viscosity',                        'ความหนืด',                                'cPs',   'NUMERIC', 'Viscometer',                                    'Viscometer',          90),
  ('SIEVE', 'Sieve passage',                    'ความสามารถผ่านตะแกรงรอง',                  '%',     'NUMERIC', 'CIPAC Method (MT 167), Vol. F',                 'Sieve set',          100),
  ('MOIST', 'Moisture content',                 'ค่าความชื้น',                              '%',     'NUMERIC', 'Drying at 110 °C for 4 minutes',                'Moisture analyser',  110);

-- -------------------------------------------------------------- materials ----
INSERT INTO materials (code, name, category, product_group, formulation, unit) VALUES
  ('DEMO-EC-001', 'Butachlor 60%+6% w/v EC',        'FG', 'Herbicide',   'EC', 'L'),
  ('DEMO-EC-002', 'Cypermethrin 35% w/v EC',        'FG', 'Insecticide', 'EC', 'L'),
  ('DEMO-SL-001', 'Glufosinate ammonium 15% w/v SL','FG', 'Herbicide',   'SL', 'L'),
  ('DEMO-SL-002', 'Glyphosate 48% SL (IPA)',        'FG', 'Herbicide',   'SL', 'L'),
  ('DEMO-SC-001', 'Fipronil 5% w/v SC',             'FG', 'Insecticide', 'SC', 'L'),
  ('DEMO-GR-001', 'Temephos 1% w/w GR',             'FG', 'Insecticide', 'GR', 'kg');

-- ---------------------------------------------------------- specifications ----
-- Helper lookups keep the seed readable and independent of autoincrement order.
INSERT INTO specifications
  (material_id, parameter_id, sub_label, spec_text, min_value, max_value, expected_text, unit, method, instrument, tat_minutes)
VALUES
  -- Butachlor 60%+6% w/v EC -------------------------------------------------
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-001'),
   (SELECT id FROM test_parameters WHERE code = 'CLR'),   '',
   'ของเหลว สีน้ำตาลแดง', NULL, NULL, 'ของเหลว สีน้ำตาลแดง', '-', 'Color comparison', 'Visual', 5),
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-001'),
   (SELECT id FROM test_parameters WHERE code = 'PH'),    '',
   '5.50 - 8.50', 5.50, 8.50, NULL, '-', 'CIPAC Method (MT 75.3), Vol. J', 'pH meter', 10),
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-001'),
   (SELECT id FROM test_parameters WHERE code = 'DEN30'), '',
   '1.000 - 1.025', 1.000, 1.025, NULL, 'g/ml', 'Density meter', 'Density meter', 15),
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-001'),
   (SELECT id FROM test_parameters WHERE code = 'DEN20'), '',
   '1.010 - 1.030', 1.010, 1.030, NULL, 'g/ml', 'Density meter', 'Density meter', 15),
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-001'),
   (SELECT id FROM test_parameters WHERE code = 'SOL'),   '',
   'ละลายได้ดีในน้ำ (เขย่า 10 ครั้ง)', NULL, NULL, 'ละลายได้ดีในน้ำ', '-', 'CIPAC Method (MT 75.3), Vol. K', 'Visual', 3),
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-001'),
   (SELECT id FROM test_parameters WHERE code = 'AI'),    '',
   '57.50 - 62.50', 57.50, 62.50, NULL, '%w/v', 'CIPAC method Vol D, 1988, page 17-19', 'GC', 300),
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-001'),
   (SELECT id FROM test_parameters WHERE code = 'SUSP'),  '3.1 Cream',
   'Cream ไม่เกิน 5 ml', NULL, 5, NULL, 'ml', 'CIPAC Method (MT 36.3), Vol. K', 'Visual', 1440),
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-001'),
   (SELECT id FROM test_parameters WHERE code = 'SUSP'),  '3.2 Free oil',
   'Free oil ไม่เกิน 2 cc (COA LB69/233 states 1 ml - see DQ-10)', NULL, 2, NULL, 'ml',
   'CIPAC Method (MT 36.3), Vol. K', 'Visual', 1440),

  -- Cypermethrin 35% w/v EC ------------------------------------------------
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-002'),
   (SELECT id FROM test_parameters WHERE code = 'PH'),    '',
   '4.80 - 7.20', 4.80, 7.20, NULL, '-', 'CIPAC Method (MT 75.3), Vol. J', 'pH meter', 10),
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-002'),
   (SELECT id FROM test_parameters WHERE code = 'DEN30'), '',
   '0.960 - 1.020', 0.960, 1.020, NULL, 'g/ml', 'Density meter', 'Density meter', 15),
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-002'),
   (SELECT id FROM test_parameters WHERE code = 'DEN20'), '',
   '0.970 - 1.030', 0.970, 1.030, NULL, 'g/ml', 'Density meter', 'Density meter', 15),
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-002'),
   (SELECT id FROM test_parameters WHERE code = 'SOL'),   '',
   'ละลายได้ดีในน้ำ (เขย่า 10 ครั้ง)', NULL, NULL, 'ละลายได้ดีในน้ำ', '-', 'CIPAC Method (MT 75.3), Vol. K', 'Visual', 3),
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-002'),
   (SELECT id FROM test_parameters WHERE code = 'AI'),    '',
   '33.25 - 36.75', 33.25, 36.75, NULL, '%w/v', 'CIPAC method Vol H', 'GC', 150),
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-002'),
   (SELECT id FROM test_parameters WHERE code = 'SUSP'),  '3.1 Cream',
   'Cream ไม่เกิน 5 ml', NULL, 5, NULL, 'ml', 'CIPAC Method (MT 36.3), Vol. K', 'Visual', 1440),
  ((SELECT id FROM materials WHERE code = 'DEMO-EC-002'),
   (SELECT id FROM test_parameters WHERE code = 'SUSP'),  '3.2 Free oil',
   'Free oil ไม่เกิน 2 cc', NULL, 2, NULL, 'ml', 'CIPAC Method (MT 36.3), Vol. K', 'Visual', 1440),

  -- Glufosinate ammonium 15% w/v SL ---------------------------------------
  ((SELECT id FROM materials WHERE code = 'DEMO-SL-001'),
   (SELECT id FROM test_parameters WHERE code = 'PH'),    '',
   '5.00 - 7.00', 5.00, 7.00, NULL, '-', 'CIPAC Method (MT 75.3), Vol. J', 'pH meter', 10),
  ((SELECT id FROM materials WHERE code = 'DEMO-SL-001'),
   (SELECT id FROM test_parameters WHERE code = 'DEN30'), '',
   '1.060 - 1.080', 1.060, 1.080, NULL, 'g/ml', 'Density meter', 'Density meter', 15),
  ((SELECT id FROM materials WHERE code = 'DEMO-SL-001'),
   (SELECT id FROM test_parameters WHERE code = 'DEN20'), '',
   '1.065 - 1.085', 1.065, 1.085, NULL, 'g/ml', 'Density meter', 'Density meter', 15),
  ((SELECT id FROM materials WHERE code = 'DEMO-SL-001'),
   (SELECT id FROM test_parameters WHERE code = 'SOL'),   '',
   'ละลายได้ดีในน้ำ (เขย่า 30 ครั้ง)', NULL, NULL, 'ละลายได้ดีในน้ำ', '-', 'CIPAC Method (MT 75.3), Vol. K', 'Visual', 3),
  ((SELECT id FROM materials WHERE code = 'DEMO-SL-001'),
   (SELECT id FROM test_parameters WHERE code = 'FOAM'),  '',
   'ความคงทนของฟองที่ 1 นาที ต้องไม่เกิน 60 ml', NULL, 60, NULL, 'ml', 'CIPAC Method (MT 75.3), Vol. K', 'Graduated cylinder', 2),
  ((SELECT id FROM materials WHERE code = 'DEMO-SL-001'),
   (SELECT id FROM test_parameters WHERE code = 'AI'),    '',
   '14.10 - 15.90', 14.10, 15.90, NULL, '%w/v', 'CIPAC method Vol G', 'HPLC', 300),
  ((SELECT id FROM materials WHERE code = 'DEMO-SL-001'),
   (SELECT id FROM test_parameters WHERE code = 'VISC'),  '',
   '250 - 500 cPs', 250, 500, NULL, 'cPs', 'Viscometer', 'Viscometer', 120),

  -- Glyphosate 48% SL (IPA) ------------------------------------------------
  ((SELECT id FROM materials WHERE code = 'DEMO-SL-002'),
   (SELECT id FROM test_parameters WHERE code = 'PH'),    '',
   '5.00 - 7.00', 5.00, 7.00, NULL, '-', 'CIPAC Method (MT 75.3), Vol. J', 'pH meter', 10),
  ((SELECT id FROM materials WHERE code = 'DEMO-SL-002'),
   (SELECT id FROM test_parameters WHERE code = 'DEN30'), '',
   '1.155 - 1.220', 1.155, 1.220, NULL, 'g/ml', 'Density meter', 'Density meter', 15),
  ((SELECT id FROM materials WHERE code = 'DEMO-SL-002'),
   (SELECT id FROM test_parameters WHERE code = 'DEN20'), '',
   '1.160 - 1.230', 1.160, 1.230, NULL, 'g/ml', 'Density meter', 'Density meter', 15),
  ((SELECT id FROM materials WHERE code = 'DEMO-SL-002'),
   (SELECT id FROM test_parameters WHERE code = 'SOL'),   '',
   'ละลายได้ดีในน้ำ (เขย่า 10 ครั้ง)', NULL, NULL, 'ละลายได้ดีในน้ำ', '-', 'CIPAC Method (MT 75.3), Vol. K', 'Visual', 3),
  ((SELECT id FROM materials WHERE code = 'DEMO-SL-002'),
   (SELECT id FROM test_parameters WHERE code = 'AI'),    '',
   '45.60 - 50.40', 45.60, 50.40, NULL, '%w/v', 'CIPAC method Vol 1C', 'HPLC', 300),
  ((SELECT id FROM materials WHERE code = 'DEMO-SL-002'),
   (SELECT id FROM test_parameters WHERE code = 'SUSP'),  '3.1 Cream',
   'Cream ไม่เกิน 5 ml', NULL, 5, NULL, 'ml', 'CIPAC Method (MT 36.3), Vol. K', 'Visual', 1440),
  ((SELECT id FROM materials WHERE code = 'DEMO-SL-002'),
   (SELECT id FROM test_parameters WHERE code = 'SUSP'),  '3.2 Free oil',
   'Free oil ไม่เกิน 2 cc', NULL, 2, NULL, 'ml', 'CIPAC Method (MT 36.3), Vol. K', 'Visual', 1440),

  -- Fipronil 5% w/v SC -----------------------------------------------------
  ((SELECT id FROM materials WHERE code = 'DEMO-SC-001'),
   (SELECT id FROM test_parameters WHERE code = 'PH'),    '',
   '6.00 - 8.00', 6.00, 8.00, NULL, '-', 'CIPAC Method (MT 75.3), Vol. J', 'pH meter', 10),
  ((SELECT id FROM materials WHERE code = 'DEMO-SC-001'),
   (SELECT id FROM test_parameters WHERE code = 'DEN30'), '',
   '1.025 - 1.050', 1.025, 1.050, NULL, 'g/ml', 'Density meter', 'Density meter', 15),
  ((SELECT id FROM materials WHERE code = 'DEMO-SC-001'),
   (SELECT id FROM test_parameters WHERE code = 'DEN20'), '',
   '1.030 - 1.070 (COA LB69/126 states 1.030-1.060 - see DQ-09)', 1.030, 1.070, NULL, 'g/ml',
   'Density meter', 'Density meter', 15),
  ((SELECT id FROM materials WHERE code = 'DEMO-SC-001'),
   (SELECT id FROM test_parameters WHERE code = 'SOL'),   '',
   'ละลายได้ดีในน้ำ (เขย่า 10 ครั้ง)', NULL, NULL, 'ละลายได้ดีในน้ำ', '-', 'CIPAC Method (MT 75.3), Vol. K', 'Visual', 3),
  ((SELECT id FROM materials WHERE code = 'DEMO-SC-001'),
   (SELECT id FROM test_parameters WHERE code = 'AI'),    '',
   '4.50 - 5.50', 4.50, 5.50, NULL, '%w/v', 'CIPAC method Vol J', 'HPLC', 180),
  ((SELECT id FROM materials WHERE code = 'DEMO-SC-001'),
   (SELECT id FROM test_parameters WHERE code = 'VISC'),  '',
   '800 - 1500 cPs', 800, 1500, NULL, 'cPs', 'Viscometer', 'Viscometer', 120),

  -- Temephos 1% w/w GR ----------------------------------------------------
  ((SELECT id FROM materials WHERE code = 'DEMO-GR-001'),
   (SELECT id FROM test_parameters WHERE code = 'PH'),    '',
   '5.50 - 8.00', 5.50, 8.00, NULL, '-', 'CIPAC Method (MT 75.3), Vol. J', 'pH meter', 10),
  ((SELECT id FROM materials WHERE code = 'DEMO-GR-001'),
   (SELECT id FROM test_parameters WHERE code = 'AI'),    '',
   '0.75 - 1.25', 0.75, 1.25, NULL, '%w/w', 'CIPAC method Vol 1C', 'HPLC', 300),
  ((SELECT id FROM materials WHERE code = 'DEMO-GR-001'),
   (SELECT id FROM test_parameters WHERE code = 'SIEVE'), '1.1 ผ่านตะแกรงขนาด 1.25 mm',
   'ไม่น้อยกว่า 98 %', 98, NULL, NULL, '%', 'CIPAC Method (MT 167), Vol. F', 'Sieve set', 60),
  ((SELECT id FROM materials WHERE code = 'DEMO-GR-001'),
   (SELECT id FROM test_parameters WHERE code = 'SIEVE'), '1.2 ผ่านตะแกรงขนาด 250 µm',
   'ไม่มากกว่า 2 %', NULL, 2, NULL, '%', 'CIPAC Method (MT 167), Vol. F', 'Sieve set', 60);

-- ---------------------------------------------------------------- people ----
-- Replace with the real analyst, TM and lab-manager accounts.
INSERT INTO users (name, name_th, role, email) VALUES
  ('Analyst 1',    'นักเคมี',          'CHEMIST',     'analyst@example.com'),
  ('TM 1',         'TM',               'TM',          'tm@example.com'),
  ('Lab Manager 1','ผู้จัดการวิชาการ', 'LAB_MANAGER', 'lab.manager@example.com');

-- ------------------------------------------------------------- suppliers ----
INSERT INTO suppliers (name, address, contact_name, contact_email) VALUES
  ('Demo Supplier A Co., Ltd.', 'Bangkok, Thailand', 'Sales A', 'a@example.com'),
  ('Demo Supplier B Co., Ltd.', 'Rayong, Thailand',  'Sales B', 'b@example.com');

-- -------------------------------------------------------------- counters ----
INSERT INTO counters (key, value) VALUES
  ('SAMPLE:RM', 0),
  ('SAMPLE:WIP', 0),
  ('SAMPLE:FG', 0);
