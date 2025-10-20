const verification = require('../handlers/verification');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      await verification.handleMemberJoin(member);
    } catch (e) {
      console.error('guildMemberAdd handler error:', e);
    }
  }
};

