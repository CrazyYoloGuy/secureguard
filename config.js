// Global, browser-friendly configuration (no env required)
// Replace placeholder values with your real Discord application credentials
window.AppConfig = {
    discord: {
        // REQUIRED: Your Discord Application Client ID
        clientId: '1416057259175444644',
        // REMOVED: Never expose clientSecret or botToken in frontend code
        // clientSecret: 'MOVED_TO_BACKEND_ONLY',
        // botToken: 'MOVED_TO_BACKEND_ONLY',
        // Public redirect used by the front-end OAuth (always goes to MyServers)
        redirectUri: 'http://localhost:3000/MyServers/index.html',
        // Scopes used for user login and listing guilds
        scopes: ['identify', 'guilds'],
        // Permissions used when generating the bot invite URL (Administrator by default)
        botPermissions: '8'
    },
    api: {
        // Backend API base URL
        baseUrl: 'http://localhost:3004/api'
    },
    app: {
        environment: 'development',
        port: 3000
    }
};

// Pre-build common URLs for convenience - using token flow for frontend-only
window.AppConfig.discord.authUrl = `https://discord.com/api/oauth2/authorize?client_id=${window.AppConfig.discord.clientId}&redirect_uri=${encodeURIComponent(window.AppConfig.discord.redirectUri)}&response_type=token&scope=${window.AppConfig.discord.scopes.join('%20')}`;
