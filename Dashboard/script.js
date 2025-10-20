// Dashboard Script - Professional Server Management
let currentServer = null;
// Use centralized API URL from config, with fallback
const API_BASE_URL = window.AppConfig?.api?.baseUrl || 'http://localhost:3004/api';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    setupUserDropdown();
    setupServerSelector();
    loadUserInfo();
    loadUserServers();
});

function initDashboard() {
    // Get server information from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    let serverId = urlParams.get('server');
    let serverName = urlParams.get('name');

    // Fallback to sessionStorage if query params are missing or empty
    if (!serverId || !serverName) {
        try {
            const ssId = sessionStorage.getItem('current_server_id');
            const ssName = sessionStorage.getItem('current_server_name');
            if (ssId && ssName) {
                serverId = ssId;
                serverName = ssName;
            }
        } catch {}
    }

    if (!serverId || !serverName) {
        // Redirect back to servers if no server specified
        window.location.href = '/MyServers/index.html';
        return;
    }

    currentServer = {
        id: decodeURIComponent(serverId),
        name: decodeURIComponent(serverName)
    };

    console.log(`🎯 Dashboard initialized for server: ${currentServer.id} (${currentServer.name})`);

    // Initialize dashboard components
    setupServerInfo();
    setupNavigation();
    setupDashboardData();
    loadServerSettings();
}

// Setup User Dropdown in Navbar
function setupUserDropdown() {
    const trigger = document.getElementById('userDropdownTrigger');
    const dropdown = trigger?.parentElement;

    if (!trigger || !dropdown) return;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

// Setup Server Selector Dropdown in Sidebar
function setupServerSelector() {
    const trigger = document.getElementById('serverSelectorTrigger');
    const selector = trigger?.parentElement;

    if (!trigger || !selector) return;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        selector.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!selector.contains(e.target)) {
            selector.classList.remove('active');
        }
    });
}

