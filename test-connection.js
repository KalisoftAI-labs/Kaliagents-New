import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';

console.log('🔍 Testing WhatsApp Connection...\n');

async function testConnection() {
    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        console.log('✅ Auth files loaded');
        console.log(`📱 Using Baileys version: ${version.join('.')}\n`);
        
        const sock = makeWASocket({
            auth: state,
            version,
            printQRInTerminal: false,
            browser: ['Connection Test', 'Safari', '15.0.0'],
            syncFullHistory: false,
            markOnlineOnConnect: false,
            connectTimeoutMs: 30000,
            logger: {
                level: 'silent',
                trace: () => {},
                debug: () => {},
                info: () => {},
                warn: () => {},
                error: () => {},
                fatal: () => {},
                child: () => ({ level: 'silent', trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({}) })
            }
        });
        
        let connected = false;
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('❌ No saved session found. Please run: node whatsapp-qr.js');
                process.exit(1);
            }
            
            if (connection === 'connecting') {
                console.log('⏳ Connecting...');
            }
            
            if (connection === 'open') {
                connected = true;
                console.log('\n✅ CONNECTION SUCCESSFUL!');
                console.log('📱 Your WhatsApp session is working perfectly.\n');
                console.log('You can now use:');
                console.log('  • node bulkMessage.js - Send bulk messages');
                console.log('  • node index.js - Start the bot\n');
                
                // Keep connection open for 5 seconds to test stability
                console.log('⏳ Testing connection stability for 5 seconds...\n');
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                if (connected) {
                    console.log('✅ Connection remained stable!\n');
                }
                
                sock.ws.close();
                process.exit(0);
            }
            
            if (connection === 'close') {
                connected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.data?.reason;
                
                console.log('\n❌ CONNECTION FAILED');
                if (reason) console.log(`Reason: ${reason}`);
                if (statusCode) console.log(`Status: ${statusCode}`);
                
                console.log('\n💡 Try running: node whatsapp-qr.js --clear\n');
                process.exit(1);
            }
        });
        
        sock.ev.on('creds.update', saveCreds);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.log('\n💡 Try running: node whatsapp-qr.js --clear\n');
        process.exit(1);
    }
}

testConnection();
