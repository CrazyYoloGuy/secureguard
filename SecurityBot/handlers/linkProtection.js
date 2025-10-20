const { EmbedBuilder } = require('discord.js');
const database = require('../services/database');

class LinkProtectionHandler {
    constructor() {
        // URL regex patterns
        this.urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
        this.domainRegex = /^https?:\/\/(?:www\.)?([^\/]+)/;
        
        // Media file extensions
        this.mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mp3', '.wav', '.pdf'];
        
        // Suspicious patterns
        this.suspiciousPatterns = [
            /bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|short\.link/i,
            /discord\.gg\/[a-zA-Z0-9]+/i,
            /free.*nitro|discord.*gift/i
        ];
    }

    /**
     * Check if a message contains links and handle them according to server settings
     * @param {Message} message - Discord message object
     * @returns {Promise<boolean>} - True if message should be allowed, false if blocked
     */
    async handleMessage(message) {
        try {
            console.log(`🔗 Link Protection: Checking message from ${message.author.tag} in ${message.guild.name}`);

            // Skip if not in a guild
            if (!message.guild) {
                console.log(`💬 Skipping DM message`);
                return true;
            }

            // Get server settings
            const settings = await database.getServerSettings(message.guild.id);
            console.log(`📊 Server settings loaded for ${message.guild.name}:`, JSON.stringify(settings.link_protection, null, 2));

            if (!settings || !settings.link_protection || !settings.link_protection.enabled) {
                console.log(`⚪ Link Protection is DISABLED for ${message.guild.name}`);
                return true; // Link protection disabled
            }

            console.log(`🟢 Link Protection is ENABLED for ${message.guild.name}`);
            const config = settings.link_protection.config;

            // Check if user has bypass permissions
            if (this.hasBypassPermissions(message.member, config)) {
                console.log(`🔓 User ${message.author.tag} has bypass permissions`);
                return true;
            }

            // Check if user is whitelisted
            if (this.isUserWhitelisted(message.author.id, message.member, config)) {
                console.log(`✅ User ${message.author.tag} is whitelisted`);
                return true;
            }

            // Extract URLs from message
            const urls = this.extractUrls(message.content);
            console.log(`🔍 Found ${urls.length} URLs in message:`, urls);

            if (urls.length === 0) {
                console.log(`📝 No URLs found in message, allowing`);
                return true; // No URLs found
            }

            // Check each URL
            for (const url of urls) {
                console.log(`🔎 Checking URL: ${url}`);
                const shouldBlock = await this.shouldBlockUrl(url, config);
                console.log(`🚦 Should block ${url}? ${shouldBlock}`);

                if (shouldBlock) {
                    console.log(`🚫 BLOCKING URL: ${url}`);
                    await this.handleViolation(message, url, config);
                    return false; // Block the message
                }
            }

            console.log(`✅ All URLs allowed, message passes link protection`);
            return true; // Allow the message

        } catch (error) {
            console.error('❌ Error in link protection handler:', error);
            return true; // Allow on error to prevent false positives
        }
    }

    /**
     * Check if user has bypass permissions
     */
    hasBypassPermissions(member, config) {
        if (!member || !member.permissions) return false;
        
        const bypassPerms = config.bypass_permissions || ['ADMINISTRATOR', 'MANAGE_MESSAGES'];
        
        return bypassPerms.some(perm => {
            switch (perm) {
                case 'ADMINISTRATOR':
                    return member.permissions.has('Administrator');
                case 'MANAGE_MESSAGES':
                    return member.permissions.has('ManageMessages');
                default:
                    return false;
            }
        });
    }

