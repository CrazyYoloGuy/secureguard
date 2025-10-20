#!/bin/bash

# Make all deployment scripts executable
chmod +x vps-setup.sh
chmod +x manage.sh
chmod +x pre-flight-check.sh

echo "✓ All scripts are now executable!"
echo ""
echo "Available scripts:"
echo "  ./pre-flight-check.sh  - Check if you're ready to deploy"
echo "  ./vps-setup.sh         - Run on VPS to deploy everything"
echo "  ./manage.sh            - Manage your deployed bot"

