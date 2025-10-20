// MyServers Page - Discord Server Management
let accessToken = null;
let userInfo = null;
let userGuilds = [];
let filteredGuilds = [];
let apiAvailable = false; // Track if API server is available

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    initMyServersPage();
});

async function initMyServersPage() {
    try {
        // Check for access token in URL fragment (OAuth callback)
        const token = extractAccessTokenFromURL();

        if (token) {
            accessToken = token;
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            // Store token for session
            sessionStorage.setItem('discord_access_token', token);
            sessionStorage.setItem('discord_token_timestamp', Date.now().toString());
        } else {
            // Try to get token from session storage
            accessToken = sessionStorage.getItem('discord_access_token');
            const tokenTimestamp = sessionStorage.getItem('discord_token_timestamp');

            // Check if token is expired (Discord tokens expire after 1 week)
            if (accessToken && tokenTimestamp) {
                const tokenAge = Date.now() - parseInt(tokenTimestamp);
                const oneWeek = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

                if (tokenAge > oneWeek) {
                    // Token is expired, clear it
                    sessionStorage.removeItem('discord_access_token');
                    sessionStorage.removeItem('discord_token_timestamp');
                    accessToken = null;
                }
            }
        }

        if (!accessToken) {
            // Check if we should show demo mode
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('demo') === 'true') {
                loadDemoData();
                return;
            }

            showError('No authentication token found. Please login again.');
            return;
        }

        // Check API server availability
        console.log('Checking API server availability...');
        await checkApiAvailability();

        if (!apiAvailable) {
            console.warn('⚠️ API server is not available. Bot status checks will be disabled.');
            showApiWarning();
        }

        // Fetch user info and guilds with timeout
        try {
            console.log('Loading user data...');
            await Promise.race([
                loadUserData(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('User data load timeout')), 10000))
            ]);

            console.log('Loading user guilds...');
            await Promise.race([
                loadUserGuilds(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Guilds load timeout')), 15000))
            ]);
        } catch (error) {
            // If API calls fail, offer demo mode
            if (error.message.includes('Network error') || error.message.includes('CORS')) {
                showErrorWithDemo('Unable to connect to Discord API. This might be due to network restrictions or CORS policies.');
                return;
            }
            throw error; // Re-throw other errors
        }

        // Check bot statuses immediately before displaying
        await checkInitialBotStatuses();

        // Setup UI
        setupSearch();
        displayGuilds();

    } catch (error) {
        console.error('Initialization error:', error);

        // Handle specific error types
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            // Token is invalid, clear it and redirect to login
            sessionStorage.removeItem('discord_access_token');
            sessionStorage.removeItem('discord_token_timestamp');
            showError('Your session has expired. Please login again.');
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
            showError('Access denied. Please check your Discord permissions.');
        } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
            showError('Too many requests. Please wait a moment and try again.');
        } else if (error.message.includes('timeout')) {
            showError('Request timed out. Please check your connection and try again.');
        } else {
            // Show error with demo option
            showErrorWithDemo('Failed to load your Discord servers. This might be due to network issues or Discord API limitations.');
        }
    }
}

// Extract access token from URL fragment
function extractAccessTokenFromURL() {
    const fragment = window.location.hash.substring(1);
    const params = new URLSearchParams(fragment);
    return params.get('access_token');
}

// Load user information from Discord API
async function loadUserData() {
    try {
        const response = await fetch('https://discord.com/api/v10/users/@me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit'
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token is invalid, clear it
                sessionStorage.removeItem('discord_access_token');
                sessionStorage.removeItem('discord_token_timestamp');
                throw new Error('401: Unauthorized - Invalid or expired token');
            } else if (response.status === 403) {
                throw new Error('403: Forbidden - Insufficient permissions');
            } else if (response.status === 429) {
                throw new Error('429: Too Many Requests - Rate limited');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }

        userInfo = await response.json();
        displayUserInfo();

    } catch (error) {
        console.error('Error loading user data:', error);

        // Handle network errors specifically
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error: Unable to connect to Discord API. Please check your internet connection.');
        }

        throw error; // Re-throw to be handled by the caller
    }
}