    /**
     * Check if user is whitelisted (user ID or role)
     */
    isUserWhitelisted(userId, member, config) {
        console.log(`🔍 Checking if user ${userId} is whitelisted...`);
        console.log(`📋 Whitelist config:`, JSON.stringify({
            whitelist_users: config.whitelist_users,
            whitelist_roles: config.whitelist_roles
        }, null, 2));

        // Check user whitelist
        if (config.whitelist_users && config.whitelist_users.length > 0) {
            console.log(`👤 Checking user whitelist: [${config.whitelist_users.map(id => `"${id}" (${typeof id})`).join(', ')}]`);
            console.log(`🆔 User ID to check: "${userId}" (${typeof userId})`);

            // Check both string and exact matches
            const isWhitelisted = config.whitelist_users.includes(userId) ||
                                config.whitelist_users.includes(userId.toString()) ||
                                config.whitelist_users.some(id => id.toString() === userId.toString());

            console.log(`✅ User ${userId} in whitelist? ${isWhitelisted}`);

            if (isWhitelisted) {
                console.log(`🟢 User ${userId} is whitelisted by user ID`);
                return true;
            }
        } else {
            console.log(`📝 No users in whitelist`);
        }

        // Check role whitelist
        if (config.whitelist_roles && config.whitelist_roles.length > 0 && member && member.roles) {
            console.log(`🎭 Checking role whitelist: ${config.whitelist_roles.join(', ')}`);
            const userRoles = member.roles.cache.map(role => role.id);
            console.log(`👥 User roles: ${userRoles.join(', ')}`);

            const hasWhitelistedRole = config.whitelist_roles.some(roleId => userRoles.includes(roleId));
            console.log(`🎯 User has whitelisted role? ${hasWhitelistedRole}`);

            if (hasWhitelistedRole) {
                console.log(`🟢 User ${userId} is whitelisted by role`);
                return true;
            }
        } else {
            console.log(`📝 No roles in whitelist or member data unavailable`);
        }

        console.log(`🔴 User ${userId} is NOT whitelisted`);
        return false;
    }

    /**
     * Extract URLs from message content
     */
    extractUrls(content) {
        const matches = content.match(this.urlRegex);
        return matches || [];
    }

    /**
     * Check if a URL should be blocked
     */
    async shouldBlockUrl(url, config) {
        try {
            // Extract domain
            const domainMatch = url.match(this.domainRegex);
            if (!domainMatch) return false;
            
            const domain = domainMatch[1].toLowerCase();
            
            // Check domain whitelist
            if (config.whitelist_domains && config.whitelist_domains.some(whitelistDomain => 
                domain.includes(whitelistDomain.toLowerCase()) || whitelistDomain.toLowerCase().includes(domain)
            )) {
                return false; // Domain is whitelisted
            }
            
            // Check if it's a media link and media links are allowed
            if (config.allow_media_links && this.isMediaLink(url)) {
                return false;
            }
            
            // Check for suspicious patterns
            if (config.block_suspicious && this.isSuspiciousUrl(url)) {
                return true; // Block suspicious URLs
            }
            
            // If we reach here, it's a non-whitelisted link
            return true;
            
        } catch (error) {
            console.error('Error checking URL:', error);
            return false; // Allow on error
        }
    }

    /**
     * Check if URL is a media link
     */
    isMediaLink(url) {
        const lowerUrl = url.toLowerCase();
        return this.mediaExtensions.some(ext => lowerUrl.includes(ext));
    }

    /**
     * Check if URL matches suspicious patterns
     */
    isSuspiciousUrl(url) {
        return this.suspiciousPatterns.some(pattern => pattern.test(url));
    }

    /**
     * Handle link protection violation
     */
    async handleViolation(message, blockedUrl, config) {
        try {
            const punishment = config.punishment || 'delete';
            const defaultWarn = 'Links are not allowed in this server.';

            // Delete the message first (for all punishment types)
            try {
                await message.delete();
                console.log(`🗑️ Deleted message with blocked link: ${blockedUrl}`);
            } catch (deleteError) {
                console.error('Failed to delete message:', deleteError);
                // If we can't delete, at least notify
                await message.reply({
                    content: `⚠️ Link blocked. ${defaultWarn}`,
                    allowedMentions: { repliedUser: false }
                });
            }

            // Apply additional punishment based on config
            await this.applyPunishment(message, punishment, blockedUrl);

            // Log violation to database
            if (config.log_violations) {
                await this.logViolation(message, blockedUrl, punishment);
            }

            console.log(`🔗 Link blocked in ${message.guild.name}: ${blockedUrl} by ${message.author.tag} - Action: ${punishment}`);

        } catch (error) {
            console.error('Error handling link violation:', error);
        }
    }