// Load User Information
async function loadUserInfo() {
    try {
        const accessToken = sessionStorage.getItem('discord_access_token');
        if (!accessToken) {
            console.warn('No access token found');
            return;
        }

        const response = await fetch('https://discord.com/api/v10/users/@me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            console.error('Failed to load user info:', response.status);
            return;
        }

        const user = await response.json();

        // Update navbar user info
        const navUserAvatar = document.getElementById('navUserAvatar');
        const navUserName = document.getElementById('navUserName');

        if (navUserAvatar && user.avatar) {
            const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
            navUserAvatar.src = avatarUrl;
        } else if (navUserAvatar) {
            // Default avatar
            const defaultAvatar = `https://cdn.discordapp.com/embed/avatars/${(user.discriminator || 0) % 5}.png`;
            navUserAvatar.src = defaultAvatar;
        }

        if (navUserName) {
            navUserName.textContent = user.global_name || user.username;
        }

    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Load User's Servers (where bot is present) - OPTIMIZED FOR SPEED
async function loadUserServers() {
    try {
        const accessToken = sessionStorage.getItem('discord_access_token');
        if (!accessToken) return;

        const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            console.error('Failed to load guilds:', response.status);
            return;
        }

        const guilds = await response.json();

        // Filter guilds where user has admin permissions
        const adminGuilds = guilds.filter(guild =>
            (guild.permissions & 8) === 8 || (guild.permissions & 32) === 32
        );

        // Show loading state immediately
        const listContainer = document.getElementById('serverSelectorList');
        if (listContainer) {
            listContainer.innerHTML = '<div class="server-selector-loading">Loading servers...</div>';
        }

        // Check which servers have the bot - PARALLEL REQUESTS FOR SPEED
        const botCheckPromises = adminGuilds.map(async (guild) => {
            try {
                const botCheckResponse = await fetch(`${API_BASE_URL}/bot/server/${guild.id}/status`, {
                    signal: AbortSignal.timeout(3000) // 3 second timeout per request
                });
                if (botCheckResponse.ok) {
                    const data = await botCheckResponse.json();
                    if (data.botInServer) {
                        return guild;
                    }
                }
                return null;
            } catch (error) {
                // Skip servers where bot check fails or times out
                return null;
            }
        });

        // Wait for all checks to complete in parallel
        const results = await Promise.all(botCheckPromises);

        // Filter out null results
        const serversWithBot = results.filter(guild => guild !== null);

        // Update server selector list
        updateServerSelectorList(serversWithBot);

    } catch (error) {
        console.error('Error loading user servers:', error);
        const listContainer = document.getElementById('serverSelectorList');
        if (listContainer) {
            listContainer.innerHTML = '<div class="server-selector-loading">Failed to load servers</div>';
        }
    }
}

// Update Server Selector List
function updateServerSelectorList(servers) {
    const listContainer = document.getElementById('serverSelectorList');
    if (!listContainer) return;

    if (servers.length === 0) {
        listContainer.innerHTML = '<div class="server-selector-loading">No servers found</div>';
        return;
    }

    listContainer.innerHTML = '';

    servers.forEach(server => {
        const item = document.createElement('a');
        item.href = `?server=${encodeURIComponent(server.id)}&name=${encodeURIComponent(server.name)}`;
        item.className = 'server-selector-item';

        // Mark current server as active
        if (currentServer && server.id === currentServer.id) {
            item.classList.add('active');
        }

        // Generate initials
        const initials = server.name
            .split(' ')
            .map(word => word[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

        // Server avatar or fallback
        if (server.icon) {
            const iconUrl = `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png?size=64`;
            item.innerHTML = `
                <img class="server-selector-item-avatar" src="${iconUrl}" alt="${server.name}">
                <span class="server-selector-item-name">${server.name}</span>
            `;
        } else {
            item.innerHTML = `
                <div class="server-selector-item-fallback">${initials}</div>
                <span class="server-selector-item-name">${server.name}</span>
            `;
        }

        listContainer.appendChild(item);
    });
}

function setupServerInfo() {
    const memberCount = document.getElementById('memberCount');

    // Update sidebar server info
    const sidebarServerName = document.getElementById('sidebarServerName');
    const sidebarServerMembers = document.getElementById('sidebarServerMembers');
    const sidebarServerInitials = document.getElementById('sidebarServerInitials');
    const sidebarServerImage = document.getElementById('sidebarServerImage');
    const sidebarServerFallback = document.getElementById('sidebarServerFallback');

    // Update server selector
    const selectorName = document.getElementById('sidebarServerSelectorName');
    const selectorInitials = document.getElementById('sidebarServerSelectorInitials');
    const selectorImage = document.getElementById('sidebarServerSelectorImage');
    const selectorFallback = document.getElementById('sidebarServerSelectorFallback');

    // Generate initials from server name
    const initials = currentServer.name
        .split(' ')
        .map(word => word[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    // Update server selector
    if (selectorName) {
        selectorName.textContent = currentServer.name;
    }

    if (selectorInitials) {
        selectorInitials.textContent = initials;
    }

    // Update sidebar server info
    if (sidebarServerName) {
        sidebarServerName.textContent = currentServer.name;
    }

    if (sidebarServerInitials) {
        sidebarServerInitials.textContent = initials;
    }

    // Try to load server icon for sidebar
    if (sidebarServerImage && sidebarServerFallback) {
        sidebarServerImage.onload = function() {
            sidebarServerImage.style.display = 'block';
            sidebarServerFallback.style.display = 'none';
        };

        sidebarServerImage.onerror = function() {
            sidebarServerImage.style.display = 'none';
            sidebarServerFallback.style.display = 'flex';
        };

        // Load real server icon
        loadDiscordServerIcon();
    }

    // Load real Discord server data
    loadDiscordServerData();

    // Load server settings and update UI
    loadServerSettings();
}

// Load real Discord server icon using bot token
async function loadDiscordServerIcon() {
    try {
        const sidebarServerImage = document.getElementById('sidebarServerImage');
        const sidebarServerFallback = document.getElementById('sidebarServerFallback');
        const selectorImage = document.getElementById('sidebarServerSelectorImage');
        const selectorFallback = document.getElementById('sidebarServerSelectorFallback');

        if (!sidebarServerImage || !sidebarServerFallback) return;

        // Fetch server info from our API (which uses bot token)
        const response = await fetch(`${API_BASE_URL}/discord/server/${currentServer.id}/info`);

        if (response.ok) {
            const serverData = await response.json();
            if (serverData.icon) {
                const iconUrl = `https://cdn.discordapp.com/icons/${serverData.id}/${serverData.icon}.png?size=64`;

                // Update sidebar image
                sidebarServerImage.src = iconUrl;

                // Update server selector image
                if (selectorImage && selectorFallback) {
                    selectorImage.src = iconUrl;
                    selectorImage.onload = function() {
                        selectorImage.style.display = 'block';
                        selectorFallback.style.display = 'none';
                    };
                    selectorImage.onerror = function() {
                        selectorImage.style.display = 'none';
                        selectorFallback.style.display = 'flex';
                    };
                }

                return; // Let the onload/onerror handlers manage visibility
            }
        }

        // No icon available, show fallback
        sidebarServerImage.style.display = 'none';
        sidebarServerFallback.style.display = 'flex';
        if (selectorImage && selectorFallback) {
            selectorImage.style.display = 'none';
            selectorFallback.style.display = 'flex';
        }

    } catch (error) {
        console.error('Error loading server icon:', error);
        const sidebarServerImage = document.getElementById('sidebarServerImage');
        const sidebarServerFallback = document.getElementById('sidebarServerFallback');
        const selectorImage = document.getElementById('sidebarServerSelectorImage');
        const selectorFallback = document.getElementById('sidebarServerSelectorFallback');

        if (sidebarServerImage && sidebarServerFallback) {
            sidebarServerImage.style.display = 'none';
            sidebarServerFallback.style.display = 'flex';
        }
        if (selectorImage && selectorFallback) {
            selectorImage.style.display = 'none';
            selectorFallback.style.display = 'flex';
        }
    }
}

// Load real Discord server data using bot token
async function loadDiscordServerData() {
    try {
        console.log('Loading Discord server data for:', currentServer.id);

        // Fetch server info from our API (which uses bot token)
        const response = await fetch(`${API_BASE_URL}/discord/server/${currentServer.id}/info`);

        if (!response.ok) {
            console.warn('Failed to fetch server data from API:', response.status);
            return;
        }

        const serverData = await response.json();
        console.log('Loaded Discord server data:', serverData);

        // Update server info with real data
        currentServer.name = serverData.name;
        currentServer.icon = serverData.icon;
        currentServer.memberCount = serverData.member_count || 0;
        currentServer.description = serverData.description;

        // Update UI with real data
        updateServerUI(serverData);

    } catch (error) {
        console.error('Error loading Discord server data:', error);
    }
}

// Update UI with real server data
function updateServerUI(serverData) {
    // Update server name in sidebar
    const sidebarServerName = document.getElementById('sidebarServerName');
    const sidebarServerMembers = document.getElementById('sidebarServerMembers');
    const memberCount = document.getElementById('memberCount');

    if (sidebarServerName) sidebarServerName.textContent = serverData.name;

    if (serverData.member_count) {
        const memberText = `${serverData.member_count.toLocaleString()} members`;
        if (sidebarServerMembers) {
            sidebarServerMembers.innerHTML = `
                <svg viewBox="0 0 24 24" class="member-icon">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" fill="none" stroke-width="2"/>
                    <circle cx="9" cy="7" r="4" stroke="currentColor" fill="none" stroke-width="2"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" fill="none" stroke-width="2"/>
                </svg>
                <span>${memberText}</span>
            `;
        }
        if (memberCount) memberCount.textContent = serverData.member_count.toLocaleString();
    }
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const contentSections = document.querySelectorAll('.content-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            const targetSection = link.dataset.section;

            // Update active nav link
            navLinks.forEach(nl => nl.classList.remove('active'));
            link.classList.add('active');

            // Show target section
            contentSections.forEach(section => {
                section.classList.remove('active');
            });

            const targetElement = document.getElementById(`${targetSection}-section`);
            if (targetElement) {
                targetElement.classList.add('active');
            }
        });
    });
}

function setupDashboardData() {
    // Simulate real-time data updates
    updateSecurityMetrics();
    updateRecentActivity();

    // Set up periodic updates (every 5 minutes to reduce refreshes)
    setInterval(() => {
        updateSecurityMetrics();
        updateRecentActivity();
    }, 300000);
}

function updateSecurityMetrics() {
    // Update threat count with realistic numbers
    const threatElements = document.querySelectorAll('.status-value');
    if (threatElements.length >= 3) {
        // Threats blocked (last 24 hours)
        const threatsBlocked = Math.floor(Math.random() * 100) + 20;
        threatElements[2].textContent = threatsBlocked.toString();

        // Auto actions (this month)
        const autoActions = Math.floor(Math.random() * 500) + 100;
        if (threatElements[3]) {
            threatElements[3].textContent = autoActions.toString();
        }
    }
}

function updateRecentActivity() {
    // This would typically fetch real data from your API
    // For now, we'll keep the static data but could add timestamps
    const activityTimes = document.querySelectorAll('.activity-time');
    activityTimes.forEach((timeElement, index) => {
        const minutesAgo = Math.floor(Math.random() * 60) + (index * 5);
        if (minutesAgo < 60) {
            timeElement.textContent = `${minutesAgo} minutes ago`;
        } else {
            const hoursAgo = Math.floor(minutesAgo / 60);
            timeElement.textContent = `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
        }
    });
}

// Navigation functions
function goBackToServers() {
    window.location.href = '/MyServers/index.html';
}

function logout() {
    // Clear any stored data
    sessionStorage.removeItem('discord_access_token');
    sessionStorage.removeItem('discord_token_timestamp');

    // Redirect to landing page
    window.location.href = '/SecurityLandingPage/index.html';
}

// Server header functions
function refreshServerData() {
    showNotification('Server data refreshed successfully!', 'success');
    // Here you would typically refresh the server data from your API
    setupServerInfo();
    updateSecurityMetrics();
}

function openServerSettings() {
    showNotification('Server settings panel coming soon!', 'info');
    // This would open a server settings modal or navigate to settings page
}

// Database integration functions
async function loadServerSettings() {
    try {
        console.log(`🔍 Loading settings for server: ${currentServer.id} (${currentServer.name})`);
        const response = await fetch(`${API_BASE_URL}/server/${currentServer.id}/settings`);
        if (!response.ok) {
            throw new Error('Failed to load server settings');
        }

        const settings = await response.json();
        console.log('📊 Loaded server settings:', JSON.stringify(settings, null, 2));
        applyServerSettings(settings);
        setupFeatures();
    } catch (error) {
        console.error('Error loading server settings:', error);
        showNotification('Failed to load server settings. Using defaults.', 'warning');
        setupFeatures(); // Setup with defaults
    }
}

function applyServerSettings(settings) {
    // Apply settings to the UI - map database feature names to UI element IDs
    const featureMapping = {
        'anti_spam': 'anti-spam',
        'auto_moderation': 'auto-mod',
        'welcome_messages': 'welcome',
        'raid_protection': 'raid-protection',
        'link_protection': 'link-protection',
        'member_verification': 'verification'  // This was the key missing mapping!
    };

    Object.keys(featureMapping).forEach(dbFeature => {
        const featureData = settings[dbFeature];
        if (featureData) {
            const uiFeatureId = featureMapping[dbFeature];
            const toggle = document.getElementById(`${uiFeatureId}-toggle`);
            if (toggle) {
                console.log(`🔄 Setting ${dbFeature} (${uiFeatureId}) to ${featureData.enabled}`);
                toggle.checked = featureData.enabled;
                updateFeatureUI(uiFeatureId, featureData.enabled);
            } else {
                console.warn(`⚠️ Toggle not found for feature: ${uiFeatureId}-toggle`);
            }
        }
    });
}

async function saveFeatureSetting(featureId, enabled, config = {}) {
    try {
        // Map feature IDs to correct database column names
        const featureMapping = {
            'anti-spam': 'anti_spam',
            'auto-mod': 'auto_moderation',
            'welcome': 'welcome_messages',
            'raid-protection': 'raid_protection',
            'link-protection': 'link_protection',
            'verification': 'member_verification'
        };

        const dbFeatureName = featureMapping[featureId] || featureId.replace('-', '_');

        console.log(`🌐 API Request: PUT ${API_BASE_URL}/server/${currentServer.id}/feature/${dbFeatureName}`);
        console.log(`📦 Request body:`, JSON.stringify({ enabled, config }, null, 2));

        const response = await fetch(`${API_BASE_URL}/server/${currentServer.id}/feature/${dbFeatureName}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ enabled, config })
        });

        if (!response.ok) {
            throw new Error('Failed to save feature setting');
        }

        const result = await response.json();
        console.log('Feature setting saved:', result);
        return true;
    } catch (error) {
        console.error('Error saving feature setting:', error);
        showNotification('Failed to save setting. Please try again.', 'error');
        return false;
    }
}

