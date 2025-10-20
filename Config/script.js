// Config Page - Server Configuration Management
let currentServer = null;
let serverRoles = [];
let currentLinkProtectionConfig = {
    whitelist_domains: [],
    whitelist_users: [],
    whitelist_roles: [],
    block_suspicious: true,
    scan_embeds: true,
    check_redirects: true,
    allow_media_links: true,
    punishment: 'delete',
    warn_message: 'Links are not allowed in this server.'
};

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    initConfigPage();
});

async function initConfigPage() {
    try {
        // Get server info from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const serverId = urlParams.get('server');
        const serverName = urlParams.get('name');

        if (!serverId) {
            showError('No server specified. Please select a server from the dashboard.');
            return;
        }

        currentServer = {
            id: serverId,
            name: decodeURIComponent(serverName || 'Unknown Server')
        };

        console.log('Loading configuration for server:', currentServer);

        // Load server data and configuration
        await Promise.all([
            loadServerInfo(),
            loadServerRoles(),
            loadServerConfiguration()
        ]);

        // Setup UI
        setupToggleHandlers();
        populateConfiguration();
        
        // Show main content
        hideLoading();
        document.getElementById('mainContent').style.display = 'block';

    } catch (error) {
        console.error('Config initialization error:', error);
        showError('Failed to load server configuration. Please try again.');
    }
}

async function loadServerInfo() {
    try {
        // Update server header with basic info
        document.getElementById('serverName').textContent = currentServer.name;
        document.getElementById('serverId').textContent = currentServer.id;
        
        // Set server icon (first letters of server name)
        const iconText = currentServer.name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
        document.getElementById('serverIconText').textContent = iconText;

        console.log('Server info loaded');
    } catch (error) {
        console.error('Error loading server info:', error);
    }
}

async function loadServerRoles() {
    try {
        console.log('Loading server roles...');
        
        // Get Discord access token
        const accessToken = sessionStorage.getItem('discord_access_token');
        if (!accessToken) {
            throw new Error('No Discord access token found');
        }

        // Fetch roles from our API proxy (which handles Discord API)
        const response = await fetch(`${window.AppConfig.api.baseUrl}/discord/server/${currentServer.id}/roles`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('Missing permissions to access server roles');
            } else if (response.status === 401) {
                throw new Error('Invalid or expired Discord token');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }

        const roles = await response.json();

        // Roles are already filtered and sorted by the API
        serverRoles = roles;

        console.log(`Loaded ${serverRoles.length} server roles`);

        // Update role count in header
        document.getElementById('roleCount').textContent = serverRoles.length;

        // Populate role select dropdown
        const roleSelect = document.getElementById('roleSelect');
        roleSelect.innerHTML = '<option value="">Select a role...</option>';
        
        serverRoles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = role.name;
            option.style.color = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '';
            roleSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Error loading server roles:', error);
        
        // Fallback: show error in role select
        const roleSelect = document.getElementById('roleSelect');
        roleSelect.innerHTML = '<option value="">Failed to load roles</option>';
        
        // Set role count to error state
        document.getElementById('roleCount').textContent = '!';
    }
}

async function loadServerConfiguration() {
    try {
        console.log('Loading server configuration...');
        
        // Load configuration from API
        const response = await fetch(`${window.AppConfig.api.baseUrl}/server/${currentServer.id}/settings`);
        
        if (response.ok) {
            const settings = await response.json();
            
            if (settings.link_protection && settings.link_protection.config) {
                currentLinkProtectionConfig = ensureLinkProtectionConfig(settings.link_protection.config);
                
                // Set enabled state
                document.getElementById('linkProtectionEnabled').checked = settings.link_protection.enabled || false;
            }
        } else {
            console.warn('Failed to load server configuration, using defaults');
        }

        console.log('Server configuration loaded');
    } catch (error) {
        console.error('Error loading server configuration:', error);
        console.log('Using default configuration');
    }
}

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
        punishment: config?.punishment || 'delete',
        warn_message: config?.warn_message || 'Links are not allowed in this server.'
    };
}