    /**
     * Apply punishment based on configuration
     */
    async applyPunishment(message, punishment, blockedUrl) {
        try {
            const member = message.member;
            if (!member) return;

            // Always try to notify user via DM for delete_warn and stronger actions
            const shouldDm = ['delete_warn', 'timeout', 'kick', 'ban'].includes(punishment);
            if (shouldDm) {
                const embed = this.buildViolationEmbed(message, blockedUrl, punishment);
                await this.trySendDm(member, embed);
            }

            switch (punishment) {
                case 'delete':
                    // Message already deleted, no additional action
                    break;

                case 'delete_warn':
                    // DM already attempted above
                    break;

                case 'timeout':
                    // Timeout user for 5 minutes
                    try {
                        await member.timeout(5 * 60 * 1000, 'Sent blocked link');
                    } catch (timeoutError) {
                        console.error('Failed to timeout user:', timeoutError);
                    }
                    break;

                case 'kick':
                    try {
                        await member.kick('Sent blocked link');
                    } catch (kickError) {
                        console.error('Failed to kick user:', kickError);
                    }
                    break;

                case 'ban':
                    try {
                        await member.ban({ reason: 'Sent blocked link' });
                    } catch (banError) {
                        console.error('Failed to ban user:', banError);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error applying punishment:', error);
        }
    }

    buildViolationEmbed(message, blockedUrl, punishment) {
        const guild = message.guild;
        const actionText = this.getActionText(punishment);
        const embed = new EmbedBuilder()
            .setColor(0xff4747)
            .setTitle('Link Blocked')
            .setDescription('Your message contained a link that is not allowed in this server and has been removed.')
            .addFields(
                { name: 'Server', value: guild?.name || 'This server', inline: true },
                { name: 'Action', value: actionText, inline: true },
            )
            .setFooter({ text: 'If you believe this was a mistake, contact the server moderation team.' })
            .setTimestamp();

        if (blockedUrl) {
            embed.addFields({ name: 'Link', value: blockedUrl.slice(0, 1024) });
        }
        if (guild?.iconURL) {
            try { embed.setThumbnail(guild.iconURL({ size: 128 })); } catch {}
        }
        return embed;
    }

    async trySendDm(member, embed) {
        try {
            await member.send({ embeds: [embed] });
            console.log(`📩 Sent DM warning to ${member.user?.tag || member.id}`);
        } catch (dmError) {
            // Handle DM disabled or other errors gracefully
            console.log(`⚠️ Could not DM ${member.user?.tag || member.id}:`, dmError?.message || dmError);
        }
    }

    /**
     * Get human-readable action text
     */
    getActionText(punishment) {
        switch (punishment) {
            case 'delete':
                return 'Delete Message';
            case 'delete_warn':
                return 'Delete Message + Warn User';
            case 'timeout':
                return 'Time Out User (5 minutes)';
            case 'kick':
                return 'Kick User (Can\'t join for 1 hour)';
            case 'ban':
                return 'Ban User';
            default:
                return 'Delete Message';
        }
    }

    /**
     * Log violation to database
     */
    async logViolation(message, blockedUrl, action) {
        try {
            // This would log to the link_violations table
            console.log(`Logging violation: ${message.author.id} in ${message.guild.id} - ${blockedUrl}`);
        } catch (error) {
            console.error('Error logging violation:', error);
        }
    }
}

module.exports = new LinkProtectionHandler();
