const { ActivityType } = require('discord.js');
const database = require('../services/database');
const verification = require('../handlers/verification');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`🚀 ${client.user.tag} is now online!`);
        console.log(`📊 Serving ${client.guilds.cache.size} servers`);
        console.log(`👥 Watching over ${client.users.cache.size} users`);

        // Initialize server profiles for all servers the bot is in
        await database.initializeAllServerProfiles(client.guilds.cache);

        // Ensure verification setup for all guilds where it's enabled
        // Add a small delay to allow Discord caches to populate
        setTimeout(async () => {
            try {
                console.log('🔄 Starting verification setup for all guilds...');
                for (const [, guild] of client.guilds.cache) {
                    try {
                        await verification.ensureForGuild(client, guild);
                    } catch (guildError) {
                        console.error(`Failed to ensure verification for guild ${guild.name} (${guild.id}):`, guildError);
                    }
                }
                console.log('✅ Initial verification setup completed');

                // Periodically re-ensure to pick up dashboard changes
                // Start with longer interval, then reduce after initial stability
                let intervalTime = 30000; // Start with 30 seconds
                const periodicCheck = setInterval(async () => {
                    try {
                        for (const [, g] of client.guilds.cache) {
                            await verification.ensureForGuild(client, g);
                        }
                        // After 5 minutes, reduce to 10 second intervals for better UX
                        if (intervalTime > 10000) {
                            clearInterval(periodicCheck);
                            setInterval(async () => {
                                try {
                                    for (const [, g] of client.guilds.cache) {
                                        await verification.ensureForGuild(client, g);
                                    }
                                } catch (ie) {
                                    console.error('Periodic verification ensure failed:', ie);
                                }
                            }, 10000);
                            console.log('🔄 Switched to faster verification check interval');
                        }
                    } catch (ie) {
                        console.error('Periodic verification ensure failed:', ie);
                    }
                }, intervalTime);

                // Switch to faster interval after 5 minutes
                setTimeout(() => {
                    intervalTime = 10000;
                }, 300000);
            } catch (e) {
                console.error('Verification ensure pass failed on ready:', e);
            }
        }, 2000); // 2 second delay to allow caches to populate

        // Set bot activity/status
        client.user.setActivity({
            name: 'Protecting servers 🛡️',
            type: ActivityType.Watching
        });

        // Log some basic bot information
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🤖 SecurityBot is ready for action!');
        console.log(`📋 Commands loaded: ${client.commands.size}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
};
