const { REST, Routes } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function deployCommands() {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    
    try {
        // Read all command files
        const commandFiles = await fs.readdir(commandsPath);
        const jsFiles = commandFiles.filter(file => file.endsWith('.js'));
        
        // Load each command
        for (const file of jsFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            if (command.data && command.execute) {
                commands.push(command.data.toJSON());
                console.log(`✅ Loaded command: ${command.data.name}`);
            } else {
                console.warn(`⚠️  Command ${file} is missing required properties`);
            }
        }
        
        // Create REST instance
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        
        console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);
        
        // Deploy commands globally
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        
        console.log(`✅ Successfully reloaded ${data.length} application (/) commands globally.`);
        
        // Optional: Deploy to specific guild for testing (faster updates)
        if (process.env.GUILD_ID) {
            console.log('🔄 Also deploying to test guild...');
            
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            
            console.log(`✅ Successfully deployed commands to test guild.`);
        }
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        
        if (error.code === 50001) {
            console.error('❌ Missing Access: Make sure the bot has the applications.commands scope');
        } else if (error.code === 10002) {
            console.error('❌ Unknown Application: Check your CLIENT_ID in .env file');
        } else if (error.status === 401) {
            console.error('❌ Unauthorized: Check your DISCORD_TOKEN in .env file');
        }
        
        process.exit(1);
    }
}

// Run the deployment
deployCommands();