// Feature toggle functions
async function toggleFeature(featureId, enabled) {
    const toggleEl = document.getElementById(`${featureId}-toggle`);
    const featureCard = toggleEl.closest('.feature-card');
    const featureName = getFeatureName(featureId + '-toggle');

    // Special flow for Member Verification: open modal on enable
    if (featureId === 'verification' && enabled) {
        featureCard.classList.remove('updating');
        toggleEl.checked = false;
        openVerificationModal();
        return;
    }

    // Special flow for Member Verification: confirm full cleanup on disable
    if (featureId === 'verification' && !enabled) {
        // Revert the toggle immediately and show confirmation modal
        toggleEl.checked = true;
        openDisableVerificationModal();
        return;
    }

    // Add updating animation
    featureCard.classList.add('updating');

    try {
        // Save to database first
        const saved = await saveFeatureSetting(featureId, enabled);

        if (saved) {
            updateFeatureUI(featureId, enabled);

            // Add success animation
            featureCard.classList.remove('updating');
            featureCard.classList.add('success');
            setTimeout(() => featureCard.classList.remove('success'), 600);

            const action = enabled ? 'enabled' : 'disabled';
            showEnhancedNotification(
                `${featureName} ${action.charAt(0).toUpperCase() + action.slice(1)}`,
                `${featureName} has been successfully ${action}`,
                enabled ? 'success' : 'info'
            );
        } else {
            // Revert toggle if save failed
            featureCard.classList.remove('updating');
            const toggle = document.getElementById(`${featureId}-toggle`);
            if (toggle) {
                toggle.checked = !enabled;
            }
            showEnhancedNotification(
                'Save Failed',
                `Failed to ${enabled ? 'enable' : 'disable'} ${featureName}. Please try again.`,
                'error'
            );
        }
    } catch (error) {
        featureCard.classList.remove('updating');
        console.error('Error toggling feature:', error);
        showEnhancedNotification(
            'Error',
            'An unexpected error occurred. Please try again.',
            'error'
        );
    }
}

function updateFeatureUI(featureId, enabled) {
    const statusElement = document.getElementById(`${featureId}-status`);
    const configBtn = document.querySelector(`#${featureId}-toggle`).closest('.feature-controls-bottom').querySelector('.feature-config-btn');

    if (statusElement) {
        if (enabled) {
            statusElement.className = 'feature-status enabled';
            statusElement.querySelector('.status-text').textContent = 'Enabled';
            if (configBtn) {
                configBtn.classList.remove('disabled');
            }
        } else {
            statusElement.className = 'feature-status disabled';
            statusElement.querySelector('.status-text').textContent = 'Disabled';
            if (configBtn) {
                configBtn.classList.add('disabled');
            }
        }
    }
}

// Feature settings functions
function openFeatureSettings(featureId) {
    // Open specific configuration page based on feature
    if (featureId === 'link-protection') {
        toggleLinkProtectionConfig();
    } else if (featureId === 'anti-spam') {
        toggleAntiSpamConfig();
    } else {
        const featureName = getFeatureName(featureId + '-toggle');
        showNotification(`${featureName} settings panel coming soon!`, 'info');
        console.log(`Opening settings for feature: ${featureId}`);
    }
}

// Link Protection Modal Functions
let currentLinkProtectionConfig = {
    whitelist_domains: [],
    whitelist_users: [],
    whitelist_roles: [],
    block_suspicious: true,
    scan_embeds: true,
    check_redirects: true,
    allow_media_links: true,
    punishment: 'delete'
};

// Server roles cache
let serverRoles = [];

// Ensure config object has all required properties
function ensureLinkProtectionConfig(config) {
    return {
        whitelist_domains: config?.whitelist_domains || [],
        whitelist_users: config?.whitelist_users || [],
        whitelist_roles: config?.whitelist_roles || [],
        block_suspicious: config?.block_suspicious !== undefined ? config.block_suspicious : true,
        scan_embeds: config?.scan_embeds !== undefined ? config.scan_embeds : true,
        check_redirects: config?.check_redirects !== undefined ? config.check_redirects : true,
        allow_media_links: config?.allow_media_links !== undefined ? config.allow_media_links : true,
        punishment: config?.punishment || 'delete'
    };
}

// Toggle inline Link Protection configuration
function toggleLinkProtectionConfig() {
    // Check if Link Protection is enabled first
    const linkProtectionToggle = document.getElementById('link-protection-toggle');
    if (!linkProtectionToggle || !linkProtectionToggle.checked) {
        showNotification('Please enable Link Protection first before configuring it.', 'warning');
        return;
    }

    const featuresGrid = document.querySelector('.features-grid');
    const configSection = document.getElementById('link-protection-config');

    if (!featuresGrid || !configSection) {
        console.error('Required elements not found');
        return;
    }

    const isConfigVisible = configSection.style.display !== 'none';

    if (isConfigVisible) {
        // Hide config, show features
        configSection.style.display = 'none';
        featuresGrid.style.display = 'grid';
    } else {
        // Show config, hide features
        featuresGrid.style.display = 'none';
        configSection.style.display = 'block';

        // Always reload configuration data when opening config
        console.log('🔄 Opening Link Protection config - reloading data...');
        loadLinkProtectionConfig();
    }
}

// Load Link Protection configuration
// ---------- Unsaved changes strip (top) for Link Protection ----------
let linkProtectionUnsaved = false;
let linkProtectionUnsavedBanner = null; // reuse var, but we now point to the top strip element

function ensureUnsavedBanner() {
    // Use the global slim strip at the top
    const strip = document.getElementById('unsavedStrip');
    if (!strip) return null;

    // Set context text for Link Protection
    const textEl = strip.querySelector('.unsaved-strip-text span');
    if (textEl) textEl.textContent = 'Your link protection settings have changed.';

    // Wire actions once
    if (!strip.dataset.wiredLp) {
        const discardBtn = document.getElementById('unsavedDiscard');
        const saveBtn = document.getElementById('unsavedSave');
        discardBtn?.addEventListener('click', async () => {
            linkProtectionUnsaved = false;
            hideUnsavedBanner();
            await loadLinkProtectionConfig();
        });
        saveBtn?.addEventListener('click', async () => {
            await saveLinkProtectionConfig();
        });
        strip.dataset.wiredLp = 'true';
    }

    linkProtectionUnsavedBanner = strip;
    return strip;

}

function showUnsavedBanner() {
    const strip = ensureUnsavedBanner();
    if (strip) strip.style.display = 'flex';
}
function hideUnsavedBanner() {
    const strip = document.getElementById('unsavedStrip');
    if (strip) strip.style.display = 'none';
}
function markLinkProtectionUnsaved() {
    linkProtectionUnsaved = true;
    showUnsavedBanner();
}

function setUnsavedStripText(text){
    const strip=document.getElementById('unsavedStrip');
    const span=strip?.querySelector('.unsaved-strip-text span');
    if(span && text) span.textContent=text;
}

// Warn on page unload if there are unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (linkProtectionUnsaved) {
        e.preventDefault();
        e.returnValue = '';
    }
});

async function loadLinkProtectionConfig() {
    try {
        console.log('Loading Link Protection configuration...');

        // Load server roles first
        await loadServerRoles();

        // Load existing configuration from database
        console.log(`🌐 Loading config from: ${API_BASE_URL}/server/${currentServer.id}/settings`);
        const response = await fetch(`${API_BASE_URL}/server/${currentServer.id}/settings`);
        if (response.ok) {
            const settings = await response.json();
            console.log('📊 Loaded settings from API:', JSON.stringify(settings.link_protection, null, 2));

            if (settings && settings.link_protection && settings.link_protection.config) {
                console.log('🔧 Raw config from database:', JSON.stringify(settings.link_protection.config, null, 2));
                currentLinkProtectionConfig = ensureLinkProtectionConfig(settings.link_protection.config);
                console.log('✅ Processed config:', JSON.stringify(currentLinkProtectionConfig, null, 2));
                populateLinkProtectionConfig();
                wireLinkProtectionUnsavedListeners();
            } else {
                console.log('⚠️ No link protection config found, using defaults');
                wireLinkProtectionUnsavedListeners();
            }
        } else {
            console.error('❌ Failed to load settings, response not ok:', response.status);
        }

        console.log('Link Protection configuration loaded');
    } catch (error) {
        console.error('Error loading Link Protection configuration:', error);
        showNotification('Failed to load configuration. Using defaults.', 'warning');
    }
    finally {
        // Reset unsaved state on fresh load
        linkProtectionUnsaved = false;
        hideUnsavedBanner();
    }
}

