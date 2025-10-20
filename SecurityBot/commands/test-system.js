const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const database = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-system')
        .setDescription('Test and view security system status for servers')
        .addStringOption(option =>
            option.setName('server')
                .setDescription('Server ID to test (leave empty to select from list)')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const serverId = interaction.options.getString('server');
            
            if (serverId) {
                // Direct server test
                await testSpecificServer(interaction, serverId);
            } else {
                // Show server selection menu
                await showServerSelection(interaction);
            }
        } catch (error) {
            console.error('Error in test-system command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Error')
                .setDescription('An error occurred while testing systems.')
                .setTimestamp();
            
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};

async function showServerSelection(interaction) {
    try {
        // Get all servers the bot is in
        const guilds = interaction.client.guilds.cache;
        
        if (guilds.size === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('⚠️ No Servers Found')
                .setDescription('The bot is not in any servers.')
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        // Create selection menu with up to 25 servers (Discord limit)
        const options = Array.from(guilds.values()).slice(0, 25).map(guild => ({
            label: guild.name.length > 100 ? guild.name.substring(0, 97) + '...' : guild.name,
            description: `ID: ${guild.id} | Members: ${guild.memberCount || 'Unknown'}`,
            value: guild.id
        }));
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('test_system_server_select')
            .setPlaceholder('Select a server to test...')
            .addOptions(options);
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        const embed = new EmbedBuilder()
            .setColor(0x00E5FF)
            .setTitle('🔧 Security System Test')
            .setDescription(`Select a server to test its security systems.\n\n**Available Servers:** ${guilds.size}`)
            .addFields({
                name: '📋 What will be tested:',
                value: '• Anti-Spam Protection\n• Link Protection\n• Member Verification\n• Database Configuration'
            })
            .setTimestamp();
        
        await interaction.reply({ 
            embeds: [embed], 
            components: [row], 
            ephemeral: true 
        });
        
    } catch (error) {
        console.error('Error showing server selection:', error);
        throw error;
    }
}

async function testSpecificServer(interaction, serverId) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        // Get guild info
        const guild = interaction.client.guilds.cache.get(serverId);
        if (!guild) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Server Not Found')
                .setDescription(`Server with ID \`${serverId}\` not found or bot is not in that server.`)
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }
        
        // Get server settings from database
        const settings = await database.getServerSettings(serverId);
        
        // Create main embed
        const mainEmbed = new EmbedBuilder()
            .setColor(0x00E5FF)
            .setTitle('🔧 Security System Test Results')
            .setDescription(`**Server:** ${guild.name}\n**ID:** ${serverId}\n**Members:** ${guild.memberCount || 'Unknown'}`)
            .addFields(
                {
                    name: '🚫 Anti-Spam Protection',
                    value: formatSystemStatus(settings.anti_spam),
                    inline: true
                },
                {
                    name: '🔗 Link Protection', 
                    value: formatSystemStatus(settings.link_protection),
                    inline: true
                },
                {
                    name: '✅ Member Verification',
                    value: formatSystemStatus(settings.member_verification),
                    inline: true
                }
            )
            .setFooter({ text: `Tested at ${new Date().toLocaleString()}` })
            .setTimestamp();
        
        // Create detailed embeds for each system
        const embeds = [mainEmbed];
        
        // Anti-Spam Details
        if (settings.anti_spam?.enabled) {
            const antiSpamEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🚫 Anti-Spam Protection - Details')
                .addFields(
                    { name: 'Max Messages', value: `${settings.anti_spam.config.max_messages || 5}`, inline: true },
                    { name: 'Time Window', value: `${settings.anti_spam.config.time_window || 5}s`, inline: true },
                    { name: 'Punishment', value: settings.anti_spam.config.punishment || 'delete', inline: true },
                    { name: 'Whitelisted Users', value: `${(settings.anti_spam.config.whitelist_users || []).length}`, inline: true },
                    { name: 'Whitelisted Roles', value: `${(settings.anti_spam.config.whitelist_roles || []).length}`, inline: true }
                );
            embeds.push(antiSpamEmbed);
        }
        
        // Link Protection Details
        if (settings.link_protection?.enabled) {
            const linkEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🔗 Link Protection - Details')
                .addFields(
                    { name: 'Block Suspicious', value: settings.link_protection.config.block_suspicious ? '✅ Yes' : '❌ No', inline: true },
                    { name: 'Scan Embeds', value: settings.link_protection.config.scan_embeds ? '✅ Yes' : '❌ No', inline: true },
                    { name: 'Punishment', value: settings.link_protection.config.punishment || 'delete', inline: true },
                    { name: 'Whitelisted Domains', value: `${(settings.link_protection.config.whitelist_domains || []).length}`, inline: true },
                    { name: 'Whitelisted Users', value: `${(settings.link_protection.config.whitelist_users || []).length}`, inline: true },
                    { name: 'Whitelisted Roles', value: `${(settings.link_protection.config.whitelist_roles || []).length}`, inline: true }
                );
            embeds.push(linkEmbed);
        }
        
        // Member Verification Details
        if (settings.member_verification?.enabled) {
            const verificationEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Member Verification - Details')
                .addFields(
                    { name: 'Type', value: settings.member_verification.config.verification_type || 'simple', inline: true },
                    { name: 'Member Role', value: settings.member_verification.config.member_role_id ? `<@&${settings.member_verification.config.member_role_id}>` : '❌ Not set', inline: true },
                    { name: 'Channel', value: settings.member_verification.config.channel_id ? `<#${settings.member_verification.config.channel_id}>` : '❌ Not set', inline: true },
                    { name: 'Unverified Role', value: settings.member_verification.config.unverified_role_id ? `<@&${settings.member_verification.config.unverified_role_id}>` : '❌ Not set', inline: true },
                    { name: 'Message ID', value: settings.member_verification.config.message_id ? `\`${settings.member_verification.config.message_id}\`` : '❌ Not set', inline: true }
                );
            embeds.push(verificationEmbed);
        }
        
        await interaction.editReply({ embeds });
        
    } catch (error) {
        console.error('Error testing specific server:', error);
        throw error;
    }
}

function formatSystemStatus(system) {
    if (!system) {
        return '❌ **DISABLED**\n*Not configured*';
    }

    if (system.enabled) {
        return '✅ **ACTIVE**\n*System operational*';
    } else {
        return '❌ **DISABLED**\n*System inactive*';
    }
}

// Export the testSpecificServer function for use in interaction handler
module.exports.testSpecificServer = testSpecificServer;
