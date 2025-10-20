#!/bin/bash

################################################################################
# SecurityBot Management Script
# Quick commands for managing your SecurityBot deployment
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

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

show_menu() {
    clear
    print_header "SecurityBot Management Menu"
    echo ""
    echo "1)  View Status"
    echo "2)  View Bot Logs"
    echo "3)  View API Logs"
    echo "4)  View All Logs"
    echo "5)  Restart Bot"
    echo "6)  Restart API"
    echo "7)  Restart All Services"
    echo "8)  Stop All Services"
    echo "9)  Start All Services"
    echo "10) View Nginx Logs"
    echo "11) Reload Nginx"
    echo "12) Check SSL Certificate"
    echo "13) Renew SSL Certificate"
    echo "14) Update Application"
    echo "15) View System Resources"
    echo "16) Backup Configuration"
    echo "17) View Deployment Info"
    echo "0)  Exit"
    echo ""
    read -p "$(echo -e ${YELLOW}Enter your choice: ${NC})" choice
}

view_status() {
    print_header "Service Status"
    echo ""
    print_info "PM2 Processes:"
    pm2 status
    echo ""
    print_info "Nginx Status:"
    systemctl status nginx --no-pager | head -n 10
    echo ""
    read -p "Press Enter to continue..."
}

view_bot_logs() {
    print_header "Discord Bot Logs"
    echo ""
    print_info "Showing last 50 lines (Ctrl+C to exit live view)"
    echo ""
    pm2 logs discord-bot --lines 50
}

view_api_logs() {
    print_header "API Server Logs"
    echo ""
    print_info "Showing last 50 lines (Ctrl+C to exit live view)"
    echo ""
    pm2 logs api-server --lines 50
}

view_all_logs() {
    print_header "All Application Logs"
    echo ""
    print_info "Showing last 50 lines (Ctrl+C to exit live view)"
    echo ""
    pm2 logs --lines 50
}

restart_bot() {
    print_header "Restarting Discord Bot"
    echo ""
    pm2 restart discord-bot
    if [ $? -eq 0 ]; then
        print_success "Bot restarted successfully"
    else
        print_error "Failed to restart bot"
    fi
    echo ""
    read -p "Press Enter to continue..."
}

restart_api() {
    print_header "Restarting API Server"
    echo ""
    pm2 restart api-server
    if [ $? -eq 0 ]; then
        print_success "API restarted successfully"
    else
        print_error "Failed to restart API"
    fi
    echo ""
    read -p "Press Enter to continue..."
}

restart_all() {
    print_header "Restarting All Services"
    echo ""
    pm2 restart all
    if [ $? -eq 0 ]; then
        print_success "All services restarted successfully"
    else
        print_error "Failed to restart services"
    fi
    echo ""
    read -p "Press Enter to continue..."
}

stop_all() {
    print_header "Stopping All Services"
    echo ""
    read -p "$(echo -e ${YELLOW}Are you sure? [y/N]: ${NC})" confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        pm2 stop all
        if [ $? -eq 0 ]; then
            print_success "All services stopped"
        else
            print_error "Failed to stop services"
        fi
    else
        print_info "Cancelled"
    fi
    echo ""
    read -p "Press Enter to continue..."
}

start_all() {
    print_header "Starting All Services"
    echo ""
    pm2 start all
    if [ $? -eq 0 ]; then
        print_success "All services started successfully"
    else
        print_error "Failed to start services"
    fi
    echo ""
    read -p "Press Enter to continue..."
}

