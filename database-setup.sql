-- ============================================
-- Discord Security Bot - Database Setup Script
-- ============================================
-- Run this script in your Supabase SQL Editor
-- This will create all necessary tables and indexes
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. SERVER_SETTINGS TABLE (Main Settings)
-- ============================================
-- This table stores all server configurations with JSONB columns for flexibility

CREATE TABLE IF NOT EXISTS server_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id TEXT UNIQUE NOT NULL,
    server_name TEXT,
    
    -- Feature configurations stored as JSONB
    anti_spam JSONB DEFAULT '{"enabled": false, "config": {"max_messages": 5, "time_window": 5, "duplicate_threshold": 3, "mentions_per_message": 5, "same_user_tag_threshold": 5, "punishment": "delete"}}'::jsonb,
    auto_moderation JSONB DEFAULT '{"enabled": false, "config": {"filter_profanity": true, "filter_caps": true, "caps_threshold": 70}}'::jsonb,
    welcome_messages JSONB DEFAULT '{"enabled": false, "config": {"channel_id": null, "message": "Welcome to the server, {user}!"}}'::jsonb,
    raid_protection JSONB DEFAULT '{"enabled": false, "config": {"join_threshold": 10, "time_window": 60, "action": "lockdown"}}'::jsonb,
    link_protection JSONB DEFAULT '{"enabled": false, "config": {"whitelist_domains": [], "whitelist_users": [], "whitelist_roles": [], "block_suspicious": true, "scan_embeds": true, "check_redirects": true, "allow_media_links": true, "punishment": "delete", "warn_message": "Links are not allowed in this server.", "log_violations": true, "bypass_permissions": ["ADMINISTRATOR", "MANAGE_MESSAGES"]}}'::jsonb,
    member_verification JSONB DEFAULT '{"enabled": false, "config": {"verification_type": "simple", "member_role_id": null, "channel_id": null, "message_id": null, "unverified_role_id": null}}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on server_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_server_settings_server_id ON server_settings(server_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_server_settings_created_at ON server_settings(created_at);

-- ============================================
-- 2. LINK_PROTECTION_SETTINGS TABLE (Normalized)
-- ============================================
-- Normalized table for link protection settings with better query performance

CREATE TABLE IF NOT EXISTS link_protection_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    
    -- Configuration fields
    punishment TEXT DEFAULT 'delete' CHECK (punishment IN ('delete', 'warn', 'kick', 'ban', 'timeout')),
    warn_message TEXT DEFAULT 'Links are not allowed in this server.',
    
    -- Whitelist arrays
    whitelist_users TEXT[] DEFAULT '{}',
    whitelist_roles TEXT[] DEFAULT '{}',
    whitelist_domains TEXT[] DEFAULT '{}',
    
    -- Protection options
    block_suspicious BOOLEAN DEFAULT TRUE,
    scan_embeds BOOLEAN DEFAULT TRUE,
    check_redirects BOOLEAN DEFAULT TRUE,
    allow_media_links BOOLEAN DEFAULT TRUE,
    log_violations BOOLEAN DEFAULT TRUE,
    
    -- Bypass permissions (stored as array)
    bypass_permissions TEXT[] DEFAULT ARRAY['ADMINISTRATOR', 'MANAGE_MESSAGES'],
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on server_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_link_protection_server_id ON link_protection_settings(server_id);

-- Create index on enabled for filtering
CREATE INDEX IF NOT EXISTS idx_link_protection_enabled ON link_protection_settings(enabled);

-- ============================================
-- 3. ANTI_SPAM_SETTINGS TABLE (Normalized)
-- ============================================
-- Normalized table for anti-spam settings

CREATE TABLE IF NOT EXISTS anti_spam_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    
    -- Spam detection thresholds
    max_messages INTEGER DEFAULT 5 CHECK (max_messages >= 1 AND max_messages <= 50),
    time_window INTEGER DEFAULT 5 CHECK (time_window >= 5 AND time_window <= 120),
    duplicate_threshold INTEGER DEFAULT 3 CHECK (duplicate_threshold >= 1 AND duplicate_threshold <= 10),
    mentions_per_message INTEGER DEFAULT 5 CHECK (mentions_per_message >= 0 AND mentions_per_message <= 20),
    same_user_tag_threshold INTEGER DEFAULT 5 CHECK (same_user_tag_threshold >= 1 AND same_user_tag_threshold <= 50),
    
    -- Whitelist arrays
    whitelist_roles TEXT[] DEFAULT '{}',
    whitelist_users TEXT[] DEFAULT '{}',
    
    -- Punishment type
    punishment TEXT DEFAULT 'delete' CHECK (punishment IN ('delete', 'warn', 'kick', 'ban', 'timeout', 'mute')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on server_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_anti_spam_server_id ON anti_spam_settings(server_id);

-- Create index on enabled for filtering
CREATE INDEX IF NOT EXISTS idx_anti_spam_enabled ON anti_spam_settings(enabled);

-- ============================================
-- 4. VERIFICATION_SESSIONS TABLE (Optional)
-- ============================================
-- Table to track member verification sessions

CREATE TABLE IF NOT EXISTS verification_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    verification_type TEXT DEFAULT 'simple',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
    
    -- Session data
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    UNIQUE(server_id, user_id)
);

