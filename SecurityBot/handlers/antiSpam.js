const { EmbedBuilder } = require('discord.js');
const database = require('../services/database');

class AntiSpamHandler {
  constructor() {
    // In-memory trackers per guild -> user
    this.userActivity = new Map(); // guildId => Map(userId => { messages: [{t, c}], lastPrune: ts })
  }

  getGuildUserState(guildId, userId) {
    if (!this.userActivity.has(guildId)) this.userActivity.set(guildId, new Map());
    const g = this.userActivity.get(guildId);
    if (!g.has(userId)) g.set(userId, { messages: [], lastPrune: 0, tagHistory: new Map() });
    return g.get(userId);
  }

  pruneOld(state, now, maxAgeMs) {
    state.messages = state.messages.filter(m => now - m.t <= maxAgeMs);
    state.lastPrune = now;
  }


  ensureTagHistory(state, targetId) {
    if (!state.tagHistory) state.tagHistory = new Map();
    if (!state.tagHistory.has(targetId)) state.tagHistory.set(targetId, []);
    return state.tagHistory.get(targetId);
  }

  pruneTagHistory(state, now, maxAgeMs) {
    if (!state.tagHistory) return;
    for (const [tid, arr] of state.tagHistory.entries()) {
      const pruned = arr.filter(t => now - t <= maxAgeMs);
      if (pruned.length) {
        state.tagHistory.set(tid, pruned);
      } else {
        state.tagHistory.delete(tid);
      }
    }
  }


  async handleMessage(message) {
    try {
      if (!message.guild) return true; // DMs out of scope

      // Load settings
      const settings = await database.getServerSettings(message.guild.id);
      const feature = settings?.anti_spam;
      if (!feature || !feature.enabled) return true;

      const cfg = {
        max_messages: feature.config?.max_messages ?? 5,
        time_window: feature.config?.time_window ?? 5,
        duplicate_threshold: feature.config?.duplicate_threshold ?? 3,
        mentions_per_message: feature.config?.mentions_per_message ?? 5,
        same_user_tag_threshold: feature.config?.same_user_tag_threshold ?? 5,
        whitelist_roles: feature.config?.whitelist_roles || [],
        whitelist_users: (feature.config?.whitelist_users || []).map(String),
        punishment: feature.config?.punishment || 'delete'
      };

      // Whitelists
      if (this.isUserWhitelisted(message.author.id, message.member, cfg)) {
        return true;
      }

      const now = Date.now();
      const state = this.getGuildUserState(message.guild.id, message.author.id);

      // Normalize message content once for consistent duplicate checks
      const content = (message.content || '').trim().slice(0, 2000);

      // Record message (store normalized content)
      state.messages.push({ t: now, c: content });
      const windowMs = Math.max(5, cfg.time_window) * 1000;
      this.pruneOld(state, now, Math.max(windowMs, 30_000));

      // 1) Rate limit (messages within configured window)
      const rateCount = state.messages.filter(m => now - m.t <= windowMs).length;
      if (rateCount > cfg.max_messages) {
        await this.handleViolation(message, cfg, 'Message flood (rate limit exceeded)');
        return false;
      }

      // 2) Duplicate content within 30s (normalized exact match)
      const thirtySec = 30_000;
      const recent = state.messages.filter(m => now - m.t <= thirtySec);
      if (content) {
        const dupCount = recent.filter(m => m.c === content).length;
        if (dupCount >= cfg.duplicate_threshold) {
          await this.handleViolation(message, cfg, 'Repeated identical messages');
          return false;
        }
      }

      // 3) Excessive mentions in a single message (count occurrences, not unique)
      const userMentionMatches = content.match(/<@!?(\d{17,20})>/g) || [];
      const roleMentionMatches = content.match(/<@&(\d{17,20})>/g) || [];
      const everyoneMatches = content.match(/@everyone|@here/g) || [];
      const mentionCount = userMentionMatches.length + roleMentionMatches.length + everyoneMatches.length;
      if (mentionCount > cfg.mentions_per_message) {
        await this.handleViolation(message, cfg, `Too many mentions (${mentionCount}) in one message`);
        return false;
      }

      // 4) Tagging the SAME user too many times within 5 minutes
      const sameUserThreshold = Math.max(1, parseInt(cfg.same_user_tag_threshold ?? 5, 10));
      if (sameUserThreshold > 0 && userMentionMatches.length > 0) {
        const TAG_WINDOW = 5 * 60 * 1000; // 5 minutes
        // Extract user IDs for each mention occurrence
        const mentionedUserIds = [];
        content.replace(/<@!?(\d{17,20})>/g, (_, id) => { mentionedUserIds.push(String(id)); return _; });
        for (const uid of mentionedUserIds) {
          const arr = this.ensureTagHistory(state, uid);
          arr.push(now);
          const pruned = arr.filter(t => now - t <= TAG_WINDOW);
          state.tagHistory.set(uid, pruned);
          if (pruned.length > sameUserThreshold) {
            // Force delete + warn for this specific rule
            const cfgWarn = { ...cfg, punishment: 'delete_warn' };
            await this.handleViolation(message, cfgWarn, `Excessive tagging the same user (<@${uid}>) within 5 minutes`);
            return false;
          }
        }
        // Also prune other target histories occasionally
        this.pruneTagHistory(state, now, TAG_WINDOW);
      }

      return true;
    } catch (err) {
      console.error('AntiSpam handler error:', err);
      return true; // fail-open
    }
  }

