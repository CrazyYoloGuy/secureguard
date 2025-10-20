#!/usr/bin/env node

// Debug script to test whitelist functionality
require('dotenv').config();
const database = require('./SecurityBot/services/database');

async function debugWhitelist() {
    console.log('🔍 Debug Whitelist Functionality');
    console.log('================================\n');
    
    // Get server ID from command line or use a default
    const serverId = process.argv[2] || 'YOUR_SERVER_ID_HERE';
    
    if (serverId === 'YOUR_SERVER_ID_HERE') {
        console.log('❌ Please provide a server ID as an argument:');
        console.log('   node debug-whitelist.js YOUR_SERVER_ID');
        process.exit(1);
    }
    
    try {
        console.log(`📊 Loading settings for server: ${serverId}`);
        
        // Test database connection
        const connected = await database.testConnection();
        console.log(`🔗 Database connected: ${connected}`);
        
        if (!connected) {
            console.log('❌ Database connection failed. Check your .env file.');
            process.exit(1);
        }
        
        // Get server settings
        const settings = await database.getServerSettings(serverId);
        console.log('\n📋 Server Settings:');
        console.log(JSON.stringify(settings, null, 2));
        
        // Focus on link protection
        const linkProtection = settings.link_protection;
        console.log('\n🔗 Link Protection Settings:');
        console.log(JSON.stringify(linkProtection, null, 2));
        
        if (linkProtection && linkProtection.enabled) {
            console.log('\n✅ Link Protection is ENABLED');
            
            const config = linkProtection.config;
            if (config.whitelist_users && config.whitelist_users.length > 0) {
                console.log('\n👥 Whitelisted Users:');
                config.whitelist_users.forEach((userId, index) => {
                    console.log(`   ${index + 1}. "${userId}" (type: ${typeof userId})`);
                });
            } else {
                console.log('\n📝 No users in whitelist');
            }
            
            if (config.whitelist_domains && config.whitelist_domains.length > 0) {
                console.log('\n🌐 Whitelisted Domains:');
                config.whitelist_domains.forEach((domain, index) => {
                    console.log(`   ${index + 1}. ${domain}`);
                });
            } else {
                console.log('\n📝 No domains in whitelist');
            }
            
        } else {
            console.log('\n❌ Link Protection is DISABLED');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
    
    console.log('\n🎯 To test:');
    console.log('1. Make sure Link Protection is enabled in the dashboard');
    console.log('2. Add a user ID to the whitelist');
    console.log('3. Send a link in Discord from that user');
    console.log('4. Check the bot logs for detailed output');
}

debugWhitelist();
