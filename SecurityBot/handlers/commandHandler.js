const fs = require('fs').promises;
const path = require('path');

async function loadCommands(client) {
    const commandsPath = path.join(__dirname, '..', 'commands');
    
    try {
        // Check if commands directory exists
        await fs.access(commandsPath);
        
        // Read all files in the commands directory
        const commandFiles = await fs.readdir(commandsPath);
        const jsFiles = commandFiles.filter(file => file.endsWith('.js'));
        
        let loadedCommands = 0;
        
        for (const file of jsFiles) {
            const filePath = path.join(commandsPath, file);
            
            try {
                // Clear require cache to allow hot reloading
                delete require.cache[require.resolve(filePath)];
                
                const command = require(filePath);
                
                // Validate command structure
                if (!command.data || !command.execute) {
                    console.warn(`⚠️  Command ${file} is missing required properties (data or execute)`);
                    continue;
                }
                
                // Add command to collection
                client.commands.set(command.data.name, command);
                loadedCommands++;
                
                console.log(`✅ Loaded command: ${command.data.name}`);
                
            } catch (error) {
                console.error(`❌ Failed to load command ${file}:`, error);
            }
        }
        
        console.log(`📦 Successfully loaded ${loadedCommands} commands`);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('📁 Commands directory not found, creating it...');
            await fs.mkdir(commandsPath, { recursive: true });
            console.log('✅ Commands directory created');
        } else {
            console.error('❌ Error loading commands:', error);
        }
    }
}

async function reloadCommand(client, commandName) {
    const commandsPath = path.join(__dirname, '..', 'commands');
    const filePath = path.join(commandsPath, `${commandName}.js`);
    
    try {
        // Clear require cache
        delete require.cache[require.resolve(filePath)];
        
        // Reload command
        const command = require(filePath);
        
        if (!command.data || !command.execute) {
            throw new Error('Command is missing required properties');
        }
        
        client.commands.set(command.data.name, command);
        console.log(`🔄 Reloaded command: ${commandName}`);
        
        return true;
    } catch (error) {
        console.error(`❌ Failed to reload command ${commandName}:`, error);
        return false;
    }
}

module.exports = {
    loadCommands,
    reloadCommand
};
