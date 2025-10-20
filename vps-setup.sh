#!/bin/bash

################################################################################
# SecurityBot VPS Setup Script - Automated Deployment
################################################################################
# This script will automatically:
# - Install all necessary dependencies (Node.js, Nginx, Certbot, PM2)
# - Configure SSL certificates with Let's Encrypt
# - Set up Nginx as reverse proxy
# - Configure and start the Discord bot
# - Configure and start the API server
# - Serve the website with HTTPS
################################################################################

################################################################################
# ⚙️ CONFIGURATION SECTION - EDIT THESE VALUES BEFORE RUNNING
################################################################################

# Domain Configuration
DOMAIN_NAME="secureguard.ink"              # Your domain name (e.g., bot.example.com)
SSL_EMAIL="progamersgr1@gmail.com"              # Email for SSL certificate notifications

# Discord Bot Configuration
DISCORD_TOKEN="MTQxNjA1NzI1OTE3NTQ0NDY0NA.GW0Pzj.HruXrKnoySeXeSe1CBPRyYIGR8a6TYvyS-QQxM"
DISCORD_CLIENT_ID="1416057259175444644"
DISCORD_CLIENT_SECRET="9jXb-xOrQTABGFabwvg_6mmBwVpNq3QI"

# Supabase Configuration
SUPABASE_URL="https://xxhmypokrnsmuqkdfdkt.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aG15cG9rcm5zbXVxa2RmZGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MDExMzksImV4cCI6MjA3NjA3NzEzOX0.ccDzSr8LzgxbHAfoAnEvQtfRMIF6zt-XyqoFisIp6bU"

# Port Configuration (you can leave these as default)
API_PORT="3004"                            # Port for API server
WEB_PORT="3000"                            # Port for web server (internal)

# Project Directory (leave as-is to use current directory)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$SCRIPT_DIR"

################################################################################
# DO NOT EDIT BELOW THIS LINE UNLESS YOU KNOW WHAT YOU'RE DOING
################################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run this script as root or with sudo"
    exit 1
fi

print_info "==================================================================="
print_info "SecurityBot VPS Setup - Automated Deployment"
print_info "==================================================================="
echo ""

################################################################################
# STEP 1: Validate Configuration
################################################################################

print_info "Validating configuration..."
echo ""

VALIDATION_FAILED=0

# Check domain name
if [ "$DOMAIN_NAME" = "bot.example.com" ] || [ -z "$DOMAIN_NAME" ]; then
    print_error "Please set DOMAIN_NAME in the configuration section at the top of this script"
    VALIDATION_FAILED=1
fi

# Check SSL email
if [ "$SSL_EMAIL" = "admin@example.com" ] || [ -z "$SSL_EMAIL" ]; then
    print_error "Please set SSL_EMAIL in the configuration section at the top of this script"
    VALIDATION_FAILED=1
fi

# Check Discord token
if [ "$DISCORD_TOKEN" = "YOUR_DISCORD_BOT_TOKEN_HERE" ] || [ -z "$DISCORD_TOKEN" ]; then
    print_error "Please set DISCORD_TOKEN in the configuration section at the top of this script"
    VALIDATION_FAILED=1
fi

# Check Discord client ID
if [ "$DISCORD_CLIENT_ID" = "YOUR_DISCORD_CLIENT_ID_HERE" ] || [ -z "$DISCORD_CLIENT_ID" ]; then
    print_error "Please set DISCORD_CLIENT_ID in the configuration section at the top of this script"
    VALIDATION_FAILED=1
fi

# Check Discord client secret
if [ "$DISCORD_CLIENT_SECRET" = "YOUR_DISCORD_CLIENT_SECRET_HERE" ] || [ -z "$DISCORD_CLIENT_SECRET" ]; then
    print_error "Please set DISCORD_CLIENT_SECRET in the configuration section at the top of this script"
    VALIDATION_FAILED=1
fi

# Check Supabase URL
if [ "$SUPABASE_URL" = "https://your-project.supabase.co" ] || [ -z "$SUPABASE_URL" ]; then
    print_error "Please set SUPABASE_URL in the configuration section at the top of this script"
    VALIDATION_FAILED=1
fi

