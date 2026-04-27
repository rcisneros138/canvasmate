ALTER TABLE groups ADD COLUMN group_lead_canvasser_id INTEGER
  REFERENCES canvassers(id) ON DELETE SET NULL;