  isUserWhitelisted(userId, member, cfg) {
    if (cfg.whitelist_users?.includes(String(userId))) return true;
    if (member?.roles?.cache && Array.isArray(cfg.whitelist_roles)) {
      const userRoles = member.roles.cache.map(r => r.id);
      if (cfg.whitelist_roles.some(rid => userRoles.includes(rid))) return true;
    }
    return false;
  }

  async handleViolation(message, cfg, reason) {
    try {
      // Always try to delete spam message first
      try { await message.delete(); } catch (e) { /* ignore */ }

      await this.applyPunishment(message, cfg.punishment, reason);
    } catch (e) {
      console.error('AntiSpam handleViolation error:', e);
    }
  }

  async applyPunishment(message, punishment, reason) {
    try {
      const member = message.member;
      if (!member) return;

      // DM notification for warn/timeout/kick/ban
      const shouldDm = ['delete_warn', 'timeout_10m', 'kick', 'ban'].includes(punishment);
      if (shouldDm) {
        const embed = this.buildEmbed(message, punishment, reason);
        await this.trySendDm(member, embed);
      }

      switch (punishment) {
        case 'delete':
          // already deleted
          break;
        case 'delete_warn':
          // DM sent above
          break;
        case 'timeout': // alias
        case 'timeout_10m':
          try { await member.timeout(10 * 60 * 1000, `Anti-Spam: ${reason}`); } catch (e) { console.error('Timeout failed:', e); }
          break;
        case 'kick':
          try { await member.kick(`Anti-Spam: ${reason}`); } catch (e) { console.error('Kick failed:', e); }
          break;
        case 'ban':
          try { await member.ban({ reason: `Anti-Spam: ${reason}` }); } catch (e) { console.error('Ban failed:', e); }
          break;
      }
    } catch (e) {
      console.error('AntiSpam applyPunishment error:', e);
    }
  }

  buildEmbed(message, punishment, reason) {
    const guild = message.guild;
    const actionText = this.getActionText(punishment);
    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle('Anti-Spam Action')
      .setDescription('We detected spam-like activity in your recent message.')
      .addFields(
        { name: 'Server', value: guild?.name || 'This server', inline: true },
        { name: 'Action', value: actionText, inline: true },
        { name: 'Reason', value: reason }
      )
      .setFooter({ text: 'If this was a mistake, please contact the moderation team.' })
      .setTimestamp();
    if (guild?.iconURL) {
      try { embed.setThumbnail(guild.iconURL({ size: 128 })); } catch {}
    }
    return embed;
  }

  getActionText(punishment) {
    switch (punishment) {
      case 'delete': return 'Delete Message';
      case 'delete_warn': return 'Delete Message + Warn User';
      case 'timeout':
      case 'timeout_10m': return 'Time Out (10 minutes)';
      case 'kick': return 'Kick User';
      case 'ban': return 'Ban User';
      default: return 'Delete Message';
    }
  }

  async trySendDm(member, embed) {
    try {
      await member.send({ embeds: [embed] });
      console.log(`📩 Sent Anti-Spam DM to ${member.user?.tag || member.id}`);
    } catch (e) {
      console.log(`⚠️ Could not DM ${member.user?.tag || member.id}:`, e?.message || e);
    }
  }
}

module.exports = new AntiSpamHandler();

