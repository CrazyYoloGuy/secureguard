const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType } = require('discord.js');
const database = require('../services/database');

class VerificationHandler {
  constructor() {
    // Cooldown to prevent aggressive disabling (guild_id -> timestamp)
    this.disableCooldowns = new Map();
    // Cooldown for enable/disable actions (guild_id -> timestamp)
    this.actionCooldowns = new Map();
  }


  async disableAndPurge(guild, reason = 'Verification disabled or resources missing') {
    try {
      // For manual disables (from dashboard), skip cooldown to be responsive
      const isManualDisable = reason.includes('pending_disable') || reason.includes('Manual disable');

      if (!isManualDisable) {
        // Check cooldown only for automatic disables (5 minute cooldown)
        const now = Date.now();
        const lastDisable = this.disableCooldowns.get(guild.id);
        if (lastDisable && (now - lastDisable) < 300000) { // 5 minutes
          console.log(`⏳ Skipping disable for ${guild.name} - cooldown active (${Math.round((300000 - (now - lastDisable)) / 1000)}s remaining)`);
          return;
        }
        this.disableCooldowns.set(guild.id, now);
      }

      const settings = await database.getServerSettings(guild.id);
      const cfg = settings?.member_verification?.config || {};

      console.log(`🧹 Starting fast cleanup for ${guild.name}: ${reason}`);
      let cleanupResults = {
        message: false,
        channel: false,
        unverifiedRole: false,
        memberRoleUpdates: 0,
        config: false
      };

      // Run cleanup operations in parallel for speed
      const cleanupPromises = [];

      // 1. Delete verification message and channel (parallel)
      if (cfg.channel_id) {
        cleanupPromises.push(
          (async () => {
            try {
              const channel = guild.channels.cache.get(cfg.channel_id) || await guild.channels.fetch(cfg.channel_id).catch(() => null);
              if (channel) {
                // First try to delete the message if it exists
                if (cfg.message_id && channel.isTextBased()) {
                  try {
                    const msg = await channel.messages.fetch(cfg.message_id).catch(() => null);
                    if (msg && msg.deletable) {
                      await msg.delete();
                      cleanupResults.message = true;
                      console.log(`✅ Deleted verification message in ${guild.name}#${channel.name}`);
                    }
                  } catch (e) {
                    console.warn(`⚠️ Could not delete verification message:`, e.message);
                  }
                }

                // Then delete the entire channel
                if (channel.deletable) {
                  await channel.delete('Verification system disabled - cleaning up verification channel');
                  cleanupResults.channel = true;
                  console.log(`✅ Deleted verification channel #${channel.name} in ${guild.name}`);
                } else {
                  console.warn(`⚠️ Cannot delete verification channel #${channel.name} - insufficient permissions`);
                }
              } else {
                console.log(`ℹ️ Verification channel already deleted or not found in ${guild.name}`);
                cleanupResults.channel = true; // Consider it cleaned up
              }
            } catch (e) {
              console.warn(`⚠️ Could not delete verification channel in ${guild.name}:`, e.message);
              // If channel doesn't exist, that's fine - consider it cleaned up
              if (e.code === 10003) { // Unknown Channel
                cleanupResults.channel = true;
              }
            }
          })()
        );
      }

      // 2. Handle Unverified role cleanup (parallel)
      if (cfg.unverified_role_id) {
        cleanupPromises.push(
          (async () => {
            try {
              const unverifiedRole = guild.roles.cache.get(cfg.unverified_role_id) || await guild.roles.fetch(cfg.unverified_role_id).catch(() => null);
              if (unverifiedRole) {
                // For manual disables, do fast cleanup - just delete the role
                // Discord will automatically remove it from all members
                if (isManualDisable) {
                  if (unverifiedRole.deletable) {
                    await unverifiedRole.delete(`Verification system disabled: ${reason}`);
                    cleanupResults.unverifiedRole = true;
                    cleanupResults.memberRoleUpdates = unverifiedRole.members.size; // Estimate
                    console.log(`✅ Fast deleted Unverified role from ${cleanupResults.memberRoleUpdates} members in ${guild.name}`);
                  } else {
                    console.warn(`⚠️ Cannot delete Unverified role - insufficient permissions`);
                  }
                } else {
                  // For automatic disables, do careful cleanup
                  const membersWithRole = unverifiedRole.members;
                  console.log(`🔄 Removing Unverified role from ${membersWithRole.size} members in ${guild.name}`);

                  // Process in batches to avoid rate limits
                  const memberArray = Array.from(membersWithRole.values());
                  const batchSize = 5;

                  for (let i = 0; i < memberArray.length; i += batchSize) {
                    const batch = memberArray.slice(i, i + batchSize);
                    await Promise.all(batch.map(async (member) => {
                      try {
                        await member.roles.remove(unverifiedRole.id, `Verification system disabled: ${reason}`);
                        cleanupResults.memberRoleUpdates++;
                      } catch (e) {
                        console.warn(`⚠️ Could not remove Unverified role from ${member.user.tag}:`, e.message);
                      }
                    }));
                  }

                  // Delete the role itself
                  if (unverifiedRole.deletable) {
                    await unverifiedRole.delete(`Verification system disabled: ${reason}`);
                    cleanupResults.unverifiedRole = true;
                    console.log(`✅ Deleted Unverified role in ${guild.name}`);
                  }
                }
              }
            } catch (e) {
              console.warn(`⚠️ Could not clean up Unverified role in ${guild.name}:`, e.message);
            }
          })()
        );
      }

      // 3. Clear database config immediately (don't wait for other operations)
      try {
        await database.updateFeatureSetting(guild.id, 'member_verification', false, {});
        cleanupResults.config = true;
        console.log(`✅ Cleared verification config in database for ${guild.name}`);
      } catch (e) {
        console.error(`❌ Failed to clear verification config for ${guild.name}:`, e.message);
      }

      // Wait for all cleanup operations to complete
      await Promise.allSettled(cleanupPromises);

      // Log comprehensive cleanup results
      console.log(`🧹 Fast cleanup completed for ${guild.name}:`, {
        reason,
        results: cleanupResults,
        timestamp: new Date().toISOString(),
        isManualDisable
      });

      console.log(`⚠️ Verification system fully disabled and cleaned up in ${guild.name}: ${reason}`);
    } catch (e) {
      console.error(`❌ Critical error during disableAndPurge for ${guild.name}:`, e);
    }
  }