# Check Supabase anon key
if [ "$SUPABASE_ANON_KEY" = "YOUR_SUPABASE_ANON_KEY_HERE" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    print_error "Please set SUPABASE_ANON_KEY in the configuration section at the top of this script"
    VALIDATION_FAILED=1
fi

if [ $VALIDATION_FAILED -eq 1 ]; then
    echo ""
    print_error "Configuration validation failed!"
    print_info "Please edit the CONFIGURATION SECTION at the top of this script with your values"
    print_info "Then run the script again: sudo ./vps-setup.sh"
    exit 1
fi

print_success "Configuration validated successfully!"
echo ""

# Display configuration summary
print_info "==================================================================="
print_info "Configuration Summary:"
print_info "==================================================================="
echo "Domain Name:        $DOMAIN_NAME"
echo "SSL Email:          $SSL_EMAIL"
echo "Discord Client ID:  $DISCORD_CLIENT_ID"
echo "Supabase URL:       $SUPABASE_URL"
echo "API Port:           $API_PORT"
echo "Web Port:           $WEB_PORT"
echo "Project Directory:  $PROJECT_DIR"
print_info "==================================================================="
echo ""
print_info "Starting automated deployment in 5 seconds..."
print_info "Press Ctrl+C to cancel"
sleep 5

################################################################################
# STEP 2: Update System and Install Dependencies
################################################################################

print_info "\n==================================================================="
print_info "STEP 2: Installing System Dependencies"
print_info "==================================================================="

print_info "Updating system packages..."
apt-get update
apt-get upgrade -y

print_info "Installing essential packages..."
apt-get install -y curl wget git build-essential software-properties-common

################################################################################
# STEP 3: Install Node.js
################################################################################

print_info "\n==================================================================="
print_info "STEP 3: Installing Node.js"
print_info "==================================================================="

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_warning "Node.js is already installed: $NODE_VERSION"
    read -p "$(echo -e ${YELLOW}Do you want to reinstall Node.js? [y/N]: ${NC})" reinstall_node
    if [[ $reinstall_node =~ ^[Yy]$ ]]; then
        print_info "Installing Node.js 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
else
    print_info "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

print_success "Node.js version: $(node -v)"
print_success "NPM version: $(npm -v)"

################################################################################
# STEP 4: Install PM2 (Process Manager)
################################################################################

print_info "\n==================================================================="
print_info "STEP 4: Installing PM2 Process Manager"
print_info "==================================================================="

if command -v pm2 &> /dev/null; then
    print_warning "PM2 is already installed"
else
    print_info "Installing PM2 globally..."
    npm install -g pm2
fi

print_success "PM2 version: $(pm2 -v)"

################################################################################
# STEP 5: Install and Configure Nginx
################################################################################

print_info "\n==================================================================="
print_info "STEP 5: Installing and Configuring Nginx"
print_info "==================================================================="

if command -v nginx &> /dev/null; then
    print_warning "Nginx is already installed"
else
    print_info "Installing Nginx..."
    apt-get install -y nginx
fi

print_info "Configuring firewall..."
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow OpenSSH
ufw --force enable

print_success "Nginx installed successfully"

################################################################################
# STEP 6: Install Certbot for SSL Certificates
################################################################################

print_info "\n==================================================================="
print_info "STEP 6: Installing Certbot for SSL Certificates"
print_info "==================================================================="

if command -v certbot &> /dev/null; then
    print_warning "Certbot is already installed"
else
    print_info "Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx
fi

print_success "Certbot installed successfully"

################################################################################
# STEP 7: Create Environment File
################################################################################

print_info "\n==================================================================="
print_info "STEP 7: Creating Environment Configuration"
print_info "==================================================================="

cd "$PROJECT_DIR"

# Create .env file
cat > .env << EOF
# Discord Bot Configuration
DISCORD_TOKEN=$DISCORD_TOKEN
DISCORD_CLIENT_ID=$DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET=$DISCORD_CLIENT_SECRET

# Supabase Configuration
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# API Configuration
API_PORT=$API_PORT

# Application URLs
FRONTEND_URL=https://$DOMAIN_NAME
API_URL=https://$DOMAIN_NAME/api
REDIRECT_URI=https://$DOMAIN_NAME/MyServers/index.html

# Environment
NODE_ENV=production
EOF

chmod 600 .env
print_success "Environment file created: $PROJECT_DIR/.env"

################################################################################
# STEP 8: Update Frontend Configuration
################################################################################

print_info "\n==================================================================="
print_info "STEP 8: Updating Frontend Configuration"
print_info "==================================================================="

# Update config.js with production URLs
cat > config.js << EOF
// Production configuration
window.AppConfig = {
    discord: {
        clientId: '$DISCORD_CLIENT_ID',
        redirectUri: 'https://$DOMAIN_NAME/MyServers/index.html',
        scopes: ['identify', 'guilds'],
        botPermissions: '8'
    },
    api: {
        baseUrl: 'https://$DOMAIN_NAME/api'
    },
    app: {
        environment: 'production',
        port: $WEB_PORT
    }
};

// Pre-build auth URL
window.AppConfig.discord.authUrl = \`https://discord.com/api/oauth2/authorize?client_id=\${window.AppConfig.discord.clientId}&redirect_uri=\${encodeURIComponent(window.AppConfig.discord.redirectUri)}&response_type=token&scope=\${window.AppConfig.discord.scopes.join('%20')}\`;
EOF

print_success "Frontend configuration updated"

################################################################################
# STEP 9: Install Project Dependencies
################################################################################

print_info "\n==================================================================="
print_info "STEP 9: Installing Project Dependencies"
print_info "==================================================================="

print_info "Installing root dependencies..."
npm install

print_info "Installing bot dependencies..."
cd SecurityBot
npm install
cd ..

print_info "Installing API dependencies..."
cd api
npm install
cd ..

print_success "All dependencies installed"

################################################################################
# STEP 10: Configure Nginx
################################################################################

print_info "\n==================================================================="
print_info "STEP 10: Configuring Nginx"
print_info "==================================================================="

# Create Nginx configuration
cat > /etc/nginx/sites-available/$DOMAIN_NAME << 'NGINX_EOF'
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;

    # SSL certificates (will be configured by Certbot)
    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Root directory for static files
    root PROJECT_DIR_PLACEHOLDER;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:API_PORT_PLACEHOLDER/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # Serve assets
    location /assets/ {
        alias PROJECT_DIR_PLACEHOLDER/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Serve Dashboard
    location /Dashboard/ {
        alias PROJECT_DIR_PLACEHOLDER/Dashboard/;
        try_files $uri $uri/ /Dashboard/index.html;
    }

    # Serve MyServers
    location /MyServers/ {
        alias PROJECT_DIR_PLACEHOLDER/MyServers/;
        try_files $uri $uri/ /MyServers/index.html;
    }

    # Serve SecurityLandingPage
    location /SecurityLandingPage/ {
        alias PROJECT_DIR_PLACEHOLDER/SecurityLandingPage/;
        try_files $uri $uri/ /SecurityLandingPage/index.html;
    }

    # Serve Config
    location /Config/ {
        alias PROJECT_DIR_PLACEHOLDER/Config/;
        try_files $uri $uri/ /Config/index.html;
    }

    # Serve Support
    location /Support/ {
        alias PROJECT_DIR_PLACEHOLDER/Support/;
        try_files $uri $uri/ /Support/index.html;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Logs
    access_log /var/log/nginx/DOMAIN_PLACEHOLDER-access.log;
    error_log /var/log/nginx/DOMAIN_PLACEHOLDER-error.log;
}
NGINX_EOF

# Replace placeholders
sed -i "s|DOMAIN_PLACEHOLDER|$DOMAIN_NAME|g" /etc/nginx/sites-available/$DOMAIN_NAME
sed -i "s|PROJECT_DIR_PLACEHOLDER|$PROJECT_DIR|g" /etc/nginx/sites-available/$DOMAIN_NAME
sed -i "s|API_PORT_PLACEHOLDER|$API_PORT|g" /etc/nginx/sites-available/$DOMAIN_NAME

# Enable the site
ln -sf /etc/nginx/sites-available/$DOMAIN_NAME /etc/nginx/sites-enabled/

# Remove default site if exists
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
print_info "Testing Nginx configuration..."
nginx -t

print_success "Nginx configured successfully"

################################################################################
# STEP 11: Obtain SSL Certificate
################################################################################

print_info "\n==================================================================="
print_info "STEP 11: Obtaining SSL Certificate"
print_info "==================================================================="

print_warning "Make sure your domain $DOMAIN_NAME points to this server's IP address!"
print_warning "DNS propagation may take some time. Check with: dig $DOMAIN_NAME"
echo ""
read -p "$(echo -e ${YELLOW}Press Enter when your domain is ready, or Ctrl+C to cancel...${NC})"

# Temporarily use HTTP-only config for certificate verification
cat > /etc/nginx/sites-available/$DOMAIN_NAME << 'NGINX_TEMP_EOF'
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;

    root PROJECT_DIR_PLACEHOLDER;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}
NGINX_TEMP_EOF

sed -i "s|DOMAIN_PLACEHOLDER|$DOMAIN_NAME|g" /etc/nginx/sites-available/$DOMAIN_NAME
sed -i "s|PROJECT_DIR_PLACEHOLDER|$PROJECT_DIR|g" /etc/nginx/sites-available/$DOMAIN_NAME

# Reload Nginx
systemctl reload nginx

print_info "Obtaining SSL certificate from Let's Encrypt..."
certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos --email $SSL_EMAIL --redirect

if [ $? -eq 0 ]; then
    print_success "SSL certificate obtained successfully!"

    # Now apply the full configuration with SSL
    cat > /etc/nginx/sites-available/$DOMAIN_NAME << 'NGINX_FINAL_EOF'
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;

    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    root PROJECT_DIR_PLACEHOLDER;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:API_PORT_PLACEHOLDER/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    location /assets/ {
        alias PROJECT_DIR_PLACEHOLDER/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /Dashboard/ {
        alias PROJECT_DIR_PLACEHOLDER/Dashboard/;
        try_files $uri $uri/ /Dashboard/index.html;
    }

    location /MyServers/ {
        alias PROJECT_DIR_PLACEHOLDER/MyServers/;
        try_files $uri $uri/ /MyServers/index.html;
    }

    location /SecurityLandingPage/ {
        alias PROJECT_DIR_PLACEHOLDER/SecurityLandingPage/;
        try_files $uri $uri/ /SecurityLandingPage/index.html;
    }

    location /Config/ {
        alias PROJECT_DIR_PLACEHOLDER/Config/;
        try_files $uri $uri/ /Config/index.html;
    }

    location /Support/ {
        alias PROJECT_DIR_PLACEHOLDER/Support/;
        try_files $uri $uri/ /Support/index.html;
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    access_log /var/log/nginx/DOMAIN_PLACEHOLDER-access.log;
    error_log /var/log/nginx/DOMAIN_PLACEHOLDER-error.log;
}
NGINX_FINAL_EOF

    sed -i "s|DOMAIN_PLACEHOLDER|$DOMAIN_NAME|g" /etc/nginx/sites-available/$DOMAIN_NAME
    sed -i "s|PROJECT_DIR_PLACEHOLDER|$PROJECT_DIR|g" /etc/nginx/sites-available/$DOMAIN_NAME
    sed -i "s|API_PORT_PLACEHOLDER|$API_PORT|g" /etc/nginx/sites-available/$DOMAIN_NAME

    systemctl reload nginx
    print_success "Nginx reloaded with SSL configuration"
else
    print_error "Failed to obtain SSL certificate. Please check your domain configuration."
    exit 1
fi

################################################################################
# STEP 12: Setup PM2 Ecosystem
################################################################################

print_info "\n==================================================================="
print_info "STEP 12: Setting up PM2 Process Manager"
print_info "==================================================================="

cd "$PROJECT_DIR"

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'PM2_EOF'
module.exports = {
  apps: [
    {
      name: 'discord-bot',
      cwd: './SecurityBot',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/bot-error.log',
      out_file: './logs/bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'api-server',
      cwd: './api',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
PM2_EOF

# Create logs directory
mkdir -p logs

print_success "PM2 ecosystem configuration created"

################################################################################
# STEP 13: Start Services with PM2
################################################################################

print_info "\n==================================================================="
print_info "STEP 13: Starting Services"
print_info "==================================================================="

# Stop any existing PM2 processes
pm2 delete all 2>/dev/null || true

# Start services
print_info "Starting Discord Bot and API Server..."
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup systemd -u root --hp /root

print_success "Services started successfully!"

################################################################################
# STEP 14: Setup Auto-renewal for SSL Certificate
################################################################################

print_info "\n==================================================================="
print_info "STEP 14: Setting up SSL Certificate Auto-renewal"
print_info "==================================================================="

# Test renewal
print_info "Testing certificate renewal..."
certbot renew --dry-run

if [ $? -eq 0 ]; then
    print_success "Certificate auto-renewal is configured correctly"
else
    print_warning "Certificate renewal test failed. Please check manually."
fi

################################################################################
# STEP 15: Final Configuration and Status Check
################################################################################

print_info "\n==================================================================="
print_info "STEP 15: Final Status Check"
print_info "==================================================================="

# Check Nginx status
print_info "Checking Nginx status..."
systemctl status nginx --no-pager | head -n 5

# Check PM2 status
print_info "\nChecking PM2 processes..."
pm2 status

# Display service URLs
print_info "\n==================================================================="
print_success "Setup Complete!"
print_info "==================================================================="
echo ""
echo -e "${GREEN}✓${NC} Website: https://$DOMAIN_NAME"
echo -e "${GREEN}✓${NC} Landing Page: https://$DOMAIN_NAME/SecurityLandingPage/index.html"
echo -e "${GREEN}✓${NC} Dashboard: https://$DOMAIN_NAME/Dashboard/index.html"
echo -e "${GREEN}✓${NC} My Servers: https://$DOMAIN_NAME/MyServers/index.html"
echo -e "${GREEN}✓${NC} API: https://$DOMAIN_NAME/api/health"
echo ""
print_info "==================================================================="
print_info "Useful Commands:"
print_info "==================================================================="
echo "View PM2 processes:        pm2 status"
echo "View bot logs:             pm2 logs discord-bot"
echo "View API logs:             pm2 logs api-server"
echo "Restart bot:               pm2 restart discord-bot"
echo "Restart API:               pm2 restart api-server"
echo "Restart all:               pm2 restart all"
echo "Stop all:                  pm2 stop all"
echo "View Nginx logs:           tail -f /var/log/nginx/$DOMAIN_NAME-access.log"
echo "View Nginx errors:         tail -f /var/log/nginx/$DOMAIN_NAME-error.log"
echo "Reload Nginx:              systemctl reload nginx"
echo "Renew SSL certificate:     certbot renew"
echo ""
print_info "==================================================================="
print_info "Discord Bot Configuration:"
print_info "==================================================================="
echo "Add this redirect URI to your Discord Application:"
echo "  https://$DOMAIN_NAME/MyServers/index.html"
echo ""
echo "Discord Developer Portal: https://discord.com/developers/applications"
echo ""
print_info "==================================================================="
print_warning "Important Security Notes:"
print_info "==================================================================="
echo "1. Your .env file contains sensitive information - keep it secure!"
echo "2. Never commit .env to version control"
echo "3. Regularly update your system: apt-get update && apt-get upgrade"
echo "4. Monitor your logs for any suspicious activity"
echo "5. SSL certificate will auto-renew via certbot"
echo ""
print_success "Your SecurityBot is now running in production!"
print_info "==================================================================="

# Create a quick reference file
cat > "$PROJECT_DIR/DEPLOYMENT_INFO.txt" << EOF
SecurityBot Deployment Information
===================================

Deployment Date: $(date)
Domain: $DOMAIN_NAME
Project Directory: $PROJECT_DIR

Services:
- Discord Bot: Running via PM2 (discord-bot)
- API Server: Running via PM2 (api-server) on port $API_PORT
- Web Server: Nginx with SSL

URLs:
- Website: https://$DOMAIN_NAME
- Landing Page: https://$DOMAIN_NAME/SecurityLandingPage/index.html
- Dashboard: https://$DOMAIN_NAME/Dashboard/index.html
- My Servers: https://$DOMAIN_NAME/MyServers/index.html
- API Health: https://$DOMAIN_NAME/api/health

Configuration Files:
- Environment: $PROJECT_DIR/.env
- Nginx Config: /etc/nginx/sites-available/$DOMAIN_NAME
- PM2 Config: $PROJECT_DIR/ecosystem.config.js
- SSL Certificates: /etc/letsencrypt/live/$DOMAIN_NAME/

Useful Commands:
- View processes: pm2 status
- View bot logs: pm2 logs discord-bot
- View API logs: pm2 logs api-server
- Restart services: pm2 restart all
- View Nginx logs: tail -f /var/log/nginx/$DOMAIN_NAME-access.log
- Reload Nginx: systemctl reload nginx

Discord Configuration:
- Update redirect URI in Discord Developer Portal to:
  https://$DOMAIN_NAME/MyServers/index.html

Maintenance:
- SSL certificates auto-renew via certbot
- PM2 processes auto-restart on failure
- PM2 starts on system boot
- Update system regularly: apt-get update && apt-get upgrade

Support:
- Check logs if services aren't working
- Ensure DNS is properly configured
- Verify firewall allows ports 80 and 443
EOF

print_success "Deployment info saved to: $PROJECT_DIR/DEPLOYMENT_INFO.txt"

exit 0

