ALTER TABLE pageviews ADD COLUMN visitor TEXT;
ALTER TABLE pageviews ADD COLUMN device TEXT;
ALTER TABLE pageviews ADD COLUMN country TEXT;
ALTER TABLE pageviews ADD COLUMN lang TEXT;
ALTER TABLE pageviews ADD COLUMN theme TEXT;
CREATE INDEX IF NOT EXISTS idx_pageviews_visitor ON pageviews(visitor);
