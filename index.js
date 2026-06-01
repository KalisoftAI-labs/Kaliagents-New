import { useMultiFileAuthState, DisconnectReason, makeWASocket, delay } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';
import fs from 'fs';

// Connection state
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 5000; // 5 seconds

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Format uptime helper function
function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

// Initialize logger
const logger = {
  info: (msg) => console.log(`[${new Date().toISOString()}] INFO: ${msg}`),
  error: (msg) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`),
  warn: (msg) => console.warn(`[${new Date().toISOString()}] WARN: ${msg}`),
  debug: () => {},
  trace: () => {},
  fatal: (msg) => { 
    console.error(`[${new Date().toISOString()}] FATAL: ${msg}`);
    process.exit(1); 
  },
  child: () => logger
};

// Function to process commands
function processCommand(message, sender, isGroup) {
  const command = message.trim().toLowerCase();
  
  switch(command) {
    case '!menu':
      return `📱 *Main Menu* 📱\n\n` +
             '1️⃣ *Help* - Show all commands\n' +
             '2️⃣ *Status* - Check bot status\n' +
             '3️⃣ *About* - About this bot\n' +
             '4️⃣ *Uptime* - Check bot uptime\n' +
             '5️⃣ *Time* - Current server time\n\n' +
             'Reply with the number of your choice or type !help for all commands.';
              
    case '!help':
      return `🤖 *Bot Commands* 🤖\n\n` +
             `• !menu - Show interactive menu\n` +
             `• !help - Show this help menu\n` +
             `• !ping - Check if bot is alive\n` +
             `• !time - Show current server time\n` +
             `• !about - Show bot information\n` +
             `• !status - Show bot status\n` +
             `• !uptime - Show bot uptime\n\n` +
             `Or simply type 1-5 to use the menu! 🚀`;
              
    case '!ping':
      return '🏓 Pong! Bot is alive and running!';
      
    case '!time':
      return `🕒 Current server time: ${new Date().toLocaleString()}`;
      
    case '!about':
      return `🤖 *WhatsApp Bot*\n` +
             `Version: 1.0.0\n` +
             `Powered by Baileys\n` +
             `Type !help for commands`;
             
    case '!status':
      return `🟢 *Bot Status*\n` +
             `• Status: Online\n` +
             `• Uptime: ${formatUptime(process.uptime())}\n` +
             `• Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB\n` +
             `• Platform: ${process.platform}`;
             
    case '!uptime':
      return `⏱️ Bot uptime: ${formatUptime(process.uptime())}`;
      
    default:
      if (command.startsWith('!echo ')) {
        return message.substring(6);
      }
      return null;
  }
}

// Function to handle menu selections
function handleMenuSelection(option, sender, isGroup) {
  const optionMap = {
    '1': '!help',
    '2': '!status',
    '3': '!about',
    '4': '!uptime',
    '5': '!time'
  };

  const command = optionMap[option.trim()];
  if (command) {
    const response = processCommand(command, sender, isGroup);
    return response || '❌ Command not found';
  }
  return '❌ Invalid option. Please try again or type !menu to see options.';
}

// Function to send a message with reconnection logic
async function sendMessage(sock, to, message, options = {}) {
  try {
    if (!sock || !isConnected) {
      throw new Error('Not connected to WhatsApp. Please wait for connection...');
    }

    logger.info(`📤 Sending message to ${to}...`);
    
    // Add @s.whatsapp.net if not present
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    
    // Prepare message content (text or image)
    let messageContent;
    if (options.image) {
      const imageInput = options.image;
      let imageData;
      if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
        imageData = { url: imageInput };
      } else {
        imageData = fs.readFileSync(imageInput);
      }
      messageContent = { image: imageData, caption: message || '' };
    } else {
      messageContent = { text: message };
    }
    
    // Send the message with retry logic
    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
      try {
        await sock.sendMessage(jid, messageContent);
        logger.info('✅ Message sent successfully!');
        return true;
      } catch (error) {
        attempts++;
        if (attempts === maxAttempts) throw error;
        
        logger.warn(`⚠️ Retry ${attempts}/${maxAttempts} - ${error.message}`);
        await delay(1000); // Wait 1 second before retry
      }
    }
    
  } catch (error) {
    logger.error('❌ Error sending message:', error.message);
    if (error.isBoom && error.output?.statusCode === DisconnectReason.connectionClosed) {
      isConnected = false;
      logger.warn('🔌 Connection lost. Attempting to reconnect...');
      await connectToWhatsApp();
    }
    throw error;
  }
}

// Terminal Menu - Deprecated, keeping for backward compatibility
function setupTerminalMenu(socket) {
  sock = socket; // Store the socket globally
  // Menu functionality has been moved to main()
  console.log('Terminal menu is now managed by the main process.');
}

// Function to connect to WhatsApp
async function connectToWhatsApp() {
  console.log('🔌 Initializing WhatsApp connection...');
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    let qrGenerated = false;

    sock = makeWASocket({
      auth: state,
      logger: logger,
      printQRInTerminal: false,
      browser: ['WhatsApp Bot', 'Chrome', '1.0.0'],
      markOnlineOnConnect: true,
      syncFullHistory: false,
      connectTimeoutMs: 30000, // 30 seconds timeout
      keepAliveIntervalMs: 10000, // Send keep-alive every 10 seconds
    });
    
    isConnected = false;
    reconnectAttempts = 0;

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Show QR code if available
      if (qr) {
        console.clear();
        console.log('\n' + '='.repeat(60));
        console.log('🔍 SCAN WHATSAPP QR CODE TO CONNECT');
        console.log('='.repeat(60));
        console.log('📱 INSTRUCTIONS:');
        console.log('1. Open WhatsApp on your phone');
        console.log('2. Tap Menu (⋮) > Linked Devices > Link a Device');
        console.log('3. Scan the QR code below:');
        console.log('='.repeat(60) + '\n');
        
        // Generate QR code with larger size for better visibility
        qrcode.generate(qr, { small: false });
        
        console.log('\n' + '='.repeat(60));
        console.log('� TIP: The QR code will refresh every 30 seconds if not scanned');
        console.log('='.repeat(60) + '\n');
        
        // Reset QR code after 30 seconds if not scanned
        if (qrGenerated) {
          clearTimeout(qrTimeout);
        } else {
          qrGenerated = true;
        }
        
        qrTimeout = setTimeout(() => {
          qrGenerated = false;
        }, 30000);
      }

      if (connection === 'open') {
        isConnected = true;
        reconnectAttempts = 0;
        logger.info('✅ Successfully connected to WhatsApp!');
        console.log('\n✨ You can now send messages!');
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        isConnected = false;
        
        if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delayTime = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
          reconnectAttempts++;
          
          console.log(`🔄 Connection closed. Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delayTime/1000} seconds...`);
          
          // Use a self-executing async function to handle the delay and reconnection
          (async () => {
            await delay(delayTime);
            await connectToWhatsApp();
          })();
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.error('❌ Max reconnection attempts reached. Please restart the bot.');
        }
      }
    });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    sock.ev.on('messages.upsert', async (m) => {
      try {
        const msg = m.messages[0];
        if (!msg.message) return;
        
        // Extract message content
        const messageText = msg.message.conversation || 
                          msg.message.extendedTextMessage?.text || 
                          (msg.message.imageMessage ? '[Image]' : 
                          msg.message.videoMessage ? '[Video]' : 
                          msg.message.audioMessage ? '[Audio]' :
                          msg.message.documentMessage ? '[Document]' :
                          JSON.stringify(msg.message));
        
        // Get sender's information
        const sender = msg.key.remoteJid;
        if (!sender) return;
        
        const isGroup = sender.endsWith('@g.us');
        const senderNumber = sender.split('@')[0];
        
        // Log received messages
        logger.info(`\n📩 New ${isGroup ? 'group ' : ''}message from ${senderNumber}: ${messageText}`);
        
        // Handle menu number selections (1-5)
        if (messageText.match(/^[1-5]$/)) {
          const response = handleMenuSelection(messageText, sender, isGroup);
          if (response) {
            await sendMessage(sock, sender, response);
          }
          return;
        }
        
        // Process commands (starts with !)
        if (messageText.startsWith('!')) {
          try {
            const response = processCommand(messageText, sender, isGroup);
            if (response) {
              await sendMessage(sock, sender, response);
            }
          } catch (error) {
            logger.error('Error processing command:', error);
            await sendMessage(sock, sender, '❌ An error occurred while processing your command.');
          }
          return;
        }
        
        // Auto-reply to direct messages
        if (!isGroup) {
          const lowerMessage = messageText.toLowerCase();
          if (lowerMessage === 'hi' || lowerMessage === 'hello' || lowerMessage === 'hey') {
            await sendMessage(sock, sender, '👋 Hello! Thanks for messaging me. Type !menu to see what I can do!');
          }
        }
      } catch (error) {
        logger.error('Error in message handler:', error);
      }
    });

    return sock;

  } catch (error) {
    console.error('\n❌ Connection error:');
    console.error('Error:', error.message);
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('💡 Try running: npm install');
    }
    process.exit(1);
  }
}

// Terminal menu instance
let rl = null;

// Main function
async function main() {
  try {
    console.log('🚀 Starting WhatsApp Bot...');
    
    // Show welcome message
    console.log(`
     ██████╗  ██████╗ ████████╗    ██████╗  ██████╗ ████████╗
     ██╔══██╗██╔═══██╗╚══██╔══╝   ██╔════╝ ██╔═══██╗╚══██╔══╝
     ██████╔╝██║   ██║   ██║█████╗██║  ███╗██║   ██║   ██║   
     ██╔══██╗██║   ██║   ██║╚════╝██║   ██║██║   ██║   ██║   
     ██║  ██║╚██████╔╝   ██║      ╚██████╔╝╚██████╔╝   ██║   
     ╚═╝  ╚═╝ ╚═════╝    ╚═╝       ╚═════╝  ╚═════╝    ╚═╝   
    `);
    
    // Initialize readline interface
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Connect to WhatsApp
    await connectToWhatsApp();
    
    // Show status after a short delay
    const showStatus = () => {
      try {
        if (sock?.user) {
          const user = sock.user;
          const botNumber = user.id ? user.id.split(':')[0] : 'Not available';
          const status = isConnected ? '🟢 Online' : '🔴 Offline';
          
          console.log('\n' + '='.repeat(50));
          console.log('🤖 *Bot Status*');
          console.log('='.repeat(50));
          console.log(`🔹 Status:    ${status}`);
          console.log(`📱 Number:    ${botNumber}`);
          console.log(`🔄 Uptime:    ${formatUptime(process.uptime())}`);
          console.log(`💻 Platform:  ${process.platform}`);
          console.log('='.repeat(50));
          console.log('💡 Type "!menu" in WhatsApp or select options below');
          console.log('🔌 Connected to WhatsApp Web');
          console.log('🔄 Listening for messages...\n');
        }
      } catch (error) {
        logger.error('Error showing status:', error);
      }
    };
    
    // Show the terminal menu
    function showMenu() {
      console.log('\n' + '='.repeat(50));
      console.log('🤖 Bot Control Panel');
      console.log('='.repeat(50));
      console.log('1. Show Bot Status');
      console.log('2. Send Test Message');
      console.log('3. Get Uptime');
      console.log('4. Exit');
      console.log('='.repeat(50));
      
      rl.question('Select an option (1-4): ', handleMenuInput);
    }
    
    // Handle menu input
    function handleMenuInput(answer) {
      switch(answer.trim()) {
        case '1':
          showStatus();
          showMenu();
          break;
          
        case '2':
          if (!isConnected) {
            console.log('❌ Bot is not connected. Please wait for connection...');
            showMenu();
            return;
          }
          
          rl.question('Enter phone number (with country code, no +): ', (number) => {
            rl.question('Enter message (or press Enter to send just the image): ', async (message) => {
              rl.question('Image path or URL (or Enter to skip): ', async (imagePath) => {
                try {
                  console.log('⏳ Sending message...');
                  const options = {};
                  if (imagePath.trim()) {
                    options.image = imagePath.trim();
                  }
                  await sendMessage(sock, number, message, options);
                } catch (error) {
                  console.error('❌ Error:', error.message);
                }
                showMenu();
              });
            });
          });
          break;
          
        case '3':
          console.log(`\n⏱️ Bot uptime: ${formatUptime(process.uptime())}`);
          showMenu();
          break;
          
        case '4':
          console.log('\n👋 Goodbye!');
          rl.close();
          process.exit(0);
          break;
          
        default:
          console.log('\n❌ Invalid option');
          showMenu();
      }
    }
    
    // Initial status update and show menu
    setTimeout(() => {
      showStatus();
      showMenu();
    }, 1000);
    
    // Update status every 30 seconds
    setInterval(showStatus, 30000);
    
  } catch (error) {
    console.error('\n❌ Fatal error:');
    console.error(error);
    if (rl) rl.close();
    process.exit(1);
  }
}

// Start the bot
main();