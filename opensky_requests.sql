-- Table to track requested bboxes from Tesla devices
-- The Home Feeder polls this table to see where it needs to fetch aircrafts.
CREATE TABLE IF NOT EXISTS public.opensky_requests (
    bbox_key TEXT PRIMARY KEY,
    last_requested_at BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Disable RLS for this internal signaling table
ALTER TABLE public.opensky_requests DISABLE ROW LEVEL SECURITY;
