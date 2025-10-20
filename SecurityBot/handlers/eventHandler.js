const fs = require('fs').promises;
const path = require('path');

async function loadEvents(client) {
    const eventsPath = path.join(__dirname, '..', 'events');
    
    try {
        // Check if events directory exists
        await fs.access(eventsPath);
        
        // Read all files in the events directory
        const eventFiles = await fs.readdir(eventsPath);
        const jsFiles = eventFiles.filter(file => file.endsWith('.js'));
        
        let loadedEvents = 0;
        
        for (const file of jsFiles) {
            const filePath = path.join(eventsPath, file);
            
            try {
                // Clear require cache to allow hot reloading
                delete require.cache[require.resolve(filePath)];
                
                const event = require(filePath);
                
                // Validate event structure
                if (!event.name || !event.execute) {
                    console.warn(`⚠️  Event ${file} is missing required properties (name or execute)`);
                    continue;
                }
                
                // Register event listener
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args, client));
                } else {
                    client.on(event.name, (...args) => event.execute(...args, client));
                }
                
                loadedEvents++;
                console.log(`✅ Loaded event: ${event.name}`);
                
            } catch (error) {
                console.error(`❌ Failed to load event ${file}:`, error);
            }
        }
        
        console.log(`📦 Successfully loaded ${loadedEvents} events`);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('📁 Events directory not found, creating it...');
            await fs.mkdir(eventsPath, { recursive: true });
            console.log('✅ Events directory created');
        } else {
            console.error('❌ Error loading events:', error);
        }
    }
}

async function reloadEvent(client, eventName) {
    const eventsPath = path.join(__dirname, '..', 'events');
    const filePath = path.join(eventsPath, `${eventName}.js`);
    
    try {
        // Clear require cache
        delete require.cache[require.resolve(filePath)];
        
        // Remove existing listeners for this event
        client.removeAllListeners(eventName);
        
        // Reload event
        const event = require(filePath);
        
        if (!event.name || !event.execute) {
            throw new Error('Event is missing required properties');
        }
        
        // Re-register event listener
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        
        console.log(`🔄 Reloaded event: ${eventName}`);
        return true;
        
    } catch (error) {
        console.error(`❌ Failed to reload event ${eventName}:`, error);
        return false;
    }
}

module.exports = {
    loadEvents,
    reloadEvent
};
