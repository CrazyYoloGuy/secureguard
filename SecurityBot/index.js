const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const database = require('./services/database');
const path = require('path');

// Load environment variables from parent directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Create Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ]
});

// Initialize collections for commands and cooldowns
client.commands = new Collection();
client.cooldowns = new Collection();

// Load handlers
async function initializeBot() {
    try {
        console.log('🔄 Testing database connection...');
        await database.testConnection();

        console.log('🔄 Loading commands...');
        await loadCommands(client);

        console.log('🔄 Loading events...');
        await loadEvents(client);

        console.log('🔄 Logging in to Discord...');
        await client.login(process.env.DISCORD_TOKEN);

        // Deploy commands after login so we have the application/bot ID
        console.log('🔄 Deploying slash commands...');
        await deployCommands(client);

    } catch (error) {
        console.error('❌ Failed to initialize bot:', error);
        process.exit(1);
    }
}

// Deploy commands function
async function deployCommands(client) {
    try {
        const { REST, Routes } = require('discord.js');
        const fs = require('fs');
        const path = require('path');

        const commands = [];
        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        // Load each command
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);

            if (command.data && command.execute) {
                commands.push(command.data.toJSON());
                console.log(`✅ Loaded command: ${command.data.name}`);
            } else {
                console.log(`⚠️  Command at ${filePath} is missing required "data" or "execute" property.`);
            }
        }

        // Deploy commands using the logged-in bot's application ID
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        const applicationId = client?.application?.id || client?.user?.id || process.env.DISCORD_CLIENT_ID;

        if (!applicationId) {
            console.error('❌ Cannot deploy commands: application ID not available.');
            return;
        }

        console.log(`🚀 Refreshing ${commands.length} application (/) commands for app ${applicationId}.`);

        const data = await rest.put(
            Routes.applicationCommands(applicationId),
            { body: commands },
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        // Don't exit on command deployment error, just log it
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('🔄 Shutting down bot...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🔄 Shutting down bot...');
    client.destroy();
    process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Initialize the bot
initializeBot();
