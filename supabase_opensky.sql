-- Supabase Schema for OpenSky Serverless State Management
-- Execute this entire file in your Supabase SQL Editor

-- Table for OpenSky Tokens and Rate Limits (Cooldowns)
CREATE TABLE IF NOT EXISTS public.opensky_tokens (
    account_id TEXT PRIMARY KEY,
    token TEXT,
    expires_at BIGINT NOT NULL DEFAULT 0,
    cooldown_until BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Note: We disable Row Level Security (RLS) entirely for these two backend-only tables.
-- The API tokens are handled securely on the Next.js server (Vercel) and never 
-- sent to the client. This simplifies access using the anon key.
ALTER TABLE public.opensky_tokens DISABLE ROW LEVEL SECURITY;

-- Table for Spatial Caching (Bbox Snapping)
CREATE TABLE IF NOT EXISTS public.opensky_cache (
    bbox_key TEXT PRIMARY KEY,
    states JSONB,
    rate_limited BOOLEAN DEFAULT false,
    account_index INTEGER,
    ts BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.opensky_cache DISABLE ROW LEVEL SECURITY;