-- Create indexes for verification sessions
CREATE INDEX IF NOT EXISTS idx_verification_server_user ON verification_sessions(server_id, user_id);
CREATE INDEX IF NOT EXISTS idx_verification_status ON verification_sessions(status);
CREATE INDEX IF NOT EXISTS idx_verification_expires ON verification_sessions(expires_at);

-- ============================================
-- 5. MODERATION_LOGS TABLE (Optional)
-- ============================================
-- Table to store moderation action logs

CREATE TABLE IF NOT EXISTS moderation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT,
    
    -- Action details
    action_type TEXT NOT NULL CHECK (action_type IN ('warn', 'kick', 'ban', 'timeout', 'delete', 'mute', 'unmute')),
    reason TEXT,
    feature TEXT CHECK (feature IN ('anti_spam', 'link_protection', 'auto_moderation', 'raid_protection', 'manual')),
    
    -- Message context (if applicable)
    message_id TEXT,
    channel_id TEXT,
    message_content TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for moderation logs
CREATE INDEX IF NOT EXISTS idx_moderation_server_id ON moderation_logs(server_id);
CREATE INDEX IF NOT EXISTS idx_moderation_user_id ON moderation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_action_type ON moderation_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_moderation_created_at ON moderation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_feature ON moderation_logs(feature);

-- ============================================
-- 6. TRIGGERS FOR UPDATED_AT
-- ============================================
-- Automatically update the updated_at timestamp

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to server_settings
DROP TRIGGER IF EXISTS update_server_settings_updated_at ON server_settings;
CREATE TRIGGER update_server_settings_updated_at
    BEFORE UPDATE ON server_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to link_protection_settings
DROP TRIGGER IF EXISTS update_link_protection_updated_at ON link_protection_settings;
CREATE TRIGGER update_link_protection_updated_at
    BEFORE UPDATE ON link_protection_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to anti_spam_settings
DROP TRIGGER IF EXISTS update_anti_spam_updated_at ON anti_spam_settings;
CREATE TRIGGER update_anti_spam_updated_at
    BEFORE UPDATE ON anti_spam_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. ROW LEVEL SECURITY (RLS) - Optional but Recommended
-- ============================================
-- Enable RLS for better security (you can customize policies as needed)

-- Enable RLS on all tables
ALTER TABLE server_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_protection_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE anti_spam_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;

-- Create policies to allow service role full access
-- (You can customize these based on your security requirements)

CREATE POLICY "Allow service role full access to server_settings"
    ON server_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow service role full access to link_protection_settings"
    ON link_protection_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow service role full access to anti_spam_settings"
    ON anti_spam_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow service role full access to verification_sessions"
    ON verification_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow service role full access to moderation_logs"
    ON moderation_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 8. HELPER VIEWS (Optional)
-- ============================================
-- Create useful views for querying

-- View to see all enabled features per server
CREATE OR REPLACE VIEW server_features_summary AS
SELECT 
    server_id,
    server_name,
    (anti_spam->>'enabled')::boolean AS anti_spam_enabled,
    (link_protection->>'enabled')::boolean AS link_protection_enabled,
    (auto_moderation->>'enabled')::boolean AS auto_moderation_enabled,
    (raid_protection->>'enabled')::boolean AS raid_protection_enabled,
    (member_verification->>'enabled')::boolean AS member_verification_enabled,
    created_at,
    updated_at
FROM server_settings;

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- Your database is now ready to use with the Discord Security Bot
-- 
-- Next steps:
-- 1. Make sure your .env file has the correct SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
-- 2. Start the bot with: npm run start:bot
-- 3. Start the API with: npm run start:api
-- 4. The bot will automatically create server profiles when it joins servers
-- ============================================