view_nginx_logs() {
    print_header "Nginx Logs"
    echo ""
    echo "1) Access Logs"
    echo "2) Error Logs"
    echo ""
    read -p "$(echo -e ${YELLOW}Choose log type: ${NC})" log_choice
    
    if [ "$log_choice" = "1" ]; then
        print_info "Showing access logs (Ctrl+C to exit)"
        echo ""
        tail -f /var/log/nginx/*-access.log
    elif [ "$log_choice" = "2" ]; then
        print_info "Showing error logs (Ctrl+C to exit)"
        echo ""
        tail -f /var/log/nginx/*-error.log
    fi
}

reload_nginx() {
    print_header "Reloading Nginx"
    echo ""
    print_info "Testing configuration..."
    nginx -t
    if [ $? -eq 0 ]; then
        print_success "Configuration is valid"
        systemctl reload nginx
        if [ $? -eq 0 ]; then
            print_success "Nginx reloaded successfully"
        else
            print_error "Failed to reload Nginx"
        fi
    else
        print_error "Nginx configuration has errors"
    fi
    echo ""
    read -p "Press Enter to continue..."
}

check_ssl() {
    print_header "SSL Certificate Status"
    echo ""
    certbot certificates
    echo ""
    read -p "Press Enter to continue..."
}

renew_ssl() {
    print_header "Renewing SSL Certificate"
    echo ""
    print_info "Testing renewal process..."
    certbot renew --dry-run
    if [ $? -eq 0 ]; then
        print_success "Dry run successful"
        echo ""
        read -p "$(echo -e ${YELLOW}Proceed with actual renewal? [y/N]: ${NC})" confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            certbot renew
            if [ $? -eq 0 ]; then
                print_success "Certificate renewed successfully"
                systemctl reload nginx
            else
                print_error "Failed to renew certificate"
            fi
        fi
    else
        print_error "Dry run failed"
    fi
    echo ""
    read -p "Press Enter to continue..."
}

update_app() {
    print_header "Updating Application"
    echo ""
    print_info "Current directory: $(pwd)"
    echo ""
    
    if [ -d ".git" ]; then
        print_info "Git repository detected"
        read -p "$(echo -e ${YELLOW}Pull latest changes? [y/N]: ${NC})" confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            git pull
            if [ $? -eq 0 ]; then
                print_success "Code updated successfully"
                
                print_info "Installing dependencies..."
                npm install
                cd SecurityBot && npm install && cd ..
                cd api && npm install && cd ..
                
                print_info "Restarting services..."
                pm2 restart all
                
                print_success "Application updated and restarted"
            else
                print_error "Failed to pull changes"
            fi
        fi
    else
        print_error "Not a git repository"
        print_info "Please update files manually and restart services"
    fi
    echo ""
    read -p "Press Enter to continue..."
}

view_resources() {
    print_header "System Resources"
    echo ""
    print_info "CPU and Memory Usage:"
    pm2 monit &
    PM2_PID=$!
    sleep 5
    kill $PM2_PID 2>/dev/null
    echo ""
    print_info "Disk Usage:"
    df -h | grep -E '^/dev/'
    echo ""
    print_info "Memory Usage:"
    free -h
    echo ""
    read -p "Press Enter to continue..."
}

backup_config() {
    print_header "Backup Configuration"
    echo ""
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    print_info "Creating backup in $BACKUP_DIR..."
    
    # Backup .env
    if [ -f ".env" ]; then
        cp .env "$BACKUP_DIR/.env"
        print_success "Backed up .env"
    fi
    
    # Backup config.js
    if [ -f "config.js" ]; then
        cp config.js "$BACKUP_DIR/config.js"
        print_success "Backed up config.js"
    fi
    
    # Backup ecosystem.config.js
    if [ -f "ecosystem.config.js" ]; then
        cp ecosystem.config.js "$BACKUP_DIR/ecosystem.config.js"
        print_success "Backed up ecosystem.config.js"
    fi
    
    # Backup Nginx config
    if [ -f "/etc/nginx/sites-available/"* ]; then
        cp /etc/nginx/sites-available/* "$BACKUP_DIR/" 2>/dev/null
        print_success "Backed up Nginx configuration"
    fi
    
    print_success "Backup completed: $BACKUP_DIR"
    echo ""
    read -p "Press Enter to continue..."
}

view_deployment_info() {
    print_header "Deployment Information"
    echo ""
    if [ -f "DEPLOYMENT_INFO.txt" ]; then
        cat DEPLOYMENT_INFO.txt
    else
        print_error "DEPLOYMENT_INFO.txt not found"
    fi
    echo ""
    read -p "Press Enter to continue..."
}

# Main loop
while true; do
    show_menu
    case $choice in
        1) view_status ;;
        2) view_bot_logs ;;
        3) view_api_logs ;;
        4) view_all_logs ;;
        5) restart_bot ;;
        6) restart_api ;;
        7) restart_all ;;
        8) stop_all ;;
        9) start_all ;;
        10) view_nginx_logs ;;
        11) reload_nginx ;;
        12) check_ssl ;;
        13) renew_ssl ;;
        14) update_app ;;
        15) view_resources ;;
        16) backup_config ;;
        17) view_deployment_info ;;
        0) 
            print_info "Goodbye!"
            exit 0
            ;;
        *)
            print_error "Invalid option"
            sleep 2
            ;;
    esac
done

