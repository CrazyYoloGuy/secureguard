const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables from parent directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const database = require('../SecurityBot/services/database');

const app = express();
const PORT = process.env.API_PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json());

// Health endpoint for quick checks
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Routes

/**
 * GET /api/server/:serverId/settings
 * Get server settings
 */
app.get('/api/server/:serverId/settings', async (req, res) => {
    try {
        const { serverId } = req.params;
        const settings = await database.getServerSettings(serverId);
        res.json(settings);
    } catch (error) {
        console.error('Error fetching server settings:', error);
        res.status(500).json({ error: 'Failed to fetch server settings' });
    }
});

/**
 * PUT /api/server/:serverId/feature/:feature
 * Update feature setting
 */
app.put('/api/server/:serverId/feature/:feature', async (req, res) => {
    try {
        const { serverId, feature } = req.params;
        const { enabled, config } = req.body;

        // Defensive: ensure serverId is present and sane
        if (!serverId) {
            return res.status(400).json({ error: 'serverId is required in URL' });
        }

        const normalizedFeature = (feature || '').replace(/-/g, '_');
        const summarize = (arr) => Array.isArray(arr) ? arr.length : 0;
        console.log(`🔄 API: Updating feature=${normalizedFeature} (raw='${feature}') serverId=${serverId}`);
        console.log(`📦 Body: enabled=${enabled} users=${summarize(config?.whitelist_users)} roles=${summarize(config?.whitelist_roles)} domains=${summarize(config?.whitelist_domains)}`);

        const result = await database.updateFeatureSetting(serverId, normalizedFeature, enabled, config);

        console.log(`✅ API: Updated ${feature} for serverId=${serverId}`);

        res.json({
            success: true,
            message: `${feature} ${enabled ? 'enabled' : 'disabled'} successfully`,
            data: result
        });
    } catch (error) {
        console.error('❌ API: Error updating feature setting:', error);
        res.status(500).json({
            error: 'Failed to update feature setting',
            details: error.message
        });
    }
});

/**
 * GET /api/server/:serverId/settings
 * Get all settings for a server
 */
app.get('/api/server/:serverId/settings', async (req, res) => {
    try {
        const { serverId } = req.params;
        console.log(`📊 API: Loading settings for server ${serverId}`);

        const settings = await database.getServerSettings(serverId);

        console.log(`✅ API: Settings loaded for server ${serverId}`);
        res.json(settings);
    } catch (error) {
        console.error('❌ API: Error loading server settings:', error);
        res.status(500).json({
            error: 'Failed to load server settings',
            details: error.message
        });
    }
});



/**
 * GET /api/bot/server/:serverId/status
 * Check if bot is in a specific server
 */
app.get('/api/bot/server/:serverId/status', async (req, res) => {
    try {
        const { serverId } = req.params;

        // Use bot token to check if bot is actually in the server
        const botToken = process.env.DISCORD_TOKEN;
        if (!botToken) {
            return res.status(500).json({
                error: 'Bot token not configured',
                serverId: serverId,
                botInServer: false
            });
        }

        // Try to fetch the guild using the bot token
        // If the bot is in the server, this will succeed
        // If the bot is not in the server, this will return 403 or 404
        const response = await fetch(`https://discord.com/api/v10/guilds/${serverId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            }
        });

        const botInServer = response.ok;

        // Also check if we have settings for this server
        let hasSettings = false;
        try {
            const settings = await database.getServerSettings(serverId);
            hasSettings = settings !== null;
        } catch (dbError) {
            console.log('Could not check settings:', dbError.message);
        }

        res.json({
            serverId: serverId,
            botInServer: botInServer,
            hasSettings: hasSettings,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error checking bot status:', error);
        res.status(500).json({
            error: 'Failed to check bot status',
            serverId: req.params.serverId,
            botInServer: false
        });
    }
});

/**
 * GET /api/discord/server/:serverId/roles
 * Get Discord server roles using bot token
 */
app.get('/api/discord/server/:serverId/roles', async (req, res) => {
    try {
        const { serverId } = req.params;

        // Use bot token instead of user token
        const botToken = process.env.DISCORD_TOKEN;
        if (!botToken) {
            return res.status(500).json({ error: 'Bot token not configured' });
        }

        // Fetch roles from Discord API using bot token
        const response = await fetch(`https://discord.com/api/v10/guilds/${serverId}/roles`, {
            method: 'GET',
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Discord API error:', response.status, errorText);
            return res.status(response.status).json({
                error: `Discord API error: ${response.status} ${response.statusText}`
            });
        }

        const roles = await response.json();

        // Filter out @everyone role and sort by position
        const filteredRoles = roles
            .filter(role => role.name !== '@everyone')
            .sort((a, b) => b.position - a.position);

        res.json(filteredRoles);

    } catch (error) {
        console.error('Error fetching server roles:', error);
        res.status(500).json({ error: 'Failed to fetch server roles' });
    }
});