// Load user's Discord guilds
async function loadUserGuilds() {
    try {
        const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit'
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token is invalid, clear it
                sessionStorage.removeItem('discord_access_token');
                sessionStorage.removeItem('discord_token_timestamp');
                throw new Error('401: Unauthorized - Invalid or expired token');
            } else if (response.status === 403) {
                throw new Error('403: Forbidden - Missing guilds scope');
            } else if (response.status === 429) {
                throw new Error('429: Too Many Requests - Rate limited');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }

        const guilds = await response.json();

        // Validate response
        if (!Array.isArray(guilds)) {
            throw new Error('Invalid response format from Discord API');
        }

        console.log(`Loaded ${guilds.length} guilds from Discord API`);

        // Filter guilds where user has admin permissions
        // Discord permissions: Administrator = 8, Manage Guild = 32
        // Map quickly without blocking on per-guild status calls
        userGuilds = guilds.map(guild => ({
            ...guild,
            hasAdmin: (guild.permissions & 8) === 8 || (guild.permissions & 32) === 32,
            isProtected: null // defer bot status check to background for speed
        }));

        console.log(`Processed ${userGuilds.length} guilds`);

        // Only show admin servers
        filteredGuilds = userGuilds.filter(guild => guild.hasAdmin);
        console.log(`Filtered to ${filteredGuilds.length} admin servers`);

        hideLoading();

    } catch (error) {
        console.error('Error loading guilds:', error);

        // Handle network errors specifically
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error: Unable to connect to Discord API. Please check your internet connection.');
        }

        throw error; // Re-throw to be handled by the caller
    }
}

// Check API server availability
async function checkApiAvailability() {
    try {
        const apiBaseUrl = window.AppConfig?.api?.baseUrl || 'http://localhost:3004/api';
        const response = await fetch(`${apiBaseUrl}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        apiAvailable = response.ok;
        return apiAvailable;
    } catch (error) {
        console.warn('API server is not available:', error.message);
        apiAvailable = false;
        return false;
    }
}

// Check if bot is in a specific server
async function checkBotInServer(serverId) {
    try {
        // Use centralized API URL from config
        const apiBaseUrl = window.AppConfig?.api?.baseUrl || 'http://localhost:3004/api';

        // Try to check if bot is in server via API
        const response = await fetch(`${apiBaseUrl}/bot/server/${serverId}/status`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (response.ok) {
            const data = await response.json();
            return data.botInServer === true;
        }
    } catch (error) {
        // Only log if it's not a timeout or connection error
        if (!error.message.includes('aborted') && !error.message.includes('fetch')) {
            console.log(`Could not check bot status for server ${serverId}:`, error.message);
        }
    }

    // Fallback: return false if we can't determine bot presence
    return false;
}

// Display user information in the navigation
function displayUserInfo() {
    const userInfoElement = document.getElementById('userInfo');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');

    if (userInfo) {
        const avatarUrl = userInfo.avatar
            ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}.png?size=64`
            : `https://cdn.discordapp.com/embed/avatars/${userInfo.discriminator % 5}.png`;

        userAvatar.src = avatarUrl;

        userName.textContent = userInfo.global_name || userInfo.username;
        userInfoElement.style.display = 'flex';
    }
}

// Display guilds in the grid
function displayGuilds() {
    const serversGrid = document.getElementById('serversGrid');
    const emptyState = document.getElementById('emptyState');
    const serversContainer = document.getElementById('serversContainer');

    // Show servers container
    serversContainer.style.display = 'block';

    if (filteredGuilds.length === 0) {
        serversGrid.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    serversGrid.innerHTML = filteredGuilds.map(guild => createServerCard(guild)).join('');

    // Add event listeners to action buttons
    setupServerActions();

    // Kick off background bot-status checks without blocking UI
    backgroundCheckBotStatuses();
}

// Create HTML for a server card
function createServerCard(guild) {
    const iconUrl = guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96`
        : null;

    const iconElement = iconUrl
        ? `<img src="${iconUrl}" alt="${guild.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
        : '';

    const fallbackIcon = guild.name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();

    return `
        <div class="server-card" data-guild-id="${guild.id}">
            <div class="server-header">
                <div class="server-icon">


                    ${iconElement}
                    <span style="${iconUrl ? 'display: none;' : ''}">${fallbackIcon}</span>
                </div>
                <div class="server-info">
                    <h3>${escapeHtml(guild.name)}</h3>
                    <p>Server ID: ${guild.id}</p>
                </div>
            </div>

            <div class="server-badges">
                ${guild.hasAdmin ? '<span class="server-badge admin">Administrator</span>' : ''}
                ${guild.isProtected ? '<span class="server-badge protected">Protected</span>' : '<span class="server-badge unprotected">Unprotected</span>'}
            </div>

            <div class="server-actions">
                ${guild.isProtected ? `
                    <button class="btn btn-primary" data-guild-id="${guild.id}" data-guild-name="${escapeHtml(guild.name)}" onclick="openDashboard(this.dataset.guildId, this.dataset.guildName)">
                        <span>Manage</span>
                    </button>
                ` : `
                    <button class="btn btn-success" onclick="addBot('${guild.id}')">
                        <span>Add Bot</span>
                    </button>
                `}
            </div>
        </div>
    `;
}

// Update statistics in the header (removed - no longer needed)

// Setup filter functionality
function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Filter guilds
            const filter = button.dataset.filter;
            switch (filter) {
                case 'all':
                    filteredGuilds = [...userGuilds];
                    break;
                case 'admin':
                    filteredGuilds = userGuilds.filter(guild => guild.hasAdmin);
                    break;
                case 'protected':
                    filteredGuilds = userGuilds.filter(guild => guild.isProtected && guild.hasAdmin);
                    break;
            }

            displayGuilds();
        });
    });
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('serverSearch');

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();

        // Filter admin servers by search term
        filteredGuilds = userGuilds.filter(guild => {
            // Only show admin servers
            if (!guild.hasAdmin) return false;



            // Apply search filter
            return guild.name.toLowerCase().includes(searchTerm) ||
                   guild.id.includes(searchTerm);
        });

        displayGuilds();
    });
}