function setupToggleHandlers() {
    const linkProtectionToggle = document.getElementById('linkProtectionEnabled');
    const linkProtectionContent = document.getElementById('linkProtectionContent');
    
    function updateContentVisibility() {
        if (linkProtectionToggle.checked) {
            linkProtectionContent.classList.add('active');
        } else {
            linkProtectionContent.classList.remove('active');
        }
    }
    
    linkProtectionToggle.addEventListener('change', updateContentVisibility);
    updateContentVisibility(); // Initial state
}

function populateConfiguration() {
    try {
        console.log('Populating configuration UI...');
        
        // Populate whitelist domains
        const domainList = document.getElementById('whitelistDomains');
        domainList.innerHTML = '';
        currentLinkProtectionConfig.whitelist_domains.forEach(domain => {
            addTagToList(domainList, domain, 'domain');
        });
        
        // Populate whitelist users
        const userList = document.getElementById('whitelistUsers');
        userList.innerHTML = '';
        currentLinkProtectionConfig.whitelist_users.forEach(userId => {
            addTagToList(userList, userId, 'user');
        });
        
        // Populate whitelist roles
        const roleList = document.getElementById('whitelistRoles');
        roleList.innerHTML = '';
        currentLinkProtectionConfig.whitelist_roles.forEach(roleId => {
            const role = serverRoles.find(r => r.id === roleId);
            const roleName = role ? role.name : roleId;
            addTagToList(roleList, roleId, 'role', roleName);
        });
        
        // Populate checkboxes
        document.getElementById('blockSuspicious').checked = currentLinkProtectionConfig.block_suspicious;
        document.getElementById('scanEmbeds').checked = currentLinkProtectionConfig.scan_embeds;
        document.getElementById('checkRedirects').checked = currentLinkProtectionConfig.check_redirects;
        document.getElementById('allowMediaLinks').checked = currentLinkProtectionConfig.allow_media_links;
        
        // Populate punishment select
        document.getElementById('punishmentAction').value = currentLinkProtectionConfig.punishment;
        
        // Populate warning message
        document.getElementById('warnMessage').value = currentLinkProtectionConfig.warn_message;
        
        console.log('Configuration UI populated');
    } catch (error) {
        console.error('Error populating configuration:', error);
    }
}

function addTagToList(container, value, type, displayName = null) {
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.innerHTML = `
        <span>${displayName || value}</span>
        <button class="tag-remove" onclick="removeTag('${value}', '${type}')" title="Remove">×</button>
    `;
    container.appendChild(tag);
}

// Domain validation function
function isValidURL(string) {
    try {
        new URL('http://' + string);
        return true;
    } catch (_) {
        return false;
    }
}

function addWhitelistDomain() {
    const input = document.getElementById('domainInput');
    const domain = input.value.trim().toLowerCase();
    
    if (!domain) {
        showNotification('Please enter a domain name.', 'warning');
        return;
    }
    
    // Enhanced domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
    if (!domainRegex.test(domain) && !isValidURL(domain)) {
        showNotification('Please enter a valid domain name (e.g., example.com).', 'error');
        return;
    }
    
    if (currentLinkProtectionConfig.whitelist_domains.includes(domain)) {
        showNotification('Domain already in whitelist.', 'warning');
        return;
    }
    
    currentLinkProtectionConfig.whitelist_domains.push(domain);
    addTagToList(document.getElementById('whitelistDomains'), domain, 'domain');
    input.value = '';
}

function addWhitelistUser() {
    const input = document.getElementById('userInput');
    let userId = input.value.trim();
    
    if (!userId) {
        showNotification('Please enter a User ID or @username.', 'warning');
        return;
    }
    
    // Remove @ if present
    if (userId.startsWith('@')) {
        userId = userId.substring(1);
    }
    
    // Basic user ID validation (Discord user IDs are 17-19 digits)
    const userIdRegex = /^\d{17,19}$/;
    if (!userIdRegex.test(userId) && userId.length < 2) {
        showNotification('Please enter a valid User ID (17-19 digits) or username.', 'error');
        return;
    }
    
    if (currentLinkProtectionConfig.whitelist_users.includes(userId)) {
        showNotification('User already in whitelist.', 'warning');
        return;
    }
    
    currentLinkProtectionConfig.whitelist_users.push(userId);
    addTagToList(document.getElementById('whitelistUsers'), userId, 'user');
    input.value = '';
}

function addWhitelistRole() {
    const select = document.getElementById('roleSelect');
    if (!select.value) {
        showNotification('Please select a role.', 'warning');
        return;
    }
    
    const roleId = select.value;
    const role = serverRoles.find(r => r.id === roleId);
    
    if (currentLinkProtectionConfig.whitelist_roles.includes(roleId)) {
        showNotification('Role already in whitelist.', 'warning');
        return;
    }
    
    currentLinkProtectionConfig.whitelist_roles.push(roleId);
    addTagToList(document.getElementById('whitelistRoles'), roleId, 'role', role ? role.name : roleId);
    select.value = '';
}

function removeTag(value, type) {
    switch (type) {
        case 'domain':
            const domainIndex = currentLinkProtectionConfig.whitelist_domains.indexOf(value);
            if (domainIndex > -1) {
                currentLinkProtectionConfig.whitelist_domains.splice(domainIndex, 1);
            }
            break;
        case 'user':
            const userIndex = currentLinkProtectionConfig.whitelist_users.indexOf(value);
            if (userIndex > -1) {
                currentLinkProtectionConfig.whitelist_users.splice(userIndex, 1);
            }
            break;
        case 'role':
            const roleIndex = currentLinkProtectionConfig.whitelist_roles.indexOf(value);
            if (roleIndex > -1) {
                currentLinkProtectionConfig.whitelist_roles.splice(roleIndex, 1);
            }
            break;
    }
    
    // Refresh the UI
    populateConfiguration();
}

async function saveLinkProtectionConfig() {
    try {
        console.log('Saving link protection configuration...');
        
        // Update config with current form values
        currentLinkProtectionConfig.block_suspicious = document.getElementById('blockSuspicious').checked;
        currentLinkProtectionConfig.scan_embeds = document.getElementById('scanEmbeds').checked;
        currentLinkProtectionConfig.check_redirects = document.getElementById('checkRedirects').checked;
        currentLinkProtectionConfig.allow_media_links = document.getElementById('allowMediaLinks').checked;
        currentLinkProtectionConfig.punishment = document.getElementById('punishmentAction').value;
        currentLinkProtectionConfig.warn_message = document.getElementById('warnMessage').value.trim() || 'Links are not allowed in this server.';
        
        const isEnabled = document.getElementById('linkProtectionEnabled').checked;
        
        // Save to database via API
        const response = await fetch(`${window.AppConfig.api.baseUrl}/server/${currentServer.id}/feature/link-protection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                enabled: isEnabled,
                config: currentLinkProtectionConfig
            })
        });
        
        if (response.ok) {
            showNotification('Link protection configuration saved successfully!', 'success');
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('Error saving configuration:', error);
        showNotification('Failed to save configuration. Please try again.', 'error');
    }
}

// Utility functions
function hideLoading() {
    document.getElementById('loadingContainer').style.display = 'none';
}

function showError(message) {
    document.getElementById('loadingContainer').style.display = 'none';
    document.getElementById('errorContainer').style.display = 'flex';
    document.getElementById('errorDescription').textContent = message;
}

function retryLoad() {
    document.getElementById('errorContainer').style.display = 'none';
    document.getElementById('loadingContainer').style.display = 'flex';
    initConfigPage();
}

function goBack() {
    // Go back to dashboard or MyServers
    const referrer = document.referrer;
    if (referrer && referrer.includes('/Dashboard/')) {
        window.location.href = `/Dashboard/index.html?server=${currentServer.id}&name=${encodeURIComponent(currentServer.name)}`;
    } else {
        window.location.href = '/MyServers/index.html';
    }
}

function logout() {
    sessionStorage.removeItem('discord_access_token');
    window.location.href = '/SecurityLandingPage/index.html';
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}
