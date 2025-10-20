const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Check if the bot is working properly'),
    
    cooldown: 5, // 5 seconds cooldown
    
    async execute(interaction) {
        try {
            // Calculate uptime
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            
            const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
            
            // Get memory usage
            const memoryUsage = process.memoryUsage();
            const memoryUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
            const memoryTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);
            
            // Get system info
            const cpuUsage = process.cpuUsage();
            const loadAverage = os.loadavg()[0].toFixed(2);
            
            // Calculate ping
            const ping = Date.now() - interaction.createdTimestamp;
            const apiPing = Math.round(interaction.client.ws.ping);
            
            // Create status embed
            const statusEmbed = new EmbedBuilder()
                .setColor(0x00FF00) // Green color for healthy status
                .setTitle('🤖 SecurityBot Status')
                .setDescription('**The bot is working properly!** ✅')
                .addFields(
                    {
                        name: '🏓 Latency',
                        value: `**Bot:** ${ping}ms\n**API:** ${apiPing}ms`,
                        inline: true
                    },
                    {
                        name: '⏱️ Uptime',
                        value: uptimeString,
                        inline: true
                    },
                    {
                        name: '💾 Memory Usage',
                        value: `${memoryUsed}MB / ${memoryTotal}MB`,
                        inline: true
                    },
                    {
                        name: '📊 Statistics',
                        value: `**Servers:** ${interaction.client.guilds.cache.size}\n**Users:** ${interaction.client.users.cache.size}\n**Commands:** ${interaction.client.commands.size}`,
                        inline: true
                    },
                    {
                        name: '🖥️ System',
                        value: `**Platform:** ${os.platform()}\n**Load:** ${loadAverage}\n**Node.js:** ${process.version}`,
                        inline: true
                    },
                    {
                        name: '🔧 Bot Info',
                        value: `**Version:** 1.0.0\n**Library:** Discord.js v14\n**Status:** Online`,
                        inline: true
                    }
                )
                .setFooter({
                    text: `Requested by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();
            
            // Add a status indicator based on performance
            let statusColor = 0x00FF00; // Green
            let statusText = 'Excellent';
            
            if (ping > 200 || apiPing > 200) {
                statusColor = 0xFFFF00; // Yellow
                statusText = 'Good';
            }
            
            if (ping > 500 || apiPing > 500) {
                statusColor = 0xFF0000; // Red
                statusText = 'Poor';
            }
            
            statusEmbed.setColor(statusColor);
            statusEmbed.setDescription(`**The bot is working properly!** ✅\n\n**Performance:** ${statusText}`);
            
            await interaction.reply({
                embeds: [statusEmbed]
            });
            
        } catch (error) {
            console.error('Error in status command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Error')
                .setDescription('There was an error checking the bot status.')
                .setTimestamp();
            
            await interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
    }
};
