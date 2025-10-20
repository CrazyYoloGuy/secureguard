module.exports = {
    name: 'guildCreate',
    async execute(guild, client) {
        console.log(`🎉 Joined new server: ${guild.name} (${guild.id})`);
        console.log(`👥 Server has ${guild.memberCount} members`);
        console.log(`📊 Now serving ${client.guilds.cache.size} servers total`);
        
        // Try to send a welcome message to the system channel or first available text channel
        try {
            let welcomeChannel = guild.systemChannel;
            
            // If no system channel, find the first text channel the bot can send messages to
            if (!welcomeChannel) {
                welcomeChannel = guild.channels.cache
                    .filter(channel => 
                        channel.type === 0 && // Text channel
                        channel.permissionsFor(guild.members.me).has(['SendMessages', 'ViewChannel'])
                    )
                    .first();
            }
            
            if (welcomeChannel) {
                const welcomeEmbed = {
                    color: 0x00E5FF,
                    title: '🛡️ SecurityBot has joined your server!',
                    description: 'Thank you for adding SecurityBot to your server! I\'m here to help keep your community safe.',
                    fields: [
                        {
                            name: '🚀 Getting Started',
                            value: 'Use `/status` to check if I\'m working properly.',
                            inline: false
                        },
                        {
                            name: '⚙️ Setup',
                            value: 'More features and configuration options coming soon!',
                            inline: false
                        },
                        {
                            name: '🔗 Support',
                            value: 'Need help? Contact the bot developers.',
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'SecurityBot • Keeping your server safe',
                        icon_url: client.user.displayAvatarURL()
                    },
                    timestamp: new Date().toISOString()
                };
                
                await welcomeChannel.send({ embeds: [welcomeEmbed] });
                console.log(`📨 Sent welcome message to ${guild.name}`);
            }
            
        } catch (error) {
            console.error(`❌ Failed to send welcome message to ${guild.name}:`, error);
        }
    }
};
