import { 
    makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import readline from 'readline';
import path from 'path';

// Helper function to read contacts from a file
function readContactsFromFile(filename) {
    try {
        const filePath = path.resolve(process.cwd(), filename);
        console.log(`Reading contacts from: ${filePath}`);
        const data = fs.readFileSync(filePath, 'utf-8');
        // Split by newline, trim, remove leading +, and filter out empty lines
        const contacts = data.split('\n')
            .map(line => line.trim().replace(/^\+/, ''))
            .filter(line => line.length > 0);
        console.log(`Found ${contacts.length} contacts:`, contacts);
        return contacts;
    } catch (error) {
        console.error('Error reading contacts file:', error.message);
        process.exit(1);
    }
}


// Main function
async function sendBulkMessages() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        console.log('\n╔══════════════════════════════════════════════════════╗');
        console.log('║         WhatsApp Bulk Messaging - Kali Agents       ║');
        console.log('╚══════════════════════════════════════════════════════╝\n');
        console.log('⚠️  IMPORTANT: Make sure WhatsApp QR scanner is NOT running!');
        console.log('   (Close any "node whatsapp-qr.js" windows first)\n');

        // Multi-line message input with clear instructions and reminder
        console.log('──────────────────────────────────────────────────────────────');
        console.log('Paste or type your WhatsApp message below.');
        console.log('When you are done, type a single dot (.) on a new line and press Enter.');
        console.log('──────────────────────────────────────────────────────────────');
        let lines = [];
        let waiting = true;
        const showReminder = () => {
            if (waiting) {
                process.stdout.write('\x1b[33m[Waiting for message end: type . on a new line]\x1b[0m\n');
                setTimeout(showReminder, 10000);
            }
        };
        showReminder();
        await new Promise(resolve => {
            rl.on('line', (input) => {
                if (input.trim() === '.') {
                    waiting = false;
                    resolve();
                } else {
                    lines.push(input);
                }
            });
        });
        const message = lines.join('\n');

        // Ask for optional image attachment
        const image = await new Promise(resolve => {
            rl.question('\n📷 Image path or URL (or press Enter to skip): ', resolve);
        });
        const attachedImage = image.trim() || null;

        // Use default contacts file
        const contactsFile = 'data/contact_lists/my_contacts.txt';
        console.log(`\nUsing default contacts file: ${contactsFile}`);
        
        // Check if file exists
        if (!fs.existsSync(contactsFile)) {
            console.error(`\n❌ Contact file not found: ${contactsFile}`);
            console.log('Please create this file with one phone number per line (with country code, without +)');
            rl.close();
            process.exit(1);
        }

        // Read contacts
        const contacts = readContactsFromFile(contactsFile);
        console.log(`Found ${contacts.length} contacts to message.`);

        // Initialize WhatsApp connection with better config
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        let isConnected = false;
        let isSending = false;
        
        const sock = makeWASocket({
            auth: state,
            version,
            browser: ['Kali Bulk Sender', 'Safari', '15.0.0'],
            syncFullHistory: false,
            printQRInTerminal: false,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            linkPreviewImageThumbnailWidth: 192,
            transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
            generateHighQualityLinkPreview: true,
            emitOwnEvents: false,
            getMessage: async () => undefined,
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

        // Handle QR code generation
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('\n📱 Scan the QR code below to log in:');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'connecting') {
                if (!isSending) {
                    console.log('⏳ Connecting to WhatsApp...');
                }
                isConnected = false;
            }

            if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.data?.reason;
                
                // Only show connection closed if we're not in the middle of sending
                if (!isSending) {
                    console.log('\n⚠️  Connection closed');
                    if (reason) console.log(`Reason: ${reason}`);
                }
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('\n❌ Logged out! Please scan QR code again with: node whatsapp-qr.js');
                    rl.close();
                    process.exit(1);
                } else if (statusCode === 405 || reason === '405') {
                    console.log('\n❌ Connection rejected (405). This usually means:');
                    console.log('  • WhatsApp QR scanner is still running (close it first)');
                    console.log('  • Another instance is using this session');
                    console.log('  • Session might be corrupted - try: node whatsapp-qr.js --clear\n');
                    rl.close();
                    process.exit(1);
                } else if (!isSending) {
                    // Only auto-restart if we haven't started sending yet
                    console.log('\n❌ Connection failed. Please run the script again.');
                    rl.close();
                    process.exit(1);
                }
            } else if (connection === 'open') {
                isConnected = true;
                if (!isSending) {
                    console.log('\n✅ Connected to WhatsApp!');
                    console.log('⏳ Waiting 3 seconds to stabilize...\n');
                    // Shorter wait - 3 seconds is enough
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    // Double-check connection is still open
                    if (isConnected) {
                        startSending(sock, contacts, message, rl, () => isConnected, () => { isSending = true; }, attachedImage);
                    } else {
                        console.log('\n❌ Connection lost before sending. Please try again.');
                        rl.close();
                        process.exit(1);
                    }
                }
            }
        });

        // Save credentials when updated
        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error('Error:', error);
        rl.close();
        process.exit(1);
    }
}

