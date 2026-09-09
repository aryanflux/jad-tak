-- Add subdivisions for databases that already ran db/schema.sql + db/seed.sql.
-- Safe to run repeatedly.

INSERT INTO categories (code, name, description, parent_id)
SELECT source.code, source.name, source.description, parent.id
FROM (
  VALUES
    ('AGR_IRR', 'Irrigation & Water Access', 'Canals, borewells and farm water supply', 'AGR'),
    ('AGR_CROP', 'Crops, Seeds & Subsidies', 'Crop damage, seeds, MSP and subsidies', 'AGR'),
    ('WAT_SUP', 'Drinking Water Supply', 'Pipelines, handpumps and water availability', 'WAT'),
    ('WAT_DRAIN', 'Drainage & Sewage', 'Blocked drains, flooding and sewage', 'WAT'),
    ('HLT_FAC', 'Health Facilities', 'Hospitals, PHCs and clinics', 'HLT'),
    ('HLT_MED', 'Medicines & Emergency Care', 'Medicines, ambulances and urgent care', 'HLT'),
    ('EDU_SCH', 'Schools & Teachers', 'School buildings, teachers and classrooms', 'EDU'),
    ('EDU_AID', 'Scholarships & Student Services', 'Scholarships, meals and student support', 'EDU'),
    ('PWR_SUP', 'Electricity Supply', 'Outages, transformers and voltage', 'PWR'),
    ('PWR_LIGHT', 'Street Lighting', 'Streetlights, poles and public lighting', 'PWR'),
    ('INF_ROAD', 'Roads & Potholes', 'Road repairs, potholes and pavements', 'INF'),
    ('INF_BRIDGE', 'Bridges & Public Works', 'Bridges, culverts and construction', 'INF'),
    ('SWM_COLLECTION', 'Garbage Collection', 'Collection schedules, bins and litter', 'SWM'),
    ('SWM_DUMP', 'Dumping & Cleanliness', 'Illegal dumping, waste sites and odour', 'SWM'),
    ('OTH_SERVICES', 'Other Citizen Services', 'General civic services and support', 'OTH')
) AS source(code, name, description, parent_code)
JOIN categories parent ON parent.code = source.parent_code
ON CONFLICT (code) DO NOTHING;
