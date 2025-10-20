const linkProtection = require('../handlers/linkProtection');
const antiSpam = require('../handlers/antiSpam');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // Debug logging
        console.log(`📨 Message received from ${message.author.tag} in ${message.guild?.name || 'DM'}: "${message.content}"`);

        // Ignore bot messages
        if (message.author.bot) {
            console.log(`🤖 Ignoring bot message from ${message.author.tag}`);
            return;
        }

        // Ignore DMs
        if (!message.guild) {
            console.log(`💬 Ignoring DM from ${message.author.tag}`);
            return;
        }

        try {
            console.log(`🔍 Processing message in ${message.guild.name} (${message.guild.id})`);

            // Link protection
            const linkAllowed = await linkProtection.handleMessage(message);
            if (!linkAllowed) {
                console.log(`🚫 Message blocked by link protection in ${message.guild.name}`);
                return;
            }

            // Anti-Spam
            const spamAllowed = await antiSpam.handleMessage(message);
            if (!spamAllowed) {
                console.log(`🚫 Message blocked by anti-spam in ${message.guild.name}`);
                return;
            }

            // Other handlers can follow here...

        } catch (error) {
            console.error('❌ Error in messageCreate event:', error);
        }
    }
};
