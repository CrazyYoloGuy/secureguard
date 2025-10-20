#!/bin/bash

################################################################################
# Pre-Flight Check Script
# Run this before deploying to verify everything is ready
################################################################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

ERRORS=0
WARNINGS=0

print_header "SecurityBot Pre-Flight Check"
echo ""

################################################################################
# Check 1: Project Files
################################################################################

print_info "Checking project files..."
echo ""

if [ -f "SecurityBot/index.js" ]; then
    print_success "Bot main file found"
else
    print_error "Bot main file (SecurityBot/index.js) not found"
    ((ERRORS++))
fi

if [ -f "api/server.js" ]; then
    print_success "API server file found"
else
    print_error "API server file (api/server.js) not found"
    ((ERRORS++))
fi

if [ -f "config.js" ]; then
    print_success "Frontend config found"
else
    print_error "Frontend config (config.js) not found"
    ((ERRORS++))
fi

if [ -f "SecurityBot/package.json" ]; then
    print_success "Bot package.json found"
else
    print_error "Bot package.json not found"
    ((ERRORS++))
fi

if [ -f "api/package.json" ]; then
    print_success "API package.json found"
else
    print_error "API package.json not found"
    ((ERRORS++))
fi

echo ""

################################################################################
# Check 2: Required Directories
################################################################################

print_info "Checking required directories..."
echo ""

REQUIRED_DIRS=("SecurityBot" "api" "Dashboard" "MyServers" "SecurityLandingPage" "assets")

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        print_success "Directory '$dir' exists"
    else
        print_error "Directory '$dir' not found"
        ((ERRORS++))
    fi
done

echo ""

################################################################################
# Check 3: Credentials Checklist
################################################################################

print_info "Credentials Checklist (you'll need these during setup):"
echo ""

read -p "Do you have your Discord Bot Token? [y/n]: " has_token
if [[ $has_token =~ ^[Yy]$ ]]; then
    print_success "Discord Bot Token ready"
else
    print_error "You need a Discord Bot Token"
    ((ERRORS++))
fi

read -p "Do you have your Discord Client ID? [y/n]: " has_client_id
if [[ $has_client_id =~ ^[Yy]$ ]]; then
    print_success "Discord Client ID ready"
else
    print_error "You need a Discord Client ID"
    ((ERRORS++))
fi

read -p "Do you have your Discord Client Secret? [y/n]: " has_client_secret
if [[ $has_client_secret =~ ^[Yy]$ ]]; then
    print_success "Discord Client Secret ready"
else
    print_error "You need a Discord Client Secret"
    ((ERRORS++))
fi

read -p "Do you have your Supabase URL? [y/n]: " has_supabase_url
if [[ $has_supabase_url =~ ^[Yy]$ ]]; then
    print_success "Supabase URL ready"
else
    print_error "You need a Supabase URL"
    ((ERRORS++))
fi

read -p "Do you have your Supabase Anon Key? [y/n]: " has_supabase_key
if [[ $has_supabase_key =~ ^[Yy]$ ]]; then
    print_success "Supabase Anon Key ready"
else
    print_error "You need a Supabase Anon Key"
    ((ERRORS++))
fi

echo ""

################################################################################
# Check 4: Domain Configuration
################################################################################

print_info "Domain Configuration Check:"
echo ""

read -p "Do you have a domain name ready? [y/n]: " has_domain
if [[ $has_domain =~ ^[Yy]$ ]]; then
    print_success "Domain name ready"
    
    read -p "Enter your domain name to check DNS: " domain_name
    if [ -n "$domain_name" ]; then
        print_info "Checking DNS for $domain_name..."
        
        if command -v dig &> /dev/null; then
            DNS_RESULT=$(dig +short $domain_name A)
            if [ -n "$DNS_RESULT" ]; then
                print_success "DNS resolves to: $DNS_RESULT"
                print_warning "Make sure this IP matches your VPS IP!"
            else
                print_warning "DNS not configured or not propagated yet"
                print_info "Configure your domain's A record to point to your VPS IP"
                ((WARNINGS++))
            fi
        else
            print_warning "dig command not available, skipping DNS check"
            ((WARNINGS++))
        fi
    fi
else
    print_error "You need a domain name for SSL certificates"
    ((ERRORS++))
fi

echo ""