// Function to send messages with delay
async function startSending(sock, contacts, message, rl, isConnectedFn, markAsSending, image = null) {
    // Final connection check before proceeding
    if (!isConnectedFn()) {
        console.log('\n❌ Connection lost before sending could start.');
        console.log('Please run the script again.\n');
        rl.close();
        process.exit(1);
    }

    console.log(`✅ Ready to send to ${contacts.length} contacts.`);
    if (image) {
        console.log(`📷 Image: ${image}`);
    }
    console.log(`📝 Preview: ${message.substring(0, 100)}...\n`);

    const confirm = await new Promise(resolve => {
        rl.question('Type "SEND" to start sending (or anything else to cancel): ', resolve);
    });

    if (confirm.trim().toUpperCase() !== 'SEND') {
        console.log('❌ Sending cancelled.');
        rl.close();
        process.exit(0);
    }

    // Mark that we've started sending
    markAsSending();
    
    // One more connection check after user confirmed
    if (!isConnectedFn()) {
        console.log('\n❌ Connection lost while waiting for confirmation.');
        console.log('Please run the script again.\n');
        rl.close();
        process.exit(1);
    }
    
    console.log('\n🚀 Starting bulk send...\n');
    
    // Prepare image data once (if any)
    let bulkImageData = null;
    if (image) {
        if (image.startsWith('http://') || image.startsWith('https://')) {
            bulkImageData = { url: image };
        } else {
            bulkImageData = fs.readFileSync(image);
        }
    }
    
    let successCount = 0;
    let failCount = 0;
    const failedContacts = [];

    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i].trim();
        if (!contact) continue;

        const phoneNumber = contact.endsWith('@s.whatsapp.net') ? contact : `${contact}@s.whatsapp.net`;
        
        try {
            // Check connection status before sending
            if (!isConnectedFn()) {
                throw new Error('Connection lost - please restart the script');
            }

            console.log(`\n[${i + 1}/${contacts.length}] 📤 Sending to ${contact}...`);
            
            // Validate phone number format
            const cleanNumber = contact.replace('@s.whatsapp.net', '');
            if (cleanNumber.length < 10 || cleanNumber.length > 15) {
                throw new Error(`Invalid number format`);
            }
            
            // Check if registered on WhatsApp with retry
            let result;
            try {
                [result] = await sock.onWhatsApp(phoneNumber);
            } catch (checkError) {
                console.log(`   ⚠️  Could not verify number, attempting to send anyway...`);
                result = { exists: true }; // Assume it exists
            }
            
            if (!result || !result.exists) {
                throw new Error('Number not on WhatsApp');
            }
            
            console.log(`   ✓ Number verified`);
            
            let messageContent;
            if (bulkImageData) {
                messageContent = { image: bulkImageData, caption: message || '' };
            } else {
                messageContent = { text: message };
            }
            
            // Send the message with retry logic
            let sent = false;
            let retries = 0;
            const maxRetries = 2;
            
            while (!sent && retries <= maxRetries) {
                try {
                    await sock.sendMessage(phoneNumber, messageContent);
                    sent = true;
                } catch (sendError) {
                    retries++;
                    if (retries <= maxRetries) {
                        console.log(`   ⚠️  Retry ${retries}/${maxRetries}...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } else {
                        throw sendError;
                    }
                }
            }
            
            console.log(`✅ Sent successfully to ${contact}`);
            successCount++;
            
            // Delay between messages (3 seconds)
            if (i < contacts.length - 1) {
                const delayTime = 3;
                process.stdout.write(`⏳ Waiting ${delayTime}s before next message...`);
                await new Promise(resolve => {
                    const spinner = ['|', '/', '-', '\\'];
                    let x = 0;
                    const interval = setInterval(() => {
                        const remaining = Math.max(0, delayTime - Math.floor(x * 250 / 1000));
                        process.stdout.write(`\r${spinner[x++ % 4]} Waiting ${remaining}s...`);
                    }, 250);
                    
                    setTimeout(() => {
                        clearInterval(interval);
                        process.stdout.clearLine();
                        process.stdout.cursorTo(0);
                        resolve();
                    }, delayTime * 1000);
                });
            }
        } catch (error) {
            console.error(`\n❌ Failed to send to ${contact}:`, error.message);
            failCount++;
            failedContacts.push(contact);
            
            // If rate limited, wait longer
            if (error.message.includes('429') || error.message.includes('too many')) {
                console.log('Rate limited, waiting 30 seconds before continuing...');
                await new Promise(resolve => setTimeout(resolve, 30000));
            } else {
                // Shorter delay for other errors
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 BULK SEND COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Successfully sent: ${successCount}/${contacts.length}`);
    console.log(`❌ Failed: ${failCount}/${contacts.length}`);
    
    if (successCount > 0) {
        const successRate = ((successCount / contacts.length) * 100).toFixed(1);
        console.log(`📈 Success rate: ${successRate}%`);
    }
    
    if (failedContacts.length > 0) {
        console.log('\n⚠️  Failed contacts:');
        failedContacts.forEach(contact => console.log(`   - ${contact}`));
        
        // Save failed contacts to a file for retry
        const failedFile = 'data/contact_lists/failed_contacts.txt';
        try {
            fs.writeFileSync(failedFile, failedContacts.join('\n'));
            console.log(`\n💾 Failed contacts saved to: ${failedFile}`);
            console.log('   You can retry these contacts later.');
        } catch (err) {
            console.log('\n⚠️  Could not save failed contacts to file.');
        }
    }
    
    console.log('\n✨ Done! You can now close this window.\n');
    rl.close();
    
    // Give time to read the summary before exiting
    setTimeout(() => {
        process.exit(failCount === 0 ? 0 : 1);
    }, 2000);
}

// Start the bulk messaging
sendBulkMessages().catch(console.error);