function wireLinkProtectionUnsavedListeners() {
    const ids = ['blockSuspicious', 'scanEmbeds', 'checkRedirects', 'allowMediaLinks', 'punishmentAction'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.removeEventListener('change', markLinkProtectionUnsaved);
            el.addEventListener('change', markLinkProtectionUnsaved);
        }
    });
}



// Populate the configuration form
function populateLinkProtectionConfig() {
    try {
        console.log('🎨 Populating Link Protection config form...');
        console.log('📋 Current config to populate:', JSON.stringify(currentLinkProtectionConfig, null, 2));

        // Populate domains
        const domainList = document.getElementById('whitelistDomains');
        if (domainList) {
            domainList.innerHTML = '';
            console.log(`🌐 Populating ${currentLinkProtectionConfig.whitelist_domains.length} domains`);
            currentLinkProtectionConfig.whitelist_domains.forEach(domain => {
                addDomainToList(domain);
            });
        } else {
            console.warn('⚠️ Domain list element not found');
        }

        // Populate users
        const userList = document.getElementById('whitelistUsers');
        if (userList) {
            userList.innerHTML = '';
            console.log(`👤 Populating ${currentLinkProtectionConfig.whitelist_users.length} users`);
            currentLinkProtectionConfig.whitelist_users.forEach(userId => {
                console.log(`   Adding user: ${userId}`);
                addUserToList(userId);
            });
        } else {
            console.warn('⚠️ User list element not found');
        }

        // Populate roles
        const roleList = document.getElementById('whitelistRoles');
        if (roleList) {
            roleList.innerHTML = '';
            console.log(`🎭 Populating ${currentLinkProtectionConfig.whitelist_roles.length} roles`);
            currentLinkProtectionConfig.whitelist_roles.forEach(roleId => {
                addRoleToList(roleId);
            });
        } else {
            console.warn('⚠️ Role list element not found');
        }

        // Populate form fields (only populate fields that exist in HTML)
        const punishmentSelect = document.getElementById('punishmentAction');

        if (punishmentSelect) {
            punishmentSelect.value = currentLinkProtectionConfig.punishment || 'delete';
            console.log(`🎯 Set punishment to: ${punishmentSelect.value}`);
        } else {
            console.warn('⚠️ Punishment select element not found');
        }

    } catch (error) {
        console.error('Error populating configuration:', error);
    }
}

// Save Link Protection configuration
async function saveLinkProtectionConfig() {
    try {
        console.log('Saving Link Protection configuration...');

        // Collect form data (support UIs without the old checkboxes)
        const punishmentEl = document.getElementById('punishmentAction');
        const warnMsgEl = document.getElementById('warnMessage');
        const blockSuspiciousEl = document.getElementById('blockSuspicious');
        const scanEmbedsEl = document.getElementById('scanEmbeds');
        const checkRedirectsEl = document.getElementById('checkRedirects');
        const allowMediaLinksEl = document.getElementById('allowMediaLinks');

        const config = {
            whitelist_domains: currentLinkProtectionConfig.whitelist_domains,
            whitelist_users: currentLinkProtectionConfig.whitelist_users,
            whitelist_roles: currentLinkProtectionConfig.whitelist_roles,
            // Default to true when the checkbox is not present in the DOM
            block_suspicious: blockSuspiciousEl ? blockSuspiciousEl.checked : true,
            scan_embeds: scanEmbedsEl ? scanEmbedsEl.checked : true,
            check_redirects: checkRedirectsEl ? checkRedirectsEl.checked : true,
            allow_media_links: allowMediaLinksEl ? allowMediaLinksEl.checked : true,
            punishment: punishmentEl ? punishmentEl.value : (currentLinkProtectionConfig.punishment || 'delete')
        };

        // Update current config
        currentLinkProtectionConfig = config;

        // Save to database
        const response = await fetch(`${API_BASE_URL}/server/${currentServer.id}/feature/link_protection`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                enabled: true,
                config: config
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save configuration');
        }

        showNotification('Link Protection configuration saved successfully!', 'success');
        console.log('Configuration saved:', config);

    } catch (error) {
        console.error('Error saving configuration:', error);
        showNotification('Failed to save configuration. Please try again.', 'error');
    }
}

// Load server roles from Discord API (mock for now)
async function loadServerRoles() {
    try {
        console.log('Loading server roles for server:', currentServer.id);

        // Fetch real roles from Discord API via our bot-based proxy
        const response = await fetch(`${API_BASE_URL}/discord/server/${currentServer.id}/roles`);

        if (!response.ok) {
            console.warn('Failed to fetch roles from Discord API, using fallback');
            serverRoles = [
                { id: 'fallback_admin', name: 'Admin (Fallback)', color: '#ff0000' },
                { id: 'fallback_mod', name: 'Moderator (Fallback)', color: '#00ff00' }
            ];
        } else {
            const roles = await response.json();
            console.log(`Loaded ${roles.length} roles from Discord API`);

            // Transform Discord roles to our format
            serverRoles = roles.map(role => ({
                id: role.id,
                name: role.name,
                color: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5',
                position: role.position,
                permissions: role.permissions
            }));
        }

        // Populate role select
        const roleSelect = document.getElementById('roleSelect');
        if (roleSelect) {
            roleSelect.innerHTML = '<option value="">Select a role...</option>';
            serverRoles.forEach(role => {
                const option = document.createElement('option');
                option.value = role.id;
                option.textContent = role.name;
                option.style.color = role.color;
                roleSelect.appendChild(option);
            });
        }

        console.log('Role select populated with', serverRoles.length, 'roles');
    } catch (error) {
        console.error('Error loading server roles:', error);
        // Fallback to basic roles
        serverRoles = [
            { id: 'error_fallback', name: 'Unable to load roles', color: '#ff0000' }
        ];
    }
}

function populateLinkProtectionModal() {
    try {
        // Ensure config is properly initialized
        currentLinkProtectionConfig = ensureLinkProtectionConfig(currentLinkProtectionConfig);

        // Populate whitelist domains
        const domainList = document.getElementById('whitelistDomains');
        if (domainList) {
            domainList.innerHTML = '';
            if (currentLinkProtectionConfig.whitelist_domains && Array.isArray(currentLinkProtectionConfig.whitelist_domains)) {
                currentLinkProtectionConfig.whitelist_domains.forEach(domain => {
                    addDomainToList(domain);
                });
            }
        }

        // Populate whitelist users
        const userList = document.getElementById('whitelistUsers');
        if (userList) {
            userList.innerHTML = '';
            if (currentLinkProtectionConfig.whitelist_users && Array.isArray(currentLinkProtectionConfig.whitelist_users)) {
                currentLinkProtectionConfig.whitelist_users.forEach(userId => {
                    addUserToList(userId);
                });
            }
        }

        // Populate whitelist roles
        const roleList = document.getElementById('whitelistRoles');
        if (roleList) {
            roleList.innerHTML = '';
            if (currentLinkProtectionConfig.whitelist_roles && Array.isArray(currentLinkProtectionConfig.whitelist_roles)) {
                currentLinkProtectionConfig.whitelist_roles.forEach(roleId => {
                    addRoleToList(roleId);
                });
            }
        }

        // Populate checkboxes
        const blockSuspiciousCheckbox = document.getElementById('blockSuspicious');
        if (blockSuspiciousCheckbox) {
            blockSuspiciousCheckbox.checked = currentLinkProtectionConfig.block_suspicious;
        }

        const scanEmbedsCheckbox = document.getElementById('scanEmbeds');
        if (scanEmbedsCheckbox) {
            scanEmbedsCheckbox.checked = currentLinkProtectionConfig.scan_embeds;
        }

        const checkRedirectsCheckbox = document.getElementById('checkRedirects');
        if (checkRedirectsCheckbox) {
            checkRedirectsCheckbox.checked = currentLinkProtectionConfig.check_redirects;
        }

        const allowMediaLinksCheckbox = document.getElementById('allowMediaLinks');
        if (allowMediaLinksCheckbox) {
            allowMediaLinksCheckbox.checked = currentLinkProtectionConfig.allow_media_links;
        }

        // Populate punishment select
        const punishmentSelect = document.getElementById('punishmentAction');
        if (punishmentSelect) {
            punishmentSelect.value = currentLinkProtectionConfig.punishment;
        }

        // Populate warning message
        const warnMessageTextarea = document.getElementById('warnMessage');
        if (warnMessageTextarea) {
            warnMessageTextarea.value = currentLinkProtectionConfig.warn_message;
        }
    } catch (error) {
        console.error('Error populating link protection modal:', error);
        showEnhancedNotification('Error', 'Failed to load link protection settings', 'error');
    }
}

// Enhanced URL/Domain validation functions
function isValidURL(string) {
    try {
        // Try to create a URL object with common protocols
        const url = new URL(string.startsWith('http') ? string : 'https://' + string);
        return ['http:', 'https:'].includes(url.protocol);
    } catch (_) {
        return false;
    }
}

function isValidDomain(domain) {
    // More strict domain validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    // Check basic format
    if (!domainRegex.test(domain)) {
        return false;
    }

    // Check length constraints
    if (domain.length > 253) {
        return false;
    }

    // Check each label length
    const labels = domain.split('.');
    for (const label of labels) {
        if (label.length > 63 || label.length === 0) {
            return false;
        }
    }

    // Must have at least one dot (no single-word domains)
    if (!domain.includes('.')) {
        return false;
    }

    return true;
}

// Validate if user exists in the server using bot token
async function validateUserInServer(userId) {
    try {
        // Try to fetch user from server members using bot-based API
        const response = await fetch(`${API_BASE_URL}/discord/server/${currentServer.id}/member/${userId}`);

        if (response.ok) {
            const member = await response.json();
            console.log('User found in server:', member.user?.username || member.nick || userId);
            return true;
        } else if (response.status === 404) {
            return false; // User not found in server
        } else {
            console.warn('Could not validate user, allowing by default');
            return true; // Allow if validation fails due to API issues
        }
    } catch (error) {
        console.error('Error validating user:', error);
        return true; // Allow if validation fails
    }
}

function addWhitelistDomain() {
    const input = document.getElementById('domainInput');
    if (!input) {
        console.error('Domain input element not found');
        return;
    }

    let domain = input.value.trim().toLowerCase();

    if (!domain) {
        showNotification('Please enter a domain name or URL.', 'warning');
        return;
    }

    // Remove protocol if present to get clean domain
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
        try {
            const url = new URL(domain);
            domain = url.hostname;
        } catch (e) {
            showNotification('Invalid URL format.', 'error');
            return;
        }
    }

    // Remove www. prefix if present
    if (domain.startsWith('www.')) {
        domain = domain.substring(4);
    }

    // Validate the cleaned domain
    if (!isValidDomain(domain)) {
        showNotification('Please enter a valid domain name (e.g., example.com, discord.com).', 'error');
        return;
    }

    // Ensure config is properly initialized
    currentLinkProtectionConfig = ensureLinkProtectionConfig(currentLinkProtectionConfig);

    // Check if domain already exists
    if (currentLinkProtectionConfig.whitelist_domains.includes(domain)) {
        showNotification('Domain already in whitelist.', 'warning');
        return;
    }

    // Add to config and UI
    currentLinkProtectionConfig.whitelist_domains.push(domain);
    addDomainToList(domain);
    input.value = '';
    markLinkProtectionUnsaved();

    showNotification(`Domain "${domain}" added to whitelist.`, 'success');
}

async function addWhitelistUser() {
    const input = document.getElementById('userInput');
    if (!input) {
        console.error('User input element not found');
        return;
    }

    let userId = input.value.trim();

    if (!userId) {
        showNotification('Please enter a User ID.', 'warning');
        return;
    }

    // Strict user ID validation: 17-20 digits, numbers only
    const userIdRegex = /^\d{17,20}$/;
    if (!userIdRegex.test(userId)) {
        showEnhancedNotification('Invalid User ID', 'Enter a valid Discord user ID (17-20 digits, numbers only). No letters or @usernames are allowed.', 'warning');
        return;
    }

    // Validate the user exists in this server (best-effort)
    const isValid = await validateUserInServer(userId);
    if (!isValid) {
        showEnhancedNotification('User not found', 'That user ID was not found in this server. Double-check the ID and try again.', 'error');
        return;
    }

    // Ensure config is properly initialized
    currentLinkProtectionConfig = ensureLinkProtectionConfig(currentLinkProtectionConfig);

    // Check if user already exists
    if (currentLinkProtectionConfig.whitelist_users.includes(userId)) {
        showNotification('User already in whitelist.', 'warning');
        return;
    }

    // Add to config and UI
    currentLinkProtectionConfig.whitelist_users.push(userId);
    addUserToList(userId);
    input.value = '';
    markLinkProtectionUnsaved();

    showNotification(`User ID "${userId}" added to whitelist.`, 'success');
}

function addWhitelistRole() {
    const select = document.getElementById('roleSelect');
    if (!select || !select.value) {
        showNotification('Please select a role.', 'warning');
        return;
    }

    const roleId = select.value;

    // Validate role exists in server roles
    const role = serverRoles.find(r => r.id === roleId);
    if (!role) {
        showNotification('Selected role not found. Please refresh and try again.', 'error');
        return;
    }

    // Ensure config is properly initialized
    currentLinkProtectionConfig = ensureLinkProtectionConfig(currentLinkProtectionConfig);

    // Check if role already exists
    if (currentLinkProtectionConfig.whitelist_roles.includes(roleId)) {
        showNotification('Role already in whitelist.', 'warning');
        return;
    }

    // Add to config and UI
    currentLinkProtectionConfig.whitelist_roles.push(roleId);
    addRoleToList(roleId);
    select.value = '';
    markLinkProtectionUnsaved();

    showNotification(`Role "${role.name}" added to whitelist.`, 'success');
}

function addDomainToList(domain) {
    const domainList = document.getElementById('whitelistDomains');
    const domainTag = document.createElement('div');
    domainTag.className = 'domain-tag';
    domainTag.innerHTML = `
        <span>${domain}</span>
        <button class="domain-remove" onclick="removeDomain('${domain}')" title="Remove domain">×</button>
    `;
    domainList.appendChild(domainTag);
}

function addUserToList(userId) {
    const userList = document.getElementById('whitelistUsers');
    const userTag = document.createElement('div');
    userTag.className = 'user-tag';
    userTag.innerHTML = `
        <span>${userId}</span>
        <button class="user-remove" onclick="removeUser('${userId}')" title="Remove user">×</button>
    `;
    userList.appendChild(userTag);
}

function addRoleToList(roleId) {
    const roleList = document.getElementById('whitelistRoles');
    const role = serverRoles.find(r => r.id === roleId);
    const roleName = role ? role.name : roleId;

    const roleTag = document.createElement('div');
    roleTag.className = 'role-tag';
    roleTag.innerHTML = `
        <span>${roleName}</span>
        <button class="role-remove" onclick="removeRole('${roleId}')" title="Remove role">×</button>
    `;
    roleList.appendChild(roleTag);
}

function removeDomain(domain) {
    try {
        // Ensure config is properly initialized
        currentLinkProtectionConfig = ensureLinkProtectionConfig(currentLinkProtectionConfig);

        // Remove from config
        const index = currentLinkProtectionConfig.whitelist_domains.indexOf(domain);
        if (index > -1) {
            currentLinkProtectionConfig.whitelist_domains.splice(index, 1);
            markLinkProtectionUnsaved();
        }

        // Refresh the domain list
        populateLinkProtectionModal();
    } catch (error) {
        console.error('Error removing domain:', error);
        showEnhancedNotification('Error', 'Failed to remove domain', 'error');
    }
}

function removeUser(userId) {
    try {
        // Ensure config is properly initialized
        currentLinkProtectionConfig = ensureLinkProtectionConfig(currentLinkProtectionConfig);

        // Remove from config
        const index = currentLinkProtectionConfig.whitelist_users.indexOf(userId);
        if (index > -1) {
            currentLinkProtectionConfig.whitelist_users.splice(index, 1);
            markLinkProtectionUnsaved();
        }

        // Refresh the user list
        populateLinkProtectionModal();
    } catch (error) {
        console.error('Error removing user:', error);
        showEnhancedNotification('Error', 'Failed to remove user', 'error');
    }
}

function removeRole(roleId) {
    try {
        // Ensure config is properly initialized
        currentLinkProtectionConfig = ensureLinkProtectionConfig(currentLinkProtectionConfig);

        // Remove from config
        const index = currentLinkProtectionConfig.whitelist_roles.indexOf(roleId);
        if (index > -1) {
            currentLinkProtectionConfig.whitelist_roles.splice(index, 1);
            markLinkProtectionUnsaved();
        }

        // Refresh the role list
        populateLinkProtectionModal();
    } catch (error) {
        console.error('Error removing role:', error);
        showEnhancedNotification('Error', 'Failed to remove role', 'error');
    }
}

async function saveLinkProtectionConfig() {
    try {
        // Ensure config is properly initialized
        currentLinkProtectionConfig = ensureLinkProtectionConfig(currentLinkProtectionConfig);

        // Update config with current form values (only from existing elements)
        const punishmentSelect = document.getElementById('punishmentAction');

        if (punishmentSelect) {
            currentLinkProtectionConfig.punishment = punishmentSelect.value;
            console.log(`🎯 Updated punishment to: ${punishmentSelect.value}`);
        }

        // Set default values for missing checkboxes
        currentLinkProtectionConfig.block_suspicious = true;
        currentLinkProtectionConfig.scan_embeds = true;
        currentLinkProtectionConfig.check_redirects = true;
        currentLinkProtectionConfig.allow_media_links = true;

        // Log what we're about to save
        console.log('💾 Saving Link Protection config:', JSON.stringify(currentLinkProtectionConfig, null, 2));

        // Save to database
        const saved = await saveFeatureSetting('link-protection', true, currentLinkProtectionConfig);

        if (saved) {
            showEnhancedNotification('Success', 'Link protection configuration saved successfully!', 'success');

            // Reload the configuration to verify it was saved
            console.log('🔄 Reloading configuration to verify save...');
            await loadLinkProtectionConfig();

            // Clear unsaved state and hide banner
            linkProtectionUnsaved = false;
            hideUnsavedBanner();

            closeLinkProtectionModal();
        } else {
            showEnhancedNotification('Error', 'Failed to save configuration. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error saving link protection config:', error);
        showEnhancedNotification('Error', 'Failed to save configuration. Please try again.', 'error');
    }
}

function closeLinkProtectionModal() {
    // If a modal exists, close it
    const modal = document.getElementById('linkProtectionModal');
    if (modal) {
        modal.classList.remove('show');
        return;
    }
    // Fallback: hide inline config section and show features grid
    const configSection = document.getElementById('link-protection-config');
    const featuresGrid = document.querySelector('.features-grid');
    if (configSection && featuresGrid) {
        configSection.style.display = 'none';
        featuresGrid.style.display = 'grid';
    } else {
        console.warn('closeLinkProtectionModal: no modal or config section found');
    }
}

// Close modal when clicking outside (only if modal exists)
document.addEventListener('click', function(event) {
    const modal = document.getElementById('linkProtectionModal');
    if (modal && event.target === modal) {
        closeLinkProtectionModal();
    }
});


// Anti-Spam configuration
let currentAntiSpamConfig = {
    max_messages: 5,
    time_window: 5,
    duplicate_threshold: 3,
    mentions_per_message: 5,
    same_user_tag_threshold: 5,
    whitelist_roles: [],
    whitelist_users: [],
    punishment: 'delete'
};

function ensureAntiSpamConfig(cfg = {}) {
    return {
        max_messages: Math.max(1, Math.min(50, parseInt(cfg.max_messages ?? 5, 10) || 5)),
        time_window: 5, // fixed 5s window
        duplicate_threshold: Math.max(1, Math.min(10, parseInt(cfg.duplicate_threshold ?? 3, 10) || 3)),
        mentions_per_message: Math.max(0, Math.min(20, parseInt(cfg.mentions_per_message ?? 5, 10) || 5)),
        same_user_tag_threshold: Math.max(1, Math.min(50, parseInt(cfg.same_user_tag_threshold ?? 5, 10) || 5)),
        whitelist_roles: Array.isArray(cfg.whitelist_roles) ? cfg.whitelist_roles : [],
        whitelist_users: Array.isArray(cfg.whitelist_users) ? cfg.whitelist_users.map(String) : [],
        punishment: (cfg.punishment || 'delete')
    };
}

function toggleAntiSpamConfig() {
    const antiSpamToggle = document.getElementById('anti-spam-toggle');
    if (!antiSpamToggle || !antiSpamToggle.checked) {
        showNotification('Enable Anti-Spam to configure it.', 'warning');
        return;
    }
    const asSection = document.getElementById('anti-spam-config');
    const featuresGrid = document.querySelector('.features-grid');
    if (!asSection || !featuresGrid) return;

    const isHidden = asSection.style.display === 'none' || asSection.style.display === '';
    if (isHidden) {
        featuresGrid.style.display = 'none';
        asSection.style.display = 'block';
        loadAntiSpamConfig();
    } else {
        asSection.style.display = 'none';
        featuresGrid.style.display = 'grid';
    }
}

async function loadAntiSpamConfig() {
    try {
        // Load roles if not present
        if (!serverRoles || serverRoles.length === 0) {
            await loadServerRoles();
        }
        const response = await fetch(`${API_BASE_URL}/server/${currentServer.id}/settings`);
        if (!response.ok) throw new Error('Failed to load settings');
        const settings = await response.json();
        const cfg = settings?.anti_spam?.config || {};
        currentAntiSpamConfig = ensureAntiSpamConfig(cfg);
        populateAntiSpamConfig();
        // Hide unsaved strip initially
        hideUnsavedBanner();
    } catch (e) {
        console.error('Error loading Anti-Spam config:', e);
        showNotification('Failed to load Anti-Spam config. Using defaults.', 'warning');
        currentAntiSpamConfig = ensureAntiSpamConfig({});
        populateAntiSpamConfig();
    }
}

function populateAntiSpamConfig() {
    // numbers
    const mm = document.getElementById('asMaxMessages');
    const tw = document.getElementById('asTimeWindow');
    const du = document.getElementById('asDuplicates');
    const me = document.getElementById('asMaxMentions');
    const su = document.getElementById('asSameUserTagThreshold');
    const pu = document.getElementById('asPunishment');
    if (mm) mm.value = currentAntiSpamConfig.max_messages;
    if (tw) tw.value = currentAntiSpamConfig.time_window;
    if (du) du.value = currentAntiSpamConfig.duplicate_threshold;
    if (me) me.value = currentAntiSpamConfig.mentions_per_message;
    if (su) su.value = currentAntiSpamConfig.same_user_tag_threshold;
    if (pu) pu.value = currentAntiSpamConfig.punishment;

    // roles
    const roleSelect = document.getElementById('asRoleSelect');
    if (roleSelect) {
        roleSelect.innerHTML = '<option value="">Select a role</option>' +
            serverRoles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    }
    const roleList = document.getElementById('asRoleList');
    if (roleList) {
        roleList.innerHTML = '';
        currentAntiSpamConfig.whitelist_roles.forEach(rid => {
            const role = serverRoles.find(r => r.id === rid);
            const name = role ? role.name : rid;
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.innerHTML = `${name} <button class="tag-remove" aria-label="Remove" onclick="removeAntiSpamRole('${rid}')">×</button>`;
            roleList.appendChild(tag);
        });
    }

    // users
    const userList = document.getElementById('asUserList');
    if (userList) {
        userList.innerHTML = '';
        currentAntiSpamConfig.whitelist_users.forEach(uid => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.innerHTML = `${uid} <button class="tag-remove" aria-label="Remove" onclick="removeAntiSpamUser('${uid}')">×</button>`;
            userList.appendChild(tag);
        });
    }

    // wire unsaved markers
    ['asMaxMessages','asTimeWindow','asDuplicates','asMaxMentions','asSameUserTagThreshold','asPunishment'].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener('change', () => { setUnsavedStripText('Your anti-spam settings have changed.'); showUnsavedBanner(); });
    });
}

function addAntiSpamRole() {
    const select = document.getElementById('asRoleSelect');
    const rid = select?.value;
    if (!rid) return;
    if (!Array.isArray(currentAntiSpamConfig.whitelist_roles)) currentAntiSpamConfig.whitelist_roles = [];
    if (!currentAntiSpamConfig.whitelist_roles.includes(rid)) {
        currentAntiSpamConfig.whitelist_roles.push(rid);
        populateAntiSpamConfig();
        setUnsavedStripText('Your anti-spam settings have changed.');
        showUnsavedBanner();
    }
    select.value = '';
}

function removeAntiSpamRole(roleId) {
    if (!Array.isArray(currentAntiSpamConfig.whitelist_roles)) return;
    currentAntiSpamConfig.whitelist_roles = currentAntiSpamConfig.whitelist_roles.filter(r => r !== roleId);
    populateAntiSpamConfig();
    setUnsavedStripText('Your anti-spam settings have changed.');
    showUnsavedBanner();
}

function addAntiSpamUser() {
    const input = document.getElementById('asUserInput');
    const userId = (input?.value || '').trim();
    const userIdRegex = /^\d{17,20}$/;
    if (!userIdRegex.test(userId)) {
        showEnhancedNotification('Invalid User ID', 'Enter a valid Discord user ID (17-20 digits, numbers only).', 'warning');
        return;
    }
    if (!Array.isArray(currentAntiSpamConfig.whitelist_users)) currentAntiSpamConfig.whitelist_users = [];
    if (!currentAntiSpamConfig.whitelist_users.includes(userId)) {
        currentAntiSpamConfig.whitelist_users.push(userId);
        populateAntiSpamConfig();
        setUnsavedStripText('Your anti-spam settings have changed.');
        showUnsavedBanner();
    }
    if (input) input.value = '';
}

function removeAntiSpamUser(userId) {
    if (!Array.isArray(currentAntiSpamConfig.whitelist_users)) return;
    currentAntiSpamConfig.whitelist_users = currentAntiSpamConfig.whitelist_users.filter(u => u !== userId);
    populateAntiSpamConfig();
    setUnsavedStripText('Your anti-spam settings have changed.');
    showUnsavedBanner();
}

async function saveAntiSpamConfig() {
    try {
        // Refresh from inputs
        const mm = parseInt(document.getElementById('asMaxMessages')?.value || currentAntiSpamConfig.max_messages, 10);
        const tw = 5; // fixed 5s window
        const du = parseInt(document.getElementById('asDuplicates')?.value || currentAntiSpamConfig.duplicate_threshold, 10);
        const me = parseInt(document.getElementById('asMaxMentions')?.value || currentAntiSpamConfig.mentions_per_message, 10);
        const su = parseInt(document.getElementById('asSameUserTagThreshold')?.value || currentAntiSpamConfig.same_user_tag_threshold, 10);
        const pu = document.getElementById('asPunishment')?.value || currentAntiSpamConfig.punishment;
        currentAntiSpamConfig = ensureAntiSpamConfig({
            max_messages: mm,
            time_window: tw,
            duplicate_threshold: du,
            mentions_per_message: me,
            same_user_tag_threshold: su,
            whitelist_roles: currentAntiSpamConfig.whitelist_roles,
            whitelist_users: currentAntiSpamConfig.whitelist_users,
            punishment: pu
        });

        const saved = await saveFeatureSetting('anti_spam', true, currentAntiSpamConfig);
        if (saved) {
            showEnhancedNotification('Saved', 'Anti-Spam configuration saved successfully.', 'success');
            hideUnsavedBanner();
            await loadAntiSpamConfig();
        }
    } catch (e) {
        console.error('Error saving Anti-Spam config:', e);
        showEnhancedNotification('Error', 'Failed to save Anti-Spam configuration.', 'error');
    }
}

// Handle Enter key in domain input
document.addEventListener('DOMContentLoaded', function() {
    const domainInput = document.getElementById('domainInput');
    if (domainInput) {
        domainInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                addWhitelistDomain();
            }
        });
    }
});

// Dashboard action functions
function viewAllSecurityEvents() {
    // This would open a detailed security events page
    console.log('Opening detailed security events for server:', currentServer.id);
    // For now, just show an alert
    showNotification('Detailed security events view coming soon!', 'info');
}

function exportSecurityReport() {
    // This would generate and download a security report
    console.log('Exporting security report for server:', currentServer.id);
    showNotification('Security report export coming soon!', 'info');
}

// Utility functions
// Enhanced notification system
function showEnhancedNotification(title, message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    // Get icon based on type
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    notification.innerHTML = `
        <div class="notification-icon">${icons[type] || icons.info}</div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="removeNotification(this.parentElement)">×</button>
    `;

    // Add to container
    container.appendChild(notification);

    // Trigger show animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Auto remove after 5 seconds
    setTimeout(() => removeNotification(notification), 5000);

    console.log(`📢 ${type.toUpperCase()}: ${title} - ${message}`);
}

function removeNotification(notification) {
    if (!notification || !notification.parentElement) return;

    notification.classList.remove('show');
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 300);
}

// Legacy notification function for backward compatibility
function showNotification(message, type = 'info') {
    showEnhancedNotification(
        type.charAt(0).toUpperCase() + type.slice(1),
        message,
        type
    );
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) {
        return `${diffInSeconds} seconds ago`;
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }
}

// Add some interactive features
document.addEventListener('DOMContentLoaded', () => {
    // Add hover effects to status cards
    const statusCards = document.querySelectorAll('.status-card');
    statusCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-2px)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
    });

    // Add click handlers for interactive elements
    const viewAllButton = document.querySelector('.card-header .btn');
    if (viewAllButton) {
        viewAllButton.addEventListener('click', viewAllSecurityEvents);
    }

    // Add keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            goBackToServers();
        }
    });
});

// Simulate real-time updates with WebSocket-like behavior
function simulateRealTimeUpdates() {
    // This would typically connect to a WebSocket or use Server-Sent Events
    // For demo purposes, we'll simulate updates less frequently
    setInterval(() => {
        // Randomly update some metrics (less frequently)
        if (Math.random() > 0.9) {
            const event = generateRandomSecurityEvent();
            addSecurityEvent(event);
        }
    }, 60000); // Every 60 seconds to reduce refreshes
}

function generateRandomSecurityEvent() {
    const events = [
        {
            type: 'blocked',
            title: 'Spam attempt blocked',
            description: 'User attempted to send multiple messages rapidly',
            icon: 'blocked'
        },
        {
            type: 'success',
            title: 'User verified successfully',
            description: 'New member completed verification process',
            icon: 'success'
        },
        {
            type: 'warning',
            title: 'Suspicious activity detected',
            description: 'Unusual message pattern identified',
            icon: 'warning'
        }
    ];

    return events[Math.floor(Math.random() * events.length)];
}

function addSecurityEvent(event) {
    const activityList = document.querySelector('.activity-list');
    if (!activityList) return;

    const eventElement = document.createElement('div');
    eventElement.className = 'activity-item';
    eventElement.style.opacity = '0';
    eventElement.style.transform = 'translateY(-10px)';

    eventElement.innerHTML = `
        <div class="activity-icon ${event.icon}">
            <svg viewBox="0 0 24 24">
                ${event.icon === 'blocked' ?
                    '<circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>' :
                event.icon === 'success' ?
                    '<path d="M9 12l2 2 4-4" stroke="currentColor" fill="none" stroke-width="2"/><circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" stroke-width="2"/>' :
                    '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" fill="none" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="17" r="1" fill="currentColor"/>'
                }
            </svg>
        </div>
        <div class="activity-content">
            <p class="activity-title">${event.title}</p>
            <p class="activity-description">${event.description}</p>
            <span class="activity-time">Just now</span>
        </div>
    `;

    // Insert at the beginning
    activityList.insertBefore(eventElement, activityList.firstChild);

    // Animate in
    setTimeout(() => {
        eventElement.style.transition = 'all 0.3s ease';
        eventElement.style.opacity = '1';
        eventElement.style.transform = 'translateY(0)';
    }, 100);

    // Remove oldest events if there are too many
    const events = activityList.querySelectorAll('.activity-item');
    if (events.length > 5) {
        const oldestEvent = events[events.length - 1];
        oldestEvent.style.opacity = '0';
        oldestEvent.style.transform = 'translateY(10px)';
        setTimeout(() => {
            if (oldestEvent.parentNode) {
                oldestEvent.parentNode.removeChild(oldestEvent);
            }
        }, 300);
    }
}

// Initialize real-time updates (disabled to prevent constant refreshes)
// setTimeout(simulateRealTimeUpdates, 5000);

// Features Management
function setupFeatures() {
    // Get all toggle switches
    const toggles = document.querySelectorAll('.toggle-switch input[type="checkbox"]');

    toggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const featureId = e.target.id;
            const isEnabled = e.target.checked;

            handleFeatureToggle(featureId, isEnabled);

            // Update feature settings visibility
            const featureCard = e.target.closest('.feature-card');
            const featureSettings = featureCard.querySelector('.feature-settings');

            if (featureSettings) {
                if (isEnabled) {
                    featureSettings.style.opacity = '1';
                    featureSettings.style.pointerEvents = 'auto';
                } else {
                    featureSettings.style.opacity = '0.5';
                    featureSettings.style.pointerEvents = 'none';
                }
            }
        });

        // Initialize settings visibility based on current state
        const featureCard = toggle.closest('.feature-card');
        const featureSettings = featureCard?.querySelector('.feature-settings');

        if (featureSettings) {
            if (!toggle.checked) {
                featureSettings.style.opacity = '0.5';
                featureSettings.style.pointerEvents = 'none';
            }
        }
    });

    // Handle setting changes
    const settingInputs = document.querySelectorAll('.setting-input, .setting-select');
    settingInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            const featureCard = e.target.closest('.feature-card');
            const featureToggle = featureCard.querySelector('.toggle-switch input[type="checkbox"]');
            const featureId = featureToggle?.id;

            if (featureId) {
                handleSettingChange(featureId, e.target.name || e.target.className, e.target.value);
            }
        });
    });
}

function handleFeatureToggle(featureId, isEnabled) {
    const featureName = getFeatureName(featureId);

    console.log(`${featureName} ${isEnabled ? 'enabled' : 'disabled'} for server:`, currentServer.id);

    // Show notification
    showNotification(
        `${featureName} has been ${isEnabled ? 'enabled' : 'disabled'}`,
        isEnabled ? 'success' : 'info'
    );

    // Here you would typically make an API call to save the setting
    // saveFeatureSetting(currentServer.id, featureId, isEnabled);
}

function handleSettingChange(featureId, settingName, value) {
    const featureName = getFeatureName(featureId);

    console.log(`${featureName} setting changed:`, settingName, '=', value);

    // Here you would typically make an API call to save the setting
    // saveFeatureSetting(currentServer.id, featureId, { [settingName]: value });

}

// Member Verification Modal handlers
function openVerificationModal() {
    const modal = document.getElementById('verificationModal');
    if (modal) modal.classList.add('show');
}
function closeVerificationModal() {
    const modal = document.getElementById('verificationModal');
    if (modal) modal.classList.remove('show');
}

// Disable Verification Confirmation Modal handlers
function openDisableVerificationModal() {
    const modal = document.getElementById('disableVerificationModal');
    if (modal) modal.classList.add('show');
}

function closeDisableVerificationModal() {
    const modal = document.getElementById('disableVerificationModal');
    if (modal) modal.classList.remove('show');
}

async function confirmDisableVerification() {
    const modal = document.getElementById('disableVerificationModal');
    const confirmBtn = document.getElementById('confirmDisableBtn');
    const toggleEl = document.getElementById('verification-toggle');
    const featureCard = toggleEl.closest('.feature-card');

    // Check 60-second cooldown for verification actions
    const lastAction = localStorage.getItem(`verification_action_${currentServer?.id}`);
    if (lastAction) {
        const timeSince = Date.now() - parseInt(lastAction);
        if (timeSince < 60000) { // 60 seconds
            const remaining = Math.ceil((60000 - timeSince) / 1000);
            showEnhancedNotification('Action Cooldown', `Please wait ${remaining} seconds before enabling/disabling verification again.`, 'warning');
            closeDisableVerificationModal();
            return;
        }
    }

    // Show loading state
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `
        <svg class="btn-icon animate-spin" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" stroke-width="2" opacity="0.25"/>
            <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"/>
        </svg>
        Disabling...
    `;

    try {
        // Close modal first for better UX
        modal.classList.remove('show');

        // Add updating animation to feature card
        featureCard.classList.add('updating');

        // Disable the toggle
        toggleEl.checked = false;

        // Save the disabled state with cleanup flag for manual disable
        const saved = await saveFeatureSetting('verification', false, { pending_disable: true, manual_disable: true });

        if (saved) {
            // Set cooldown timestamp
            localStorage.setItem(`verification_action_${currentServer?.id}`, Date.now().toString());

            updateFeatureUI('verification', false);
            featureCard.classList.remove('updating');
            featureCard.classList.add('success');
            setTimeout(() => featureCard.classList.remove('success'), 600);

            showEnhancedNotification(
                'Verification System Disabled',
                'All verification components (including channel) are being removed. This may take a few moments.',
                'success'
            );
        } else {
            // Revert on failure
            featureCard.classList.remove('updating');
            toggleEl.checked = true;
            showEnhancedNotification('Failed to Disable', 'Could not disable verification system. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error disabling verification:', error);

        // Revert on error
        featureCard.classList.remove('updating');
        toggleEl.checked = true;
        showEnhancedNotification('Error', 'An error occurred while disabling verification.', 'error');
    } finally {
        // Reset button state
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `
            <svg viewBox="0 0 24 24" class="btn-icon">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" fill="none" stroke-width="2"/>
            </svg>
            Yes, Disable & Delete All
        `;
    }
}

async function saveVerificationConfig() {
    const btn = document.getElementById('verifSaveBtn');
    if (btn?.dataset.busy === '1') return; // guard double clicks

    // Check 60-second cooldown for verification actions
    const lastAction = localStorage.getItem(`verification_action_${currentServer?.id}`);
    if (lastAction) {
        const timeSince = Date.now() - parseInt(lastAction);
        if (timeSince < 60000) { // 60 seconds
            const remaining = Math.ceil((60000 - timeSince) / 1000);
            showEnhancedNotification('Action Cooldown', `Please wait ${remaining} seconds before enabling/disabling verification again.`, 'warning');
            return;
        }
    }

    try {
        if (btn) { btn.disabled = true; btn.dataset.busy = '1'; }
        // Ensure roles are loaded to validate role ID
        if (!serverRoles || serverRoles.length === 0) {
            await loadServerRoles();
        }
        const system = (document.getElementById('verifSystemSelect')?.value || 'simple');
        const roleId = (document.getElementById('verifMemberRoleId')?.value || '').trim();

        if (!/^\d{17,20}$/.test(roleId)) {
            return showEnhancedNotification('Invalid role ID', 'Please enter a valid role ID (17-20 digits).', 'error');
        }

        // Validate role exists in this server
        const roleExists = !!serverRoles.find(r => String(r.id) === String(roleId));
        if (!roleExists) {
            return showEnhancedNotification('Role not found', 'The provided role ID does not exist in this server.', 'error');
        }

        const cfg = {
            verification_type: system,
            member_role_id: roleId,
            auto_create_channel: true // Signal to bot to create channel automatically
        };

        const saved = await saveFeatureSetting('verification', true, cfg);
        if (saved) {
            // Set cooldown timestamp
            localStorage.setItem(`verification_action_${currentServer?.id}`, Date.now().toString());

            // Turn on the toggle now that it is configured
            const toggleEl = document.getElementById('verification-toggle');
            if (toggleEl) toggleEl.checked = true;
            updateFeatureUI('verification', true);
            showEnhancedNotification('Verification Enabled', 'The bot will create a verification channel, "Unverified" role, and post the verification message.', 'success');
            closeVerificationModal();
        } else {
            showEnhancedNotification('Error', 'Failed to save verification settings.', 'error');
        }
    } catch (e) {
        console.error('saveVerificationConfig error:', e);
        showEnhancedNotification('Error', 'Failed to save verification settings.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.dataset.busy = '0'; }
    }
}

function getFeatureName(featureId) {
    const featureNames = {
        'anti-spam-toggle': 'Anti-Spam Protection',
        'auto-mod-toggle': 'Auto-Moderation',
        'welcome-toggle': 'Welcome Messages',
        'raid-protection-toggle': 'Raid Protection',
        'link-protection-toggle': 'Link Protection',
        'verification-toggle': 'Member Verification'
    };

    return featureNames[featureId] || 'Feature';
}

// Feature presets
function applySecurityPreset() {
    const securityFeatures = [
        'anti-spam-toggle',
        'auto-mod-toggle',
        'raid-protection-toggle',
        'link-protection-toggle'
    ];

    securityFeatures.forEach(featureId => {
        const toggle = document.getElementById(featureId);
        if (toggle && !toggle.checked) {
            toggle.checked = true;
            toggle.dispatchEvent(new Event('change'));
        }
    });

    showNotification('Security preset applied successfully!', 'success');
}

function applyWelcomePreset() {
    const welcomeFeatures = [
        'welcome-toggle',
        'verification-toggle'
    ];

    welcomeFeatures.forEach(featureId => {
        const toggle = document.getElementById(featureId);
        if (toggle && !toggle.checked) {
            toggle.checked = true;
            toggle.dispatchEvent(new Event('change'));
        }
    });

    showNotification('Welcome preset applied successfully!', 'success');
}
