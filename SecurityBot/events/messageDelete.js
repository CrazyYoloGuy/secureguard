const verification = require('../handlers/verification');
const database = require('../services/database');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    try {
      const guild = message.guild;
      if (!guild) return;
      const settings = await database.getServerSettings(guild.id);
      const cfg = settings?.member_verification?.config || {};
      if (!settings?.member_verification) return;
      // If the verification message was deleted, disable and purge
      if (cfg.message_id && message.id === cfg.message_id) {
        await verification.disableAndPurge(guild, 'Verification message deleted by user');
      }
    } catch (e) {
      console.error('messageDelete verification handler error:', e);
    }
  }
};

