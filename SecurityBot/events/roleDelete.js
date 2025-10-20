const verification = require('../handlers/verification');
const database = require('../services/database');

module.exports = {
  name: 'roleDelete',
  async execute(role) {
    try {
      const guild = role.guild;
      if (!guild) return;
      const settings = await database.getServerSettings(guild.id);
      const cfg = settings?.member_verification?.config || {};
      if (!settings?.member_verification) return;
      // If Unverified role or configured member role was deleted -> disable and purge
      if ((cfg.unverified_role_id && role.id === cfg.unverified_role_id) || (cfg.member_role_id && role.id === cfg.member_role_id)) {
        await verification.disableAndPurge(guild, 'Verification role deleted by user');
      }
    } catch (e) {
      console.error('roleDelete verification handler error:', e);
    }
  }
};

