# SecurityBot 🛡️

A Discord security bot with moderation features to help keep your server safe.

## Features

- ✅ **Status Command**: Check if the bot is working properly with `/status`
- 🔧 **Modular Design**: Easy to extend with new commands and features
- 📊 **Performance Monitoring**: Built-in latency and system monitoring
- 🎯 **Slash Commands**: Modern Discord slash command support
- 🔄 **Hot Reloading**: Commands and events can be reloaded without restart

## Setup Instructions

### 1. Prerequisites

- Node.js 16.0.0 or higher
- A Discord application and bot token

### 2. Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section and create a bot
4. Copy the bot token
5. In the "OAuth2" section, copy the Client ID
6. Generate an invite link with the following permissions:
   - `applications.commands` (for slash commands)
   - `bot` (basic bot permissions)
   - `Send Messages`, `Read Message History`, `Manage Messages` (for moderation)

### 3. Installation

1. Clone or download this bot
2. Navigate to the SecurityBot directory
3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

5. Edit the `.env` file and add your bot credentials:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_bot_client_id_here
   ```

### 4. Deploy Commands

Before running the bot, you need to register the slash commands:

```bash
node deploy-commands.js
```

### 5. Run the Bot

Start the bot:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Commands

### `/status`
Check if the bot is working properly and view performance statistics.

**Usage:** `/status`

**Features:**
- Bot and API latency
- Uptime information
- Memory usage
- Server and user count
- System information

## Project Structure

```
SecurityBot/
├── commands/           # Slash commands
│   └── status.js      # Status command
├── events/            # Discord.js event handlers
│   ├── ready.js       # Bot ready event
│   ├── interactionCreate.js  # Handle interactions
│   ├── guildCreate.js # New server joined
│   └── guildDelete.js # Server left
├── handlers/          # Command and event loaders
│   ├── commandHandler.js
│   └── eventHandler.js
├── index.js           # Main bot file
├── deploy-commands.js # Command deployment script
├── package.json       # Dependencies and scripts
├── .env.example       # Environment variables template
└── README.md          # This file
```

## Development

### Adding New Commands

1. Create a new file in the `commands/` directory
2. Follow this template:

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commandname')
        .setDescription('Command description'),
    
    cooldown: 5, // Optional cooldown in seconds
    
    async execute(interaction) {
        // Command logic here
        await interaction.reply('Hello!');
    }
};
```

3. Run `node deploy-commands.js` to register the new command
4. Restart the bot or use hot reloading

### Adding New Events

1. Create a new file in the `events/` directory
2. Follow this template:

```javascript
module.exports = {
    name: 'eventName',
    once: false, // Set to true for one-time events
    async execute(eventData, client) {
        // Event logic here
    }
};
```

3. Restart the bot to load the new event

## Support

If you need help with the bot:
1. Check the console logs for error messages
2. Ensure your bot has the necessary permissions
3. Verify your `.env` file is configured correctly
4. Make sure you've deployed the commands with `node deploy-commands.js`

## License

This project is licensed under the MIT License.
