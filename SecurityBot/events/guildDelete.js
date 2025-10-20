module.exports = {
    name: 'guildDelete',
    async execute(guild, client) {
        console.log(`👋 Left server: ${guild.name} (${guild.id})`);
        console.log(`📊 Now serving ${client.guilds.cache.size} servers total`);
        
        // Here you could add cleanup logic if needed
        // For example, removing server-specific data from a database
        
        // Log some basic info about the server we left
        if (guild.available) {
            console.log(`📊 Server had ${guild.memberCount} members`);
            console.log(`📅 Bot was in server for: ${Math.floor((Date.now() - guild.joinedTimestamp) / (1000 * 60 * 60 * 24))} days`);
        } else {
            console.log('⚠️  Server became unavailable (possibly due to outage)');
        }
    }
};