/**
 * GET /api/discord/server/:serverId/member/:userId
 * Check if a user is a member of the server using bot token
 */
app.get('/api/discord/server/:serverId/member/:userId', async (req, res) => {
    try {
        const { serverId, userId } = req.params;

        // Use bot token instead of user token
        const botToken = process.env.DISCORD_TOKEN;
        if (!botToken) {
            return res.status(500).json({ error: 'Bot token not configured' });
        }

        // Fetch member from Discord API using bot token
        const response = await fetch(`https://discord.com/api/v10/guilds/${serverId}/members/${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return res.status(404).json({ error: 'User not found in server' });
            }
            const errorText = await response.text();
            console.error('Discord API error:', response.status, errorText);
            return res.status(response.status).json({
                error: `Discord API error: ${response.status} ${response.statusText}`
            });
        }

        const member = await response.json();

        // Return basic member info
        res.json({
            user: {
                id: member.user.id,
                username: member.user.username,
                discriminator: member.user.discriminator,
                avatar: member.user.avatar
            },
            nick: member.nick,
            roles: member.roles,
            joined_at: member.joined_at
        });

    } catch (error) {
        console.error('Error fetching server member:', error);
        res.status(500).json({ error: 'Failed to fetch server member' });
    }
});

/**
 * GET /api/discord/server/:serverId/info
 * Get Discord server information using bot token
 */
app.get('/api/discord/server/:serverId/info', async (req, res) => {
    try {
        const { serverId } = req.params;

        // Use bot token
        const botToken = process.env.DISCORD_TOKEN;
        if (!botToken) {
            return res.status(500).json({ error: 'Bot token not configured' });
        }

        // Fetch server info from Discord API using bot token
        const response = await fetch(`https://discord.com/api/v10/guilds/${serverId}?with_counts=true`, {
            method: 'GET',
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Discord API error:', response.status, errorText);
            return res.status(response.status).json({
                error: `Discord API error: ${response.status} ${response.statusText}`
            });
        }

        const serverInfo = await response.json();

        // Return server info
        res.json({
            id: serverInfo.id,
            name: serverInfo.name,
            icon: serverInfo.icon,
            description: serverInfo.description,
            member_count: serverInfo.approximate_member_count,
            presence_count: serverInfo.approximate_presence_count,
            features: serverInfo.features
        });

    } catch (error) {
        console.error('Error fetching server info:', error);
        res.status(500).json({ error: 'Failed to fetch server info' });
    }
});

/**
 * GET /api/discord/channel/:channelId
 * Fetch channel info by id to validate it exists and belongs to a guild
 */
app.get('/api/discord/channel/:channelId', async (req, res) => {
    try {
        const { channelId } = req.params;
        const botToken = process.env.DISCORD_TOKEN;
        if (!botToken) return res.status(500).json({ error: 'Bot token not configured' });

        const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            const text = await response.text();
            console.error('Discord API error (channel):', response.status, text);
            return res.status(response.status).json({ error: `Discord API error: ${response.status} ${response.statusText}` });
        }
        const channel = await response.json();
        res.json({ id: channel.id, type: channel.type, guild_id: channel.guild_id, name: channel.name });
    } catch (error) {
        console.error('Error fetching channel info:', error);
        res.status(500).json({ error: 'Failed to fetch channel info' });
    }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', async (req, res) => {
    try {
        const dbConnected = await database.testConnection();
        res.json({
            status: 'ok',
            database: dbConnected ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            error: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 API server running on http://localhost:${PORT}`);
});

module.exports = app;
