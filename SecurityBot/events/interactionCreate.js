const verification = require('../handlers/verification');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`❌ No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                // Check for cooldowns
                const { cooldowns } = client;

                if (!cooldowns.has(command.data.name)) {
                    cooldowns.set(command.data.name, new Map());
                }

                const now = Date.now();
                const timestamps = cooldowns.get(command.data.name);
                const defaultCooldownDuration = 3;
                const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;

                if (timestamps.has(interaction.user.id)) {
                    const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

                    if (now < expirationTime) {
                        const expiredTimestamp = Math.round(expirationTime / 1000);
                        return interaction.reply({
                            content: `⏰ Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
                            ephemeral: true
                        });
                    }
                }

                timestamps.set(interaction.user.id, now);
                setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

                // Execute the command
                await command.execute(interaction);

                // Log command usage
                console.log(`📝 ${interaction.user.tag} used /${command.data.name} in ${interaction.guild?.name || 'DM'}`);

            } catch (error) {
                console.error(`❌ Error executing command ${interaction.commandName}:`, error);

                const errorMessage = {
                    content: '❌ There was an error while executing this command!',
                    ephemeral: true
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        }

        // Handle button interactions
        else if (interaction.isButton()) {
            if (interaction.customId === 'verify_simple') {
                return verification.handleVerifyButton(interaction);
            }
            console.log(`🔘 Button interaction: ${interaction.customId}`);
        }

        // Handle select menu interactions
        else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'test_system_server_select') {
                const serverId = interaction.values[0];

                // Import the test function directly
                const { testSpecificServer } = require('../commands/test-system');

                try {
                    await testSpecificServer(interaction, serverId);
                } catch (error) {
                    console.error('Error executing test-system from select menu:', error);
                    const errorMessage = {
                        content: '❌ Error testing the selected server.',
                        ephemeral: true
                    };

                    if (interaction.replied || interaction.deferred) {
                        await interaction.editReply(errorMessage);
                    } else {
                        await interaction.reply(errorMessage);
                    }
                }
                return;
            }
            console.log(`📋 Select menu interaction: ${interaction.customId}`);
        }
    }
};
