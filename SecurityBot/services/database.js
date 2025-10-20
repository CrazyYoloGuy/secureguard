const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from parent directory
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Initialize Supabase client (prefer service role for server-side writes)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase configuration. Please check your .env file.');
    console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log(`🔐 Supabase client initialized using ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE_KEY' : 'ANON_KEY'}`);

class DatabaseService {
    /**
     * Get server settings from database
     * @param {string} serverId - Discord server ID
     * @returns {Object} Server settings
     */
    async getServerSettings(serverId) {
        try {
            console.log(`📊 Loading server settings for server ID: ${serverId}`);

            // Fetch legacy row (for other features and fallback)
            const { data: legacy, error: legacyErr } = await supabase
                .from('server_settings')
                .select('*')
                .eq('server_id', serverId)
                .single();

            if (legacyErr && legacyErr.code !== 'PGRST116') {
                console.error(`❌ Database error (legacy server_settings) for ${serverId}:`, legacyErr);
            }

            // Build base from default or legacy
            const base = legacy || this.getDefaultSettings();

            // Overlay normalized tables if present
            const lp = await this.getLinkProtection(serverId);
            base.link_protection = lp;
            const as = await this.getAntiSpam(serverId);
            base.anti_spam = as;
            const mv = await this.getMemberVerification(serverId);
            base.member_verification = mv;

            console.log(`✅ Loaded combined settings for server ${serverId}:`, JSON.stringify({
                link_protection: base.link_protection,
                anti_spam: base.anti_spam,
                member_verification: base.member_verification
            }, null, 2));
            return base;
        } catch (error) {
            console.error(`❌ Error fetching server settings for ${serverId}:`, error);
            const fallback = this.getDefaultSettings();
            // Try overlay with normalized tables even on legacy failure
            try {
                fallback.link_protection = await this.getLinkProtection(serverId);
            } catch {}
            try {
                fallback.anti_spam = await this.getAntiSpam(serverId);
            } catch {}
            try {
                fallback.member_verification = await this.getMemberVerification(serverId);
            } catch {}
            return fallback;
        }
    }
    /**
     * Get Link Protection settings from normalized table
     */
    async getLinkProtection(serverId) {
        try {
            const { data, error } = await supabase
                .from('link_protection_settings')
                .select('*')
                .eq('server_id', serverId)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error(`❌ DB error (link_protection_settings) for ${serverId}:`, error);
            }

            if (!data) {
                // Fallback to default
                const def = this.getDefaultSettings().link_protection;
                return def;
            }

            const mapped = {
                enabled: !!data.enabled,
                config: {
                    whitelist_users: data.whitelist_users || [],
                    whitelist_roles: data.whitelist_roles || [],
                    whitelist_domains: data.whitelist_domains || [],
                    punishment: data.punishment || 'delete',
                    warn_message: data.warn_message || 'Links are not allowed in this server.',
                    block_suspicious: data.block_suspicious ?? true,
                    scan_embeds: data.scan_embeds ?? true,
                    check_redirects: data.check_redirects ?? true,
                    allow_media_links: data.allow_media_links ?? true,
                    log_violations: data.log_violations ?? true,
                    bypass_permissions: data.bypass_permissions || ['ADMINISTRATOR', 'MANAGE_MESSAGES']
                }
            };

            return mapped;
        } catch (e) {
            console.error('❌ getLinkProtection failed:', e);
            return this.getDefaultSettings().link_protection;
        }
    }

    /**
     * Update Link Protection settings in normalized table
     */
    async updateLinkProtectionSetting(serverId, enabled, config = {}) {
        try {
            // Sanitize and normalize input
            const rawUsers = Array.isArray(config.whitelist_users) ? config.whitelist_users.map(String) : [];
            const whitelistUsers = rawUsers.filter(id => /^\d{17,20}$/.test(id));
            const filteredOut = rawUsers.length - whitelistUsers.length;

            const row = {
                server_id: serverId,
                enabled: !!enabled,
                punishment: config.punishment || 'delete',
                // Always standardize warn_message; UI no longer controls this
                warn_message: 'Links are not allowed in this server.',
                whitelist_users: whitelistUsers,
                whitelist_roles: Array.isArray(config.whitelist_roles) ? config.whitelist_roles.map(String) : [],
                whitelist_domains: Array.isArray(config.whitelist_domains) ? config.whitelist_domains.map(String) : [],
                block_suspicious: config.block_suspicious !== false,
                scan_embeds: config.scan_embeds !== false,
                check_redirects: config.check_redirects !== false,
                allow_media_links: config.allow_media_links !== false,
                log_violations: config.log_violations !== false,
                bypass_permissions: Array.isArray(config.bypass_permissions) ? config.bypass_permissions : ['ADMINISTRATOR', 'MANAGE_MESSAGES'],
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            };

            console.log('📝 AUDIT: Saving link_protection_settings', JSON.stringify({ server_id: serverId, enabled: row.enabled, counts: {
                whitelist_users: row.whitelist_users.length,
                whitelist_roles: row.whitelist_roles.length,
                whitelist_domains: row.whitelist_domains.length,
                filtered_invalid_user_ids: filteredOut
            }}, null, 2));

            // Upsert into normalized table
            const { error: upsertError } = await supabase
                .from('link_protection_settings')
                .upsert(row, { onConflict: 'server_id' });

            if (upsertError) throw upsertError;

            // Verify
            const { data: verify, error: verifyError } = await supabase
                .from('link_protection_settings')
                .select('*')
                .eq('server_id', serverId)
                .single();

            if (verifyError) throw verifyError;

            console.log('✅ AUDIT: Saved link_protection_settings successfully');

            // Return combined object expected by callers
            return {
                server_id: serverId,
                link_protection: {
                    enabled: verify.enabled,
                    config: {
                        whitelist_users: verify.whitelist_users || [],
                        whitelist_roles: verify.whitelist_roles || [],
                        whitelist_domains: verify.whitelist_domains || [],
                        punishment: verify.punishment || 'delete',
                        block_suspicious: verify.block_suspicious ?? true,
                        scan_embeds: verify.scan_embeds ?? true,
                        check_redirects: verify.check_redirects ?? true,
                        allow_media_links: verify.allow_media_links ?? true,
                        log_violations: verify.log_violations ?? true,
                        bypass_permissions: verify.bypass_permissions || ['ADMINISTRATOR', 'MANAGE_MESSAGES']
                    }
                }
            };
        } catch (error) {
            console.error('❌ Error updating link_protection_settings:', error);
            throw error;
        }
    }


    /**
     * Get Anti-Spam settings from normalized table
     */
    async getAntiSpam(serverId) {
        try {
            const { data, error } = await supabase
                .from('anti_spam_settings')
                .select('*')
                .eq('server_id', serverId)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error(`❌ DB error (anti_spam_settings) for ${serverId}:`, error);
            }

            if (!data) {
                return this.getDefaultSettings().anti_spam;
            }

            return {
                enabled: !!data.enabled,
                config: {
                    max_messages: data.max_messages ?? 5,
                    time_window: data.time_window ?? 5,
                    duplicate_threshold: data.duplicate_threshold ?? 3,
                    mentions_per_message: data.mentions_per_message ?? 5,
                    same_user_tag_threshold: data.same_user_tag_threshold ?? 5,
                    whitelist_roles: Array.isArray(data.whitelist_roles) ? data.whitelist_roles : [],
                    whitelist_users: Array.isArray(data.whitelist_users) ? data.whitelist_users : [],
                    punishment: data.punishment || 'delete'
                }
            };
        } catch (e) {
            console.error('❌ getAntiSpam failed:', e);
            return this.getDefaultSettings().anti_spam;
        }
    }

    /**
     * Update Anti-Spam settings in normalized table
     */
    async updateAntiSpamSetting(serverId, enabled, config = {}) {
        try {
            const clamp = (v, min, max, d) => {
                const n = parseInt(v ?? d, 10);
                if (Number.isNaN(n)) return d;
                return Math.max(min, Math.min(max, n));
            };
            const rawUsers = Array.isArray(config.whitelist_users) ? config.whitelist_users.map(String) : [];
            const whitelistUsers = rawUsers.filter(id => /^\d{17,20}$/.test(id));
            const rawRoles = Array.isArray(config.whitelist_roles) ? config.whitelist_roles.map(String) : [];

            const row = {
                server_id: serverId,
                enabled: !!enabled,
                max_messages: clamp(config.max_messages, 1, 50, 5),
                time_window: clamp(config.time_window, 5, 120, 5),
                duplicate_threshold: clamp(config.duplicate_threshold, 1, 10, 3),
                mentions_per_message: clamp(config.mentions_per_message, 0, 20, 5),
                same_user_tag_threshold: clamp(config.same_user_tag_threshold, 1, 50, 5),
                whitelist_roles: rawRoles,
                whitelist_users: whitelistUsers,
                punishment: typeof config.punishment === 'string' ? config.punishment : 'delete',
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            };

            console.log('📝 AUDIT: Saving anti_spam_settings', JSON.stringify({
                server_id: serverId,
                enabled: row.enabled,
                max_messages: row.max_messages,
                time_window: row.time_window,
                duplicate_threshold: row.duplicate_threshold,
                mentions_per_message: row.mentions_per_message,
                same_user_tag_threshold: row.same_user_tag_threshold,
                whitelist_roles: row.whitelist_roles.length,
                whitelist_users: row.whitelist_users.length
            }, null, 2));

            let upsertError;
            try {
                ({ error: upsertError } = await supabase
                    .from('anti_spam_settings')
                    .upsert(row, { onConflict: 'server_id' }));
                if (upsertError) throw upsertError;
            } catch (e) {
                const msg = e?.message || '';
                if (msg.includes('same_user_tag_threshold') || e?.code === '42703') {
                    console.warn('⚠️ anti_spam_settings missing column same_user_tag_threshold. Retrying without it.');
                    const { same_user_tag_threshold, ...fallbackRow } = row;
                    const { error: retryError } = await supabase
                        .from('anti_spam_settings')
                        .upsert(fallbackRow, { onConflict: 'server_id' });
                    if (retryError) throw retryError;
                } else {
                    throw e;
                }
            }

            const { data: verify, error: verifyError } = await supabase
                .from('anti_spam_settings')
                .select('*')
                .eq('server_id', serverId)
                .single();
            if (verifyError) throw verifyError;

            console.log('✅ AUDIT: Saved anti_spam_settings successfully');

            return {
                server_id: serverId,
                anti_spam: {
                    enabled: verify.enabled,
                    config: {
                        max_messages: verify.max_messages,
                        time_window: verify.time_window,
                        duplicate_threshold: verify.duplicate_threshold,
                        mentions_per_message: verify.mentions_per_message,
                        same_user_tag_threshold: verify.same_user_tag_threshold ?? 5,
                        whitelist_roles: verify.whitelist_roles || [],
                        whitelist_users: verify.whitelist_users || [],
                        punishment: verify.punishment || 'delete'
                    }
                }
            };
        } catch (error) {
            console.error('❌ Error updating anti_spam_settings:', error);
            throw error;
        }
    }


        /**
         * Get Member Verification settings from server_settings table
         */
        async getMemberVerification(serverId) {
            try {
                // Use only the server_settings table with JSON column
                const { data: legacy, error: legacyErr } = await supabase
                    .from('server_settings')
                    .select('member_verification')
                    .eq('server_id', serverId)
                    .single();

                if (legacyErr && legacyErr.code !== 'PGRST116') {
                    console.error(`❌ DB error (server_settings.member_verification) for ${serverId}:`, legacyErr);
                }

                if (!legacyErr && legacy?.member_verification) {
                    return legacy.member_verification;
                }

                return this.getDefaultSettings().member_verification;
            } catch (error) {
                console.error(`❌ Error fetching member verification for ${serverId}:`, error);
                return this.getDefaultSettings().member_verification;
            }
        }

        /**
         * Update Member Verification settings in server_settings table
         */
        async updateMemberVerificationSetting(serverId, enabled, config = {}) {
            try {
                // Preserve existing config during disable so the bot can clean up
                let effectiveConfig = { ...(config || {}) };
                if (!enabled && config && config.pending_disable === true) {
                    try {
                        const current = await this.getMemberVerification(serverId);
                        if (current?.config) {
                            effectiveConfig = { ...current.config, pending_disable: true };
                        }
                    } catch {}
                }

                console.log('📝 AUDIT: Saving member_verification to server_settings', JSON.stringify({
                    server_id: serverId,
                    enabled: !!enabled,
                    config: effectiveConfig
                }, null, 2));

                // Write directly to server_settings JSON column
                const updatedFeature = {
                    enabled: !!enabled,
                    config: {
                        verification_type: effectiveConfig.verification_type || 'simple',
                        member_role_id: effectiveConfig.member_role_id || null,
                        channel_id: effectiveConfig.channel_id || null,
                        message_id: effectiveConfig.message_id || null,
                        unverified_role_id: effectiveConfig.unverified_role_id || null,
                        // carry pending_disable flag if present
                        pending_disable: config?.pending_disable === true ? true : undefined,
                        // carry manual_disable flag if present
                        manual_disable: config?.manual_disable === true ? true : undefined,
                        // carry auto_create_channel flag if present
                        auto_create_channel: config?.auto_create_channel === true ? true : undefined
                    }
                };

                const { data: upsertResult, error: upsertError } = await supabase
                    .from('server_settings')
                    .upsert({
                        server_id: serverId,
                        member_verification: updatedFeature,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'server_id' })
                    .select();

                if (upsertError) {
                    throw upsertError;
                }

                console.log('✅ AUDIT: Saved member_verification to server_settings successfully');

                return {
                    server_id: serverId,
                    member_verification: updatedFeature
                };
            } catch (error) {
                console.error('❌ Error updating member_verification in server_settings:', error);
                throw error;
            }
        }



    /**
     * Update server feature setting
     * @param {string} serverId - Discord server ID
     * @param {string} feature - Feature name
     * @param {boolean} enabled - Whether feature is enabled
     * @param {Object} config - Feature configuration
     */
    async updateFeatureSetting(serverId, feature, enabled, config = {}) {
        try {
            // Route normalized features
            if (feature === 'link_protection') {
                return await this.updateLinkProtectionSetting(serverId, enabled, config);
            }
            if (feature === 'anti_spam') {
                return await this.updateAntiSpamSetting(serverId, enabled, config);
            }
            if (feature === 'member_verification') {
                return await this.updateMemberVerificationSetting(serverId, enabled, config);
            }

            console.log(`🔄 Updating ${feature} for server ${serverId}:`);
            console.log(`   Enabled: ${enabled}`);
            console.log(`   Config:`, JSON.stringify(config, null, 2));

            // Create the updated feature object
            const updatedFeature = {
                enabled: enabled,
                config: config
            };

            console.log(`🔧 New feature object:`, JSON.stringify(updatedFeature, null, 2));

            // Upsert the row to ensure it exists and only update the specific feature column
            const upsertData = {
                server_id: serverId,
                [feature]: updatedFeature,
                updated_at: new Date().toISOString()
            };

            console.log(`💾 Upsert data:`, JSON.stringify(upsertData, null, 2));

            const { data: upsertResult, error: upsertError } = await supabase
                .from('server_settings')
                .upsert(upsertData, { onConflict: 'server_id' })
                .select();

            if (upsertError) throw upsertError;

            // Re-fetch the row we just wrote to confirm persistence
            const { data: verifyRow, error: verifyError } = await supabase
                .from('server_settings')
                .select('*')
                .eq('server_id', serverId)
                .single();

            if (verifyError) throw verifyError;

            console.log(`✅ Successfully updated ${feature} for server ${serverId}`);
            console.log(`📥 Verified ${feature}:`, JSON.stringify(verifyRow[feature], null, 2));

            return verifyRow;
        } catch (error) {
            console.error(`❌ Error updating feature setting:`, error);
            throw error;
        }
    }

    /**
     * Get default server settings
     * @returns {Object} Default settings
     */
    getDefaultSettings() {
        return {
            anti_spam: {
                enabled: false,
                config: {
                    max_messages: 5,
                    time_window: 5,
                    duplicate_threshold: 3,
                    mentions_per_message: 5,
                    same_user_tag_threshold: 5,
                    punishment: 'delete'
                }
            },
            auto_moderation: {
                enabled: false,
                config: {
                    filter_profanity: true,
                    filter_caps: true,
                    caps_threshold: 70
                }
            },
            welcome_messages: {
                enabled: false,
                config: {
                    channel_id: null,
                    message: 'Welcome to the server, {user}!'
                }
            },
            raid_protection: {
                enabled: false,
                config: {
                    join_threshold: 10,
                    time_window: 60,
                    action: 'lockdown'
                }
            },
            link_protection: {
                enabled: false,
                config: {
                    whitelist_domains: [],
                    whitelist_users: [],
                    whitelist_roles: [],
                    block_suspicious: true,
                    scan_embeds: true,
                    check_redirects: true,
                    allow_media_links: true,
                    punishment: 'delete',
                    warn_message: 'Links are not allowed in this server.',
                    log_violations: true,
                    bypass_permissions: ['ADMINISTRATOR', 'MANAGE_MESSAGES']
                }
            },
            member_verification: {
                enabled: false,
                config: {
                    verification_type: 'simple',
                    member_role_id: null,
                    channel_id: null,
                    message_id: null,
                    unverified_role_id: null
                }
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    /**
     * Create server profile if it doesn't exist
     * @param {string} serverId - Discord server ID
     * @param {string} serverName - Discord server name
     */
    async createServerProfile(serverId, serverName) {
        try {
            // Validate inputs
            if (!serverId || typeof serverId !== 'string') {
                throw new Error(`Invalid serverId: ${serverId}`);
            }

            if (!serverName || typeof serverName !== 'string') {
                throw new Error(`Invalid serverName: ${serverName}`);
            }

            // Get default settings without server_id and server_name (we'll set them explicitly)
            const defaultSettings = this.getDefaultSettings();
            delete defaultSettings.server_id;
            delete defaultSettings.server_name;

            const { data, error } = await supabase
                .from('server_settings')
                .upsert({
                    server_id: serverId,
                    server_name: serverName,
                    ...defaultSettings,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'server_id',
                    ignoreDuplicates: true
                });

            if (error && error.code !== '23505') { // 23505 = unique violation (already exists)
                throw error;
            }

            console.log(`✅ Server profile ensured for: ${serverName} (${serverId})`);
            return true;
        } catch (error) {
            console.error(`❌ Error creating server profile for ${serverId}:`, error);
            return false;
        }
    }

    /**
     * Initialize all server profiles for bot's current servers
     * @param {Collection} guilds - Discord client guilds collection
     */
    async initializeAllServerProfiles(guilds) {
        try {
            console.log(`🔄 Initializing profiles for ${guilds.size} servers...`);

            const promises = guilds.map(guild =>
                this.createServerProfile(guild.id, guild.name)
            );

            await Promise.all(promises);
            console.log(`✅ All server profiles initialized`);
            return true;
        } catch (error) {
            console.error('❌ Error initializing server profiles:', error);
            return false;
        }
    }

    /**
     * Get all servers with their settings
     */
    async getAllServerSettings() {
        try {
            const { data, error } = await supabase
                .from('server_settings')
                .select('*')
                .order('server_name');

            if (error) {
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('❌ Error fetching all server settings:', error);
            return [];
        }
    }

    /**
     * Test database connection
     */
    async testConnection() {
        try {
            const { data, error } = await supabase
                .from('server_settings')
                .select('count', { count: 'exact', head: true });

            if (error) {
                throw error;
            }

            console.log('✅ Database connection successful');
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            return false;
        }
    }
}

module.exports = new DatabaseService();