// Setup server action event listeners
function setupServerActions() {
    // Event listeners are handled by onclick attributes in the HTML
    // This function can be used for additional setup if needed
}

// Server action functions
function addBot(guildId) {
    const guild = userGuilds.find(g => g.id === guildId);
    if (!guild) return;

    // Generate bot invite URL
    const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${window.AppConfig.discord.clientId}&permissions=${window.AppConfig.discord.botPermissions}&guild_id=${guildId}&scope=bot%20applications.commands`;

    // Open in new window
    const botWindow = window.open(botInviteUrl, '_blank', 'width=500,height=700');

    // Monitor when user returns and refresh bot status
    if (botWindow) {
        // Show a notice that we'll check status after they add the bot
        showSuccessNotice('Opening bot invite... After adding the bot, we\'ll automatically check its status.');

        // Check if window is closed (user finished adding bot)
        const checkClosed = setInterval(async () => {
            if (botWindow.closed) {
                clearInterval(checkClosed);
                console.log('Bot invite window closed, checking bot status...');

                // Wait a moment for Discord to process
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Refresh bot status for this specific server
                if (apiAvailable) {
                    const inServer = await checkBotInServer(guildId);
                    guild.isProtected = !!inServer;
                    updateServerBadge(guildId, guild.isProtected);

                    if (inServer) {
                        showSuccessNotice('✅ Bot successfully added to ' + guild.name + '!');
                    } else {
                        showErrorNotice('⚠️ Could not verify bot was added. Please refresh the page.');
                    }
                } else {
                    showErrorNotice('⚠️ API server is offline. Please refresh the page to see updated status.');
                }
            }
        }, 500);
    }
}

function configureServer(guildId) {
    // This would navigate to a server configuration page
    alert(`Configure server ${guildId} - This feature will be implemented next!`);
}

function openDashboard(guildId, guildName) {
    try {
        // Persist selection as a fallback for the dashboard
        sessionStorage.setItem('current_server_id', guildId);
        sessionStorage.setItem('current_server_name', guildName);
    } catch {}
    // Navigate to the dashboard page with server information
    const dashboardUrl = `/Dashboard/index.html?server=${encodeURIComponent(guildId)}&name=${encodeURIComponent(guildName)}`;
    window.location.href = dashboardUrl;
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function hideLoading() {
    document.getElementById('loadingContainer').style.display = 'none';
}

function showError(message) {
    document.getElementById('loadingContainer').style.display = 'none';
    document.getElementById('errorContainer').style.display = 'flex';
    document.getElementById('errorDescription').textContent = message;


}

function redirectToLogin() {
    window.location.href = '/SecurityLandingPage/index.html';
}

function logout() {
    sessionStorage.removeItem('discord_access_token');
    window.location.href = '/SecurityLandingPage/index.html';
}

async function refreshServers() {
    // Show loading state
    document.getElementById('serversContainer').style.display = 'none';
    document.getElementById('errorContainer').style.display = 'none';
    document.getElementById('loadingContainer').style.display = 'flex';

    try {
        // Reload user data and guilds
        await loadUserData();
        await loadUserGuilds();

        // Setup UI
        setupSearch();
        displayGuilds();

    } catch (error) {
        console.error('Refresh error:', error);
        showError('Failed to refresh servers. Please try again.');
    }
}

// Add a utility function for making API requests with retry logic
async function makeDiscordAPIRequest(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 429) {


                // Rate limited, wait and retry
                const retryAfter = response.headers.get('Retry-After') || '1';
                const waitTime = parseInt(retryAfter) * 1000;
                console.log(`Rate limited, waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('401: Unauthorized - Invalid or expired token');
                } else if (response.status === 403) {
                    throw new Error('403: Forbidden - Insufficient permissions');
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            }

            return await response.json();

        } catch (error) {
            if (i === retries - 1) {
                // Last retry failed
                throw error;
            }

            // Wait before retrying (exponential backoff)
            const waitTime = Math.pow(2, i) * 1000;
            console.log(`Request failed, waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

// Demo data for testing when Discord API is not accessible
function loadDemoData() {
    console.log('Loading demo data...');

    // Demo user info
    userInfo = {
        id: '123456789012345678',
        username: 'DemoUser',
        global_name: 'Demo User',
        avatar: null,
        discriminator: '0001'
    };

    // Demo guilds
    userGuilds = [
        {
            id: '123456789012345678',
            name: 'My Awesome Server',
            icon: null,
            permissions: 8, // Administrator
            hasAdmin: true,
            isProtected: true,
            memberCount: 1247
        },
        {
            id: '234567890123456789',
            name: 'Gaming Community Hub',
            icon: null,
            permissions: 32, // Manage Guild
            hasAdmin: true,
            isProtected: true,
            memberCount: 3842
        },
        {
            id: '345678901234567890',
            name: 'Tech Study Group',
            icon: null,
            permissions: 8, // Administrator
            hasAdmin: true,
            isProtected: false,
            memberCount: 156
        },
        {
            id: '456789012345678901',
            name: 'Creative Arts Discord',
            icon: null,
            permissions: 0, // No admin
            hasAdmin: false,
            isProtected: false,
            memberCount: 892
        },
        {
            id: '567890123456789012',
            name: 'Developer Community',
            icon: null,
            permissions: 8, // Administrator
            hasAdmin: true,
            isProtected: true,
            memberCount: 2156
        }
    ];

    filteredGuilds = [...userGuilds];

    // Display demo data
    displayUserInfo();
    hideLoading();
    setupSearch();
    displayGuilds();

    // Show demo notice
    showDemoNotice();
}

function showDemoNotice() {
    const notice = document.createElement('div');
    notice.style.cssText = `
        position: fixed;
        top: 90px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(245, 158, 11, 0.9);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 1001;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    notice.textContent = '🎭 Demo Mode - Showing sample data';
    document.body.appendChild(notice);

    // Remove notice after 5 seconds
    setTimeout(() => {
        if (notice.parentNode) {
            notice.parentNode.removeChild(notice);
        }
    }, 5000);
}

function showSuccessNotice(message) {
    const notice = document.createElement('div');
    notice.style.cssText = `
        position: fixed;
        top: 90px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(34, 197, 94, 0.95);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 1001;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideDown 0.3s ease-out;
    `;
    notice.textContent = message;
    document.body.appendChild(notice);

    // Remove notice after 5 seconds
    setTimeout(() => {
        if (notice.parentNode) {
            notice.style.animation = 'slideUp 0.3s ease-out';
            setTimeout(() => {
                if (notice.parentNode) {
                    notice.parentNode.removeChild(notice);
                }
            }, 300);
        }
    }, 5000);
}

function showErrorNotice(message) {
    const notice = document.createElement('div');
    notice.style.cssText = `
        position: fixed;
        top: 90px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(239, 68, 68, 0.95);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 1001;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideDown 0.3s ease-out;
    `;
    notice.textContent = message;
    document.body.appendChild(notice);

    // Remove notice after 5 seconds
    setTimeout(() => {
        if (notice.parentNode) {
            notice.style.animation = 'slideUp 0.3s ease-out';
            setTimeout(() => {
                if (notice.parentNode) {
                    notice.parentNode.removeChild(notice);
                }
            }, 300);
        }
    }, 5000);
}

function showErrorWithDemo(message) {
    document.getElementById('loadingContainer').style.display = 'none';
    document.getElementById('errorContainer').style.display = 'flex';

    const errorDescription = document.getElementById('errorDescription');
    errorDescription.innerHTML = `
        ${message}<br><br>
        <button class="btn btn-outline" onclick="loadDemoData()" style="margin-right: 10px;">
            <span>Try Demo Mode</span>
        </button>
        <button class="btn btn-primary" onclick="redirectToLogin()">
            <span>Login Again</span>
        </button>
    `;
}

// Show API warning banner
function showApiWarning() {
    // Check if warning already exists
    if (document.getElementById('apiWarningBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'apiWarningBanner';
    banner.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        max-width: 90%;
        animation: slideDown 0.3s ease-out;
    `;

    banner.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span><strong>API Server Offline:</strong> Bot status checks are disabled. Please start the API server with <code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px;">npm run start:api</code></span>
        <button onclick="retryApiConnection()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: auto;">Retry</button>
        <button onclick="document.getElementById('apiWarningBanner').remove()" style="background: transparent; border: none; color: white; cursor: pointer; font-size: 20px; padding: 0 8px;">×</button>
    `;

    document.body.appendChild(banner);

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

// Retry API connection
async function retryApiConnection() {
    const banner = document.getElementById('apiWarningBanner');
    if (banner) {
        const retryBtn = banner.querySelector('button');
        const originalText = retryBtn.textContent;
        retryBtn.textContent = 'Checking...';
        retryBtn.disabled = true;

        const available = await checkApiAvailability();

        if (available) {
            banner.remove();
            showSuccessNotice('✅ API server connected! Refreshing bot status...');
            // Refresh bot statuses
            backgroundCheckBotStatuses();
        } else {
            retryBtn.textContent = originalText;
            retryBtn.disabled = false;
            showErrorNotice('❌ API server still unavailable');
        }
    }
}


// Check bot statuses immediately on initial load
async function checkInitialBotStatuses() {
    // Skip if API is not available
    if (!apiAvailable) {
        console.log('⚠️ Skipping initial bot status checks - API server not available');
        return;
    }

    const pending = filteredGuilds.filter(g => g.hasAdmin && g.isProtected === null);
    if (pending.length === 0) return;

    console.log(`🔍 Checking initial bot status for ${pending.length} servers...`);

    // Check all servers in parallel for faster initial load
    await Promise.all(pending.map(async (g) => {
        try {
            const inServer = await checkBotInServer(g.id);
            g.isProtected = !!inServer;
        } catch (e) {
            console.warn(`Failed to check bot status for ${g.id}:`, e);
            g.isProtected = false;
        }
    }));

    console.log('✅ Initial bot status checks completed');
}

// Background bot-status checks with limited concurrency for fast initial load
async function backgroundCheckBotStatuses() {
    // Skip if API is not available
    if (!apiAvailable) {
        console.log('⚠️ Skipping bot status checks - API server not available');
        return;
    }

    const pending = filteredGuilds.filter(g => g.hasAdmin && g.isProtected === null);
    if (pending.length === 0) return;

    console.log(`🔍 Checking bot status for ${pending.length} servers...`);
    const concurrency = 5;
    let index = 0;

    async function worker() {
        while (index < pending.length) {
            const g = pending[index++];
            try {
                const inServer = await checkBotInServer(g.id);
                g.isProtected = !!inServer;
                updateServerBadge(g.id, g.isProtected);
            } catch (e) {
                g.isProtected = false;
                updateServerBadge(g.id, false);
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
    console.log('✅ Bot status checks completed');
}

function updateServerBadge(guildId, isProtected) {
    const card = document.querySelector(`.server-card[data-guild-id="${guildId}"]`);
    if (!card) return;
    const badges = card.querySelector('.server-badges');
    if (badges) {
        badges.innerHTML = `
            <span class="server-badge admin">Administrator</span>
            ${isProtected ? '<span class="server-badge protected">Protected</span>' : '<span class="server-badge unprotected">Unprotected</span>'}
        `;
    }
    const actions = card.querySelector('.server-actions');
    if (actions) {
        const name = card.querySelector('.server-info h3')?.textContent || 'Server';
        actions.innerHTML = isProtected
            ? `<button class=\"btn btn-primary\" data-guild-id=\"${guildId}\" data-guild-name=\"${escapeHtml(name)}\" onclick=\"openDashboard(this.dataset.guildId, this.dataset.guildName)\"><span>Manage</span></button>`
            : `<button class=\"btn btn-success\" onclick=\"addBot('${guildId}')\"><span>Add Bot</span></button>`;
    }
}