################################################################################
# Check 5: VPS Requirements
################################################################################

print_info "VPS Requirements Check:"
echo ""

read -p "Is your VPS running Ubuntu 20.04 or newer? [y/n]: " has_ubuntu
if [[ $has_ubuntu =~ ^[Yy]$ ]]; then
    print_success "Ubuntu version compatible"
else
    print_warning "Script is designed for Ubuntu 20.04+. May work on other versions."
    ((WARNINGS++))
fi

read -p "Do you have root or sudo access? [y/n]: " has_root
if [[ $has_root =~ ^[Yy]$ ]]; then
    print_success "Root/sudo access available"
else
    print_error "You need root or sudo access to run the setup script"
    ((ERRORS++))
fi

read -p "Does your VPS have at least 1GB RAM? [y/n]: " has_ram
if [[ $has_ram =~ ^[Yy]$ ]]; then
    print_success "RAM requirement met"
else
    print_warning "1GB RAM recommended. Bot may run slowly with less."
    ((WARNINGS++))
fi

echo ""

################################################################################
# Check 6: Setup Script
################################################################################

print_info "Checking setup script..."
echo ""

if [ -f "vps-setup.sh" ]; then
    print_success "Setup script found"
    
    if [ -x "vps-setup.sh" ]; then
        print_success "Setup script is executable"
    else
        print_warning "Setup script is not executable"
        print_info "Run: chmod +x vps-setup.sh"
        ((WARNINGS++))
    fi
else
    print_error "Setup script (vps-setup.sh) not found"
    ((ERRORS++))
fi

if [ -f "manage.sh" ]; then
    print_success "Management script found"
    
    if [ -x "manage.sh" ]; then
        print_success "Management script is executable"
    else
        print_warning "Management script is not executable"
        print_info "Run: chmod +x manage.sh"
        ((WARNINGS++))
    fi
else
    print_warning "Management script (manage.sh) not found"
    ((WARNINGS++))
fi

echo ""

################################################################################
# Check 7: Documentation
################################################################################

print_info "Checking documentation..."
echo ""

if [ -f "VPS_SETUP_GUIDE.md" ]; then
    print_success "Setup guide found"
else
    print_warning "Setup guide not found"
    ((WARNINGS++))
fi

if [ -f "QUICK_DEPLOY.md" ]; then
    print_success "Quick deploy guide found"
else
    print_warning "Quick deploy guide not found"
    ((WARNINGS++))
fi

echo ""

################################################################################
# Summary
################################################################################

print_header "Pre-Flight Check Summary"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    print_success "All checks passed! You're ready to deploy! 🚀"
    echo ""
    print_info "Next steps:"
    echo "  1. Upload this project to your VPS"
    echo "  2. SSH into your VPS"
    echo "  3. Navigate to the project directory"
    echo "  4. Run: sudo ./vps-setup.sh"
    echo ""
elif [ $ERRORS -eq 0 ]; then
    print_warning "Checks passed with $WARNINGS warning(s)"
    echo ""
    print_info "You can proceed with deployment, but review the warnings above."
    echo ""
    print_info "Next steps:"
    echo "  1. Address any warnings (optional)"
    echo "  2. Upload this project to your VPS"
    echo "  3. SSH into your VPS"
    echo "  4. Navigate to the project directory"
    echo "  5. Run: sudo ./vps-setup.sh"
    echo ""
else
    print_error "Found $ERRORS error(s) and $WARNINGS warning(s)"
    echo ""
    print_info "Please fix the errors above before deploying."
    echo ""
    exit 1
fi

################################################################################
# Quick Reference
################################################################################

print_header "Quick Reference"
echo ""
echo "Upload to VPS:"
echo "  scp -r /path/to/project root@your-vps-ip:/var/www/securitybot"
echo ""
echo "Or use Git:"
echo "  ssh root@your-vps-ip"
echo "  cd /var/www"
echo "  git clone https://github.com/yourusername/repo.git securitybot"
echo ""
echo "Then run setup:"
echo "  cd /var/www/securitybot"
echo "  chmod +x vps-setup.sh"
echo "  sudo ./vps-setup.sh"
echo ""
print_info "For detailed instructions, see VPS_SETUP_GUIDE.md or QUICK_DEPLOY.md"
echo ""

exit 0

