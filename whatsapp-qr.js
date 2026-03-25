import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';

// Custom logger to prevent 'logger.child is not a function' error
const customLogger = {
    level: 'silent',
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
    child: () => customLogger
};

let retryCount = 0;
const MAX_RETRIES = 3;
let isExiting = false;

// Function to delete auth folder
function clearAuthFolder() {
    const authPath = './auth_info_baileys';
    if (fs.existsSync(authPath)) {
        console.log('🧹 Clearing old session data...');
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log('✅ Session data cleared\n');
    }
}

async function connectToWhatsApp() {
    console.clear();
    console.log('🚀 Initializing WhatsApp QR Code Scanner...\n');
    console.log('Please wait while we connect to WhatsApp...\n');

    try {
        // Fetch latest Baileys version for better compatibility
        const { version } = await fetchLatestBaileysVersion();
        
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: customLogger,
            version,
            browser: ['Kali Agents Bot', 'Safari', '15.0.0'],
            syncFullHistory: false,
            markOnlineOnConnect: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: false,
            getMessage: async () => undefined
        });

        sock.ev.on('connection.update', async (update) => {
            const { qr, connection, lastDisconnect } = update;

            if (qr) {
                console.log('📱 QR Code received!\n');
                retryCount = 0; // Reset retry count when QR is received
                showQrCode(qr);
            }

            if (connection === 'open') {
                console.clear();
                console.log('\n✅ Successfully connected to WhatsApp!');
                console.log('📱 Connection established successfully!');
                console.log('\nYou can now:');
                console.log('  1. Close this window');
                console.log('  2. Start the main bot with: node index.js');
                console.log('  3. Or use bulk messaging: node bulkMessage.js\n');
                retryCount = 0;
                
                // Exit cleanly after 2 seconds to free up the session
                console.log('⏳ Closing in 2 seconds...\n');
                setTimeout(async () => {
                    isExiting = true;
                    console.log('👋 Session saved. Closing connection...\n');
                    
                    // Remove event listeners to prevent reconnect
                    sock.ev.removeAllListeners('connection.update');
                    
                    // Close socket gracefully
                    try {
                        sock.ws.close();
                    } catch (e) {
                        // Ignore close errors
                    }
                    
                    // Force exit after a moment
                    setTimeout(() => {
                        process.exit(0);
                    }, 500);
                }, 2000);
            }

            if (connection === 'close') {
                // Don't process close events if we're exiting intentionally
                if (isExiting) {
                    return;
                }
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.data?.reason;
                
                console.log('\n⚠️  Connection closed');
                if (reason) {
                    console.log(`Reason: ${reason}`);
                }

                // Handle different disconnect reasons
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('\n❌ You have been logged out. Clearing session...');
                    clearAuthFolder();
                    console.log('Please restart the scanner to generate a new QR code.\n');
                    process.exit(1);
                } else if (statusCode === 405 || reason === '405') {
                    console.log('\n⚠️  Error 405: Connection rejected by WhatsApp');
                    
                    if (retryCount < MAX_RETRIES) {
                        retryCount++;
                        console.log(`\n🔄 Clearing session and retrying... (Attempt ${retryCount}/${MAX_RETRIES})`);
                        clearAuthFolder();
                        const delay = retryCount * 3000; // Exponential backoff
                        console.log(`Waiting ${delay/1000} seconds before retry...\n`);
                        setTimeout(connectToWhatsApp, delay);
                    } else {
                        console.log('\n❌ Maximum retry attempts reached.');
                        console.log('\n💡 Troubleshooting steps:');
                        console.log('  1. Wait 5-10 minutes before trying again');
                        console.log('  2. Make sure you\'re not running multiple instances');
                        console.log('  3. Check if WhatsApp is working on your phone');
                        console.log('  4. Try updating the package: npm install @whiskeysockets/baileys@latest\n');
                        process.exit(1);
                    }
                } else if (statusCode === DisconnectReason.connectionClosed || 
                           statusCode === DisconnectReason.connectionLost ||
                           statusCode === DisconnectReason.connectionReplaced) {
                    console.log('\n🔄 Reconnecting...');
                    setTimeout(connectToWhatsApp, 2000);
                } else {
                    console.log('\n🔄 Unexpected disconnect. Retrying...');
                    setTimeout(connectToWhatsApp, 3000);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`\n🔄 Retrying... (Attempt ${retryCount}/${MAX_RETRIES})`);
            setTimeout(connectToWhatsApp, 5000);
        } else {
            console.log('\n❌ Failed to connect after multiple attempts.');
            console.log('Please check your internet connection and try again later.\n');
            process.exit(1);
        }
    }
}

function showQrCode(qr) {
    console.clear();
    console.log('\n' + '='.repeat(60));
    console.log('🔍 SCAN WHATSAPP QR CODE');
    console.log('='.repeat(60));
    console.log('📱 INSTRUCTIONS:');
    console.log('1. Open WhatsApp on your phone');
    console.log('2. Tap Menu (⋮) > Linked Devices > Link a Device');
    console.log('3. Scan the QR code below:');
    console.log('='.repeat(60) + '\n');
    
    qrcode.generate(qr, { small: false });
    
    console.log('\n' + '='.repeat(60));
    console.log('💡 TIP: Keep this window open while scanning');
    console.log('      The connection will be established automatically');
    console.log('='.repeat(60) + '\n');
}

// Start message
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║     WhatsApp QR Code Scanner - Kali Agents Bot       ║');
console.log('╚══════════════════════════════════════════════════════╝\n');
console.log('⏳ Initializing connection...\n');

// Check if we should clear the session
const args = process.argv.slice(2);
if (args.includes('--clear') || args.includes('-c')) {
    console.log('🧹 Clearing previous session as requested...\n');
    clearAuthFolder();
}

// Start the connection
connectToWhatsApp().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    console.log('\n💡 Try running with: node whatsapp-qr.js --clear\n');
    process.exit(1);
});