  async ensureForGuild(client, guild) {
    try {
      const settings = await database.getServerSettings(guild.id);
      const feature = settings?.member_verification;
      const cfg = feature?.config || {};

      console.log(`🔍 Checking verification for ${guild.name} (${guild.id}): enabled=${!!feature?.enabled}, has_config=${!!cfg}`);

      // Handle disabled state with leftover config or explicit pending disable
      if (!feature || !feature.enabled) {
        if (cfg?.message_id || cfg?.unverified_role_id || cfg?.pending_disable || cfg?.channel_id || cfg?.member_role_id) {
          console.log(`🧹 Cleaning up leftover verification config for ${guild.name}`);
          const reason = cfg?.manual_disable ? 'Manual disable from dashboard' : 'Cleanup after disable or resource removal';
          await this.disableAndPurge(guild, reason);
        }
        return;
      }

      // Enabled: validate member role first
      if (!cfg.member_role_id) {
        console.warn(`Verification misconfigured for ${guild.name} (${guild.id}) - missing member role`);
        await this.disableAndPurge(guild, 'Missing required member role');
        return;
      }

      // Auto-create channel if needed (BEFORE checking if channel exists)
      console.log(`🔍 Channel check for ${guild.name}: channel_id=${cfg.channel_id}, auto_create=${cfg.auto_create_channel}`);
      if (!cfg.channel_id && cfg.auto_create_channel) {
        console.log(`🔧 Auto-creating verification channel for ${guild.name}`);
        try {
          // First ensure we have the unverified role
          let unverifiedRole = null;
          if (cfg.unverified_role_id) {
            unverifiedRole = guild.roles.cache.get(cfg.unverified_role_id) || await guild.roles.fetch(cfg.unverified_role_id).catch(() => null);
          }

          if (!unverifiedRole) {
            unverifiedRole = await guild.roles.create({
              name: 'Unverified',
              mentionable: false,
              hoist: false,
              reason: 'Verification system setup - auto channel creation',
            });
            cfg.unverified_role_id = unverifiedRole.id;
            console.log(`✅ Created Unverified role for channel setup in ${guild.name}`);
          }

          // Create channel with proper permissions
          const channel = await guild.channels.create({
            name: '✅verification',
            type: 0, // Text channel
            topic: 'Complete verification to gain access to the server',
            reason: 'Automatic verification channel creation',
            permissionOverwrites: [
              {
                id: guild.roles.everyone.id,
                deny: ['ViewChannel'], // Hide from everyone by default
              },
              {
                id: unverifiedRole.id,
                allow: ['ViewChannel', 'ReadMessageHistory'], // Only unverified can see
                deny: ['SendMessages', 'AddReactions'], // But can't send messages
              },
            ],
          });

          cfg.channel_id = channel.id;

          // Update the database with the new channel ID
          await database.updateFeatureSetting(guild.id, 'member_verification', true, cfg);
          console.log(`✅ Created verification channel #${channel.name} with proper permissions in ${guild.name}`);

          // Refresh settings after creating channel
          const updatedSettings = await database.getServerSettings(guild.id);
          const updatedCfg = updatedSettings?.member_verification?.config || {};
          Object.assign(cfg, updatedCfg); // Update local config with database values

        } catch (e) {
          console.error(`Failed to create verification channel in ${guild.name}:`, e?.message || e);
          await this.disableAndPurge(guild, 'Failed to create verification channel');
          return;
        }
      }

      // Now check if we have a channel (after auto-creation attempt)
      if (!cfg.channel_id) {
        console.warn(`Verification misconfigured for ${guild.name} (${guild.id}) - missing channel after setup attempt`);
        await this.disableAndPurge(guild, 'Missing required channel after setup');
        return;
      }

      // Validate member role exists - use fetch to ensure we get fresh data
      let memberRole = guild.roles.cache.get(cfg.member_role_id);
      if (!memberRole) {
        try {
          memberRole = await guild.roles.fetch(cfg.member_role_id);
        } catch (e) {
          console.warn(`Member role ${cfg.member_role_id} was deleted in ${guild.name} - continuing without role assignment`);
          // Don't disable verification for missing member role, just log warning
        }
      }

      // Validate verification channel exists - CRITICAL for system operation
      let channel = guild.channels.cache.get(cfg.channel_id);
      if (!channel) {
        try {
          channel = await guild.channels.fetch(cfg.channel_id);
        } catch (e) {
          console.warn(`Verification channel ${cfg.channel_id} was deleted in ${guild.name} - disabling verification system`);
          await this.disableAndPurge(guild, 'Verification channel was deleted by user');
          return;
        }
      }

      // Validate unverified role exists - CRITICAL for system operation
      if (cfg.unverified_role_id) {
        let unverifiedRole = guild.roles.cache.get(cfg.unverified_role_id);
        if (!unverifiedRole) {
          try {
            unverifiedRole = await guild.roles.fetch(cfg.unverified_role_id);
          } catch (e) {
            console.warn(`Unverified role ${cfg.unverified_role_id} was deleted in ${guild.name} - disabling verification system`);
            await this.disableAndPurge(guild, 'Unverified role was deleted by user');
            return;
          }
        }
      }

      // Validate verification message exists - CRITICAL for system operation
      if (cfg.message_id && channel && channel.isTextBased()) {
        try {
          const verificationMessage = await channel.messages.fetch(cfg.message_id);
          if (!verificationMessage) {
            console.warn(`Verification message ${cfg.message_id} was deleted in ${guild.name} - disabling verification system`);
            await this.disableAndPurge(guild, 'Verification message was deleted by user');
            return;
          }
        } catch (e) {
          if (e.code === 10008) { // Unknown Message
            console.warn(`Verification message ${cfg.message_id} was deleted in ${guild.name} - disabling verification system`);
            await this.disableAndPurge(guild, 'Verification message was deleted by user');
            return;
          }
        }
      }

      if (!channel || !channel.isTextBased()) {
        console.warn(`Verification channel ${cfg.channel_id} is not a text channel in ${guild.name}, disabling verification`);
        await this.disableAndPurge(guild, 'Verification channel not text-based');
        return;
      }

      // Ensure Unverified role exists
      let unverifiedRole = cfg.unverified_role_id ? guild.roles.cache.get(cfg.unverified_role_id) : null;
      if (!unverifiedRole && cfg.unverified_role_id) {
        try {
          unverifiedRole = await guild.roles.fetch(cfg.unverified_role_id);
        } catch (e) {
          // Role doesn't exist, we'll create a new one below
          unverifiedRole = null;
        }
      }

      if (!unverifiedRole) {
        try {
          unverifiedRole = await guild.roles.create({
            name: 'Unverified',
            mentionable: false,
            hoist: false,
            reason: 'Member verification setup',
          });
          cfg.unverified_role_id = unverifiedRole.id;
          await database.updateFeatureSetting(guild.id, 'member_verification', true, cfg);
          console.log(`✅ Created Unverified role in ${guild.name}`);
        } catch (e) {
          console.error(`Failed creating Unverified role in ${guild.name}:`, e?.message || e);
          await this.disableAndPurge(guild, 'Failed to ensure Unverified role');
          return;
        }
      }

      // Ensure verification message exists - use more robust message validation
      if (cfg.message_id) {
        let existing = null;
        try {
          // First try cache, then fetch from API
          existing = channel.messages.cache.get(cfg.message_id);
          if (!existing) {
            existing = await channel.messages.fetch(cfg.message_id);
          }
        } catch (e) {
          // Message doesn't exist or we can't access it
          console.warn(`Verification message ${cfg.message_id} not found in ${guild.name}#${channel.name}, recreating...`);
          existing = null;
        }

        if (!existing) {
          // Recreate the verification message instead of disabling
          const embed = new EmbedBuilder()
            .setColor(0x5865F2) // Discord Blurple
            .setTitle('🛡️ Server Verification Required')
            .setDescription(`Welcome to **${guild.name}**! To ensure the security and quality of our community, all new members must complete verification before gaining full access to the server.`)
            .addFields(
              {
                name: '📋 Verification Process',
                value: '• Click the **Verify** button below\n• You will instantly receive the member role\n• Gain access to all server channels and features\n• Help us maintain a secure community',
                inline: false
              },
              {
                name: '🔒 Why Verification?',
                value: 'Verification helps us:\n• Prevent spam and bot accounts\n• Maintain server security\n• Ensure genuine community members\n• Protect against raids and malicious users',
                inline: true
              },
              {
                name: '⚡ Quick & Easy',
                value: 'The verification process is:\n• **Instant** - No waiting required\n• **Simple** - Just one click\n• **Secure** - Protects everyone\n• **Automatic** - No manual approval',
                inline: true
              },
              {
                name: '❓ Need Help?',
                value: 'If you encounter any issues with verification, please contact a server administrator or moderator for assistance.',
                inline: false
              }
            )
            .setFooter({
              text: `${guild.name} Security System • Powered by Security Bot`,
              iconURL: guild.iconURL() || undefined
            })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('verify_simple')
              .setLabel('✅ Verify & Join Server')
              .setStyle(ButtonStyle.Success)
              .setEmoji('🛡️')
          );

          try {
            const sent = await channel.send({ embeds: [embed], components: [row] });
            cfg.message_id = sent.id;
            await database.updateFeatureSetting(guild.id, 'member_verification', true, cfg);
            console.log(`✅ Recreated enhanced verification message in ${guild.name}#${channel.name}`);
          } catch (e) {
            console.error(`Failed to recreate verification message in ${guild.name}:`, e?.message || e);
            await this.disableAndPurge(guild, 'Failed to recreate verification message');
            return;
          }
        }
      } else {
        // If there was never a message, create it (initial setup)
        const embed = new EmbedBuilder()
          .setColor(0x5865F2) // Discord Blurple
          .setTitle('🛡️ Server Verification Required')
          .setDescription(`Welcome to **${guild.name}**! To ensure the security and quality of our community, all new members must complete verification before gaining full access to the server.`)
          .addFields(
            {
              name: '📋 Verification Process',
              value: '• Click the **Verify** button below\n• You will instantly receive the member role\n• Gain access to all server channels and features\n• Help us maintain a secure community',
              inline: false
            },
            {
              name: '🔒 Why Verification?',
              value: 'Verification helps us:\n• Prevent spam and bot accounts\n• Maintain server security\n• Ensure genuine community members\n• Protect against raids and malicious users',
              inline: true
            },
            {
              name: '⚡ Quick & Easy',
              value: 'The verification process is:\n• **Instant** - No waiting required\n• **Simple** - Just one click\n• **Secure** - Protects everyone\n• **Automatic** - No manual approval',
              inline: true
            },
            {
              name: '❓ Need Help?',
              value: 'If you encounter any issues with verification, please contact a server administrator or moderator for assistance.',
              inline: false
            }
          )
          .setFooter({
            text: `${guild.name} Security System • Powered by Security Bot`,
            iconURL: guild.iconURL() || undefined
          })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('verify_simple')
            .setLabel('✅ Verify & Join Server')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🛡️')
        );

        try {
          const sent = await channel.send({ embeds: [embed], components: [row] });
          cfg.message_id = sent.id;
          await database.updateFeatureSetting(guild.id, 'member_verification', true, cfg);
          console.log(`✅ Posted enhanced verification message in ${guild.name}#${channel.name}`);
        } catch (e) {
          console.error(`Failed to send verification message in ${guild.name}:`, e?.message || e);
          await this.disableAndPurge(guild, 'Failed to post verification message');
          return;
        }
      }
    } catch (e) {
      console.error('ensureForGuild error:', e);
    }
  }

  async handleMemberJoin(member) {
    try {
      const guild = member.guild;
      const settings = await database.getServerSettings(guild.id);
      const feature = settings?.member_verification;
      if (!feature || !feature.enabled) return;
      const cfg = feature.config || {};
      if (!cfg.unverified_role_id) return;

      const unverifiedRole = guild.roles.cache.get(cfg.unverified_role_id);
      if (!unverifiedRole) return;

      // Set only Unverified role (removes others)
      try {
        await member.roles.set([unverifiedRole.id], 'Verification: assign Unverified on join');
      } catch (e) {
        console.error('Failed to set roles on join:', e?.message || e);
      }
      // Extra safety after 2s
      await new Promise(r => setTimeout(r, 2000));
      try {
        const current = member.roles.cache.has(unverifiedRole.id) ? [unverifiedRole.id] : [];
        await member.roles.set(current, 'Verification: ensure only Unverified');
      } catch (e) {
        console.error('Second pass role set failed:', e?.message || e);
      }
    } catch (e) {
      console.error('handleMemberJoin error:', e);
    }
  }

  async handleVerifyButton(interaction) {
    try {
      const guild = interaction.guild;
      if (!guild || !interaction.isButton()) return;
      if (interaction.customId !== 'verify_simple') return;

      const settings = await database.getServerSettings(guild.id);
      const feature = settings?.member_verification;
      if (!feature || !feature.enabled) {
        return interaction.reply({ content: 'Verification is not enabled.', ephemeral: true });
      }
      const cfg = feature.config || {};
      const memberRole = cfg.member_role_id ? guild.roles.cache.get(cfg.member_role_id) : null;
      const unverifiedRole = cfg.unverified_role_id ? guild.roles.cache.get(cfg.unverified_role_id) : null;
      if (!memberRole) {
        return interaction.reply({ content: 'Member role not configured.', ephemeral: true });
      }
      const member = interaction.member;

      // If the member already has the member role, treat as already verified
      if (member.roles.cache.has(memberRole.id)) {
        return interaction.reply({ content: '✅ You are already verified.', ephemeral: true });
      }

      try {
        // Remove Unverified if present, otherwise just grant member role
        if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
          await member.roles.remove(unverifiedRole.id, 'Verified via button');
        }
        await member.roles.add(memberRole.id, 'Verified via button');

        // Create a professional success embed
        const successEmbed = new EmbedBuilder()
          .setColor(0x00FF00) // Green for success
          .setTitle('🎉 Verification Successful!')
          .setDescription(`Welcome to **${guild.name}**, ${member.displayName}!`)
          .addFields(
            {
              name: '✅ Access Granted',
              value: `• You now have the ${memberRole} role\n• Full server access has been unlocked\n• You can now participate in all channels\n• Welcome to our community!`,
              inline: false
            },
            {
              name: '📚 Next Steps',
              value: '• Read the server rules and guidelines\n• Introduce yourself if there\'s an intro channel\n• Explore the different channels\n• Have fun and be respectful!',
              inline: false
            }
          )
          .setFooter({
            text: `${guild.name} Security System`,
            iconURL: guild.iconURL() || undefined
          })
          .setTimestamp();

        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
      } catch (e) {
        console.error('Verify button role update failed:', e?.message || e);

        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000) // Red for error
          .setTitle('❌ Verification Failed')
          .setDescription('There was an error updating your roles. Please try again or contact a server administrator.')
          .addFields({
            name: '🆘 Need Help?',
            value: 'If this problem persists, please:\n• Contact a server moderator\n• Try leaving and rejoining the server\n• Report this issue to server staff',
            inline: false
          })
          .setFooter({ text: 'Security Bot Error Handler' })
          .setTimestamp();

        try {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        } catch {}
      }
    } catch (e) {
      console.error('handleVerifyButton error:', e);
    }
  }
}

module.exports = new VerificationHandler();

