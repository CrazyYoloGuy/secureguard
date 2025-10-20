const verification = require('../handlers/verification');
const database = require('../services/database');

module.exports = {
  name: 'channelDelete',
  async execute(channel) {
    try {
      const guild = channel.guild;
      if (!guild) return;
      const settings = await database.getServerSettings(guild.id);
      const cfg = settings?.member_verification?.config || {};
      if (!settings?.member_verification) return;
      // If the verification channel was deleted -> disable and purge
      if (cfg.channel_id && channel.id === cfg.channel_id) {
        await verification.disableAndPurge(guild, 'Verification channel deleted by user');
      }
    } catch (e) {
      console.error('channelDelete verification handler error:', e);
    }
  }
};

