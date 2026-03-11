const express = require('express');
const { Server: SocketIOServer } = require('socket.io');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const cron = require('node-cron');
const { Pool } = require('pg');
const fs = require('fs');
const QRCode = require('qrcode');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { createWriteStream } = require('fs');
const { format } = require('fast-csv');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ========================
// COMPLETE MENU DATA
// ========================
const COMPLETE_MENU = {
  // Juice section
  1: { id: 1, name: 'Amla juice', price: 25, category: 'Juice' },
  2: { id: 2, name: 'Beetroot juice', price: 25, category: 'Juice' },
  3: { id: 3, name: 'Carrot juice', price: 25, category: 'Juice' },
  4: { id: 4, name: 'Karela juice', price: 25, category: 'Juice' },
  5: { id: 5, name: 'Palak juice', price: 25, category: 'Juice' },
  6: { id: 6, name: 'Ash gourd juice', price: 25, category: 'Juice' },
  7: { id: 7, name: 'ABC Juice', price: 25, category: 'Mix Juice' },
  8: { id: 8, name: 'Amla + Karela juice', price: 25, category: 'Mix Juice' },
  9: { id: 9, name: 'Beetroot + Carrot juice', price: 25, category: 'Mix Juice' },
  10: { id: 10, name: 'Amla + Palak', price: 25, category: 'Mix Juice' },
  // Detox waters
  11: { id: 11, name: 'Liver cleanser detox', price: 10, category: 'Detox waters' },
  12: { id: 12, name: 'Beauty boost detox', price: 15, category: 'Detox waters' },
  13: { id: 13, name: 'Digestive boost kanji water', price: 15, category: 'Detox waters' },
  // Salads
  14: { id: 14, name: 'Mix sprouts salad', price: 40, category: 'Salads' },
  15: { id: 15, name: 'Paneer + sprout salad', price: 85, category: 'Salads' }
};

const generateMenuMessage = () => {
  return `🍽️ *SWASTH CAFE MENU* 🍽️

*🥤 JUICES*
1️⃣ Amla juice – 25/-
2️⃣ Beetroot juice – 25/-
3️⃣ Carrot juice – 25/-
4️⃣ Karela juice – 25/-
5️⃣ Palak juice – 25/-
6️⃣ Ash gourd juice – 25/-

*🥛 MIX JUICES*
7️⃣ ABC Juice – 25/-
8️⃣ Amla + Karela juice – 25/-
9️⃣ Beetroot + Carrot juice – 25/-
🔟 Amla + Palak – 25/-

*💧 DETOX WATERS*
1️⃣1️⃣ Liver cleanser detox – 10/-
1️⃣2️⃣ Beauty boost detox – 15/-
1️⃣3️⃣ Digestive boost kanji water – 15/-

*🥗 SALADS*
1️⃣4️⃣ Mix sprouts salad – 40/-
1️⃣5️⃣ Paneer + sprout salad – 85/-

📝 *Reply with item numbers separated by commas*
Example: 1,2,3,12,10`;
};

// ========================
// DATABASE SETUP (PostgreSQL)
// ========================
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'swasth_cafe',
  user: process.env.DB_USER || 'swasth',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client:', err.message);
});

pool.on('connect', () => {
  console.log('✅ PostgreSQL connection established');
});

const initializeDatabase = async () => {
  try {
    // Create customers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Customers table ready');

    // Create orders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        items JSONB NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Orders table ready');

    // Create menu table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu (
        id SERIAL PRIMARY KEY,
        item_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        category VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Menu table ready');

    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone)');
    console.log('✅ Database indexes created');

    console.log('📊 PostgreSQL database initialized successfully');
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
  }
};

// Initialize database on startup
initializeDatabase();

// ========================
// PHONE NORMALIZATION
// ========================
// ========================
// TIMESTAMP FORMATTING - IST (UTC+5:30)
// ========================
const getISTTimestamp = () => {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000) - (5.5 * 60 * 60 * 1000) + (5.5 * 60 * 60 * 1000));
  
  // Return ISO string for database
  const date = new Date(now.getTime() + (5.5 * 60 * 60 * 1000) - now.getTimezoneOffset() * 60 * 1000);
  return date.toISOString();
};

// ========================
// PHONE NORMALIZATION
// ========================
const normalizePhone = (phone) => {
  // Remove WhatsApp JID suffixes and clean up phone number
  if (!phone) return '';
  
  // Remove all WhatsApp suffixes (@s.whatsapp.net, @lid, @g.us, etc)
  let cleaned = phone.replace(/@s\.whatsapp\.net$/, '')
                     .replace(/@lid$/, '')
                     .replace(/@g\.us$/, '')
                     .replace(/\s+/g, '')  // Remove any whitespace
                     .trim();
  
  // If somehow it still has @, remove everything after it
  if (cleaned.includes('@')) {
    cleaned = cleaned.split('@')[0];
  }
  
  // Ensure it's only digits
  cleaned = cleaned.replace(/\D/g, '');
  
  // Only keep if it's 10 digits (without country code) or 12+ digits (with country code)
  if (cleaned.length >= 10) {
    return cleaned;
  }
  
  console.log(`⚠️ Invalid phone after normalization: ${phone} -> ${cleaned}`);
  return null;
};

// ========================
// FETCH CUSTOMER DETAILS FROM DATABASE
// ========================
const getCustomerDetails = async (phone) => {
  const normalizedPhone = normalizePhone(phone);
  
  if (!normalizedPhone) {
    console.log(`❌ Phone normalization failed for: ${phone}`);
    return {
      name: 'Customer',
      phone: normalizedPhone || phone,
      address: null
    };
  }
  
  console.log(`🔍 Looking up customer: ${normalizedPhone}`);
  
  try {
    const result = await pool.query(
      'SELECT name, phone, address FROM customers WHERE phone = $1',
      [normalizedPhone]
    );
    
    if (result.rows.length > 0) {
      const customer = result.rows[0];
      console.log(`✅ Customer found: ${customer.name} (${customer.phone})`);
      return customer;
    }
    
    console.log(`⚠️ Customer NOT found in database for: ${normalizedPhone}`);
    // Return defaults if customer not found
    return {
      name: 'Customer',
      phone: normalizedPhone,
      address: null
    };
  } catch (error) {
    console.error('❌ Database error getting customer:', error.message);
    return {
      name: 'Customer',
      phone: normalizedPhone,
      address: null
    };
  }
};

// ========================
// STATE MANAGEMENT
// ========================
const userCart = new Map();              // Maps phone -> [{id, name, price, qty}, ...]
const userOrderingSession = new Map();   // Maps phone -> { state: 'awaiting_items'|'awaiting_qty'|'awaiting_more'|'awaiting_qty_for_item_X' }
const userSelectedItems = new Map();     // Maps phone -> [1,2,3,12] (item IDs)
const processedMessages = new Map();     // Maps messageId -> timestamp (prevents duplicate processing)
const userLastMessage = new Map();       // Maps phone -> { id, text, timestamp } (detects rapid duplicates)
let cronJobScheduled = false;            // Flag to prevent duplicate cron jobs

// ========================
// MESSAGE DEDUPLICATION
// ========================
const isMessageDuplicate = (from, messageId, text) => {
  const DUPLICATE_THRESHOLD = 2000; // 2 seconds - consider duplicates within this window
  const now = Date.now();
  
  // IMMEDIATELY mark message as processed to prevent race conditions
  // Check if message ID already processed
  if (processedMessages.has(messageId)) {
    console.log(`⚠️ Duplicate message ID detected: ${messageId}`);
    return true;
  }
  
  // Mark as processed RIGHT AWAY to prevent duplicate processing
  processedMessages.set(messageId, now);
  
  // Check if user sent same message within threshold
  const lastMsg = userLastMessage.get(from);
  if (lastMsg && lastMsg.text === text && (now - lastMsg.timestamp) < DUPLICATE_THRESHOLD) {
    console.log(`⚠️ Duplicate message from ${from}: "${text.substring(0, 20)}..."`);
    return true;
  }
  
  // Clean up old entries (keep only last 100 messages)
  if (processedMessages.size > 100) {
    const oldestKey = processedMessages.keys().next().value;
    processedMessages.delete(oldestKey);
  }
  
  // Store user's last message
  userLastMessage.set(from, { id: messageId, text, timestamp: now });
  
  return false;
};

// ========================
// TIME MANAGEMENT
// ========================
const ORDERING_CONFIG = {
  startTime: 9,    // 9:00 AM
  endTime: 20,     // 8:00 PM
  timezone: 'IST'
};

const isOrderingAllowed = () => {
  const now = new Date();
  const currentHour = now.getHours();
  return currentHour >= ORDERING_CONFIG.startTime && currentHour < ORDERING_CONFIG.endTime;
};

const getOrderingClosedMessage = () => {
  const now = new Date();
  const currentHour = now.getHours();
  
  if (currentHour >= ORDERING_CONFIG.endTime) {
    return `🕙 *ORDERING TIME CLOSED* 🕙

Sorry, our ordering window has closed for today!

⏰ *Ordering Hours:*
🌅 9:00 AM - 8:00 PM (Daily)

🕐 Current Time: ${now.toLocaleTimeString('en-IN', { 
  hour: '2-digit', 
  minute: '2-digit',
  hour12: true 
})} ${ORDERING_CONFIG.timezone}

📱 *You can place your order tomorrow from 9:00 AM onwards!*

Thank you! 🙏`;
  } else {
    return `🕙 *ORDERING NOT STARTED YET* 🕙

Good morning! Ordering is not available right now.

⏰ *Ordering Hours:*
🌅 9:00 AM - 8:00 PM (Daily)

🕐 Current Time: ${now.toLocaleTimeString('en-IN', { 
  hour: '2-digit', 
  minute: '2-digit',
  hour12: true 
})} ${ORDERING_CONFIG.timezone}

📱 *Orders open at 9:00 AM! Come back soon!*

Thank you! 🙏`;
  }
};

// WhatsApp variables
let sock;
let qrCodeUrl = null;
let connectionStatus = 'disconnected';

// ========================
// WHATSAPP CONNECTION
// ========================
const connectWhatsApp = async () => {
  try {
    const authPath = path.join(__dirname, 'auth');
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    
    console.log('📱 Setting up WhatsApp connection...');
    
    sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: ['Chrome', 'Windows', '10'],
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      fireInitQueries: true,
      markOnlineOnConnect: true
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        try {
          console.log('\n════════════════════════════════════════');
          console.log('🔐 QR CODE GENERATED');
          console.log('════════════════════════════════════════');
          console.log('📱 Open WhatsApp on your phone');
          console.log('📸 Settings → Linked Devices → Link a Device');
          console.log('✨ Scan the QR code on the web dashboard');
          console.log('════════════════════════════════════════\n');
          
          qrCodeUrl = await QRCode.toDataURL(qr);
          io.emit('qrCode', qrCodeUrl);
          console.log('✅ QR code sent to frontend dashboard');
        } catch (error) {
          console.error('❌ QR Generation Error:', error.message);
        }
      }

      if (connection === 'open') {
        console.log('\n✅ ✅ ✅ WhatsApp Connected Successfully! ✅ ✅ ✅\n');
        connectionStatus = 'connected';
        qrCodeUrl = null;
        io.emit('connectionStatus', { status: 'connected' });
        console.log('📊 Dashboard is now fully functional');
        console.log('⏰ Menu will broadcast at 9 AM daily\n');
        // Initialize cron job only once
        initializeCronJob();
      }

      if (connection === 'close') {
        connectionStatus = 'disconnected';
        io.emit('connectionStatus', { status: 'disconnected' });
        
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          console.log('\n⚠️ Connection closed.');
          console.log('🔄 Reconnecting in 5 seconds...\n');
          setTimeout(() => connectWhatsApp(), 5000);
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
      try {
        const message = m.messages[0];
        if (!message.message) return;

        const from = message.key.remoteJid;
        const messageId = message.key.id;
        const text = message.message.conversation || message.message.extendedTextMessage?.text;
        
        if (!text) return;

        // Ignore whitespace-only messages
        if (text.trim().length === 0) return;

        // Check for duplicate messages (prevents Baileys event duplication)
        if (isMessageDuplicate(from, messageId, text)) {
          return; // Ignore duplicate message
        }

        console.log(`📨 Message from ${from}: "${text}"`);

        // ✅ STEP 1: Check if ordering is allowed by time
        if (!isOrderingAllowed()) {
          await sock.sendMessage(from, { text: getOrderingClosedMessage() });
          return;
        }

        // Get customer name
        const customerName = await getCustomerName(from);

        // ✅ STEP 2: Check if this is a NEW SESSION (first message from user)
        const isNewSession = !userOrderingSession.has(from);
        
        if (isNewSession) {
          // This is the customer's first message - send the menu
          userOrderingSession.set(from, { state: 'awaiting_items' });
          await sock.sendMessage(from, { text: generateMenuMessage() });
          return;
        }

        // Get existing session state
        let session = userOrderingSession.get(from);

        // ✅ STEP 3: Handle different conversation states
        if (session.state === 'awaiting_items') {
          await handleItemSelection(from, text, customerName);
        } else if (session.state === 'awaiting_qty') {
          await handleQuantityInput(from, text, customerName);
        } else if (session.state === 'awaiting_more') {
          await handleOrderMoreResponse(from, text, customerName);
        }

      } catch (error) {
        console.error('❌ Message handler error:', error.message);
      }
    });

  } catch (error) {
    console.error('❌ WhatsApp connection error:', error.message);
    console.log('🔄 Retrying in 5 seconds...');
    setTimeout(connectWhatsApp, 5000);
  }
};

// ========================
// MESSAGE HANDLERS
// ========================

// Input validation - ensures text is in proper format "1,2,3" not menu garbage
const isValidItemSelectionInput = (text) => {
  // Only allow numbers, commas, spaces, and hyphens
  const cleanInput = text.trim();
  
  // Reject if contains common menu words
  const menuKeywords = ['juice', 'detox', 'salad', 'water', 'menu', 'amla', 'beetroot', 'carrot', 'palak', 'kanji', 'sprout', 'paneer'];
  const lowerText = cleanInput.toLowerCase();
  if (menuKeywords.some(keyword => lowerText.includes(keyword))) {
    return false;
  }
  
  // Check if input only contains numbers, commas, and spaces
  const validPattern = /^[0-9, ]+$/;
  if (!validPattern.test(cleanInput)) {
    return false;
  }
  
  // Extract numbers and check count
  const numbers = cleanInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  
  // Reject if too many items at once (more than 7)
  if (numbers.length > 7) {
    return false;
  }
  
  // Reject if empty
  if (numbers.length === 0) {
    return false;
  }
  
  return true;
};

// Step 1: Handle item selection (e.g., "1,2,3,12,10")
const handleItemSelection = async (from, text, customerName) => {
  // Validate input format first
  if (!isValidItemSelectionInput(text)) {
    // Silently ignore invalid input - don't send error messages
    console.log(`⚠️ Invalid item selection from ${from}: "${text}"`);
    return;
  }

  const itemNumbers = text.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

  // Validate all items exist
  const invalidItems = itemNumbers.filter(num => !COMPLETE_MENU[num]);
  if (invalidItems.length > 0) {
    console.log(`⚠️ Invalid item numbers from ${from}: ${invalidItems.join(', ')}`);
    return;
  }

  // Store selected items
  userSelectedItems.set(from, itemNumbers);
  
  // Ask for quantities
  const itemsList = itemNumbers.map(id => `${id}. ${COMPLETE_MENU[id].name}`).join('\n');
  
  await sock.sendMessage(from, {
    text: `✅ Great! You selected:\n\n${itemsList}\n\n📦 Now, please reply with quantities for each item (in same order).\nExample: 1,2,3,1,2`
  });

  // Update session state
  userOrderingSession.set(from, { state: 'awaiting_qty' });
  console.log(`📋 User ${from} selected items: ${itemNumbers.join(',')}`);
};

// Step 2: Handle quantity input
const handleQuantityInput = async (from, text, customerName) => {
  const selectedItems = userSelectedItems.get(from);
  if (!selectedItems) {
    await sock.sendMessage(from, { text: generateMenuMessage() });
    userOrderingSession.set(from, { state: 'awaiting_items' });
    return;
  }

  const quantities = text.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
  
  // Validate quantity count - silently ignore if wrong
  if (quantities.length !== selectedItems.length) {
    console.log(`⚠️ Invalid quantity count from ${from}: expected ${selectedItems.length}, got ${quantities.length}`);
    return;
  }

  // Build new items from this selection
  const newItems = selectedItems.map((itemId, idx) => ({
    ...COMPLETE_MENU[itemId],
    quantity: quantities[idx],
    lineTotal: COMPLETE_MENU[itemId].price * quantities[idx]
  }));

  // Get existing cart (if any) or start fresh - APPEND new items!
  const existingCart = userCart.get(from) || [];
  const updatedCart = [...existingCart, ...newItems];
  
  userCart.set(from, updatedCart);
  console.log(`🛒 Cart updated for ${from}: ${updatedCart.length} total items (added ${newItems.length} new items)`);

  // Calculate total
  const totalPrice = updatedCart.reduce((sum, item) => sum + item.lineTotal, 0);

  // Ask if they want to order more
  const cartSummary = updatedCart.map(item => 
    `${item.id}. ${item.name} x${item.quantity} = ₹${item.lineTotal}`
  ).join('\n');

  const moreItemsMessage = `📦 *YOUR CART:*\n\n${cartSummary}\n\n💰 *Total: ₹${totalPrice}*\n\n❓ Do you want to order more items?\nReply: *Yes* or *No*`;
  
  await sock.sendMessage(from, { text: moreItemsMessage });
  console.log(`📤 "More items?" message sent to ${from}`);

  userOrderingSession.set(from, { state: 'awaiting_more' });
  console.log(`💳 User ${from} cart total: ₹${totalPrice}`);
};

// Step 3: Handle "Order More?" response
const handleOrderMoreResponse = async (from, text, customerName) => {
  const response = text.trim().toLowerCase();
  console.log(`📨 Handling "order more" response from ${from}: "${response}"`);

  if (response === 'yes' || response === 'y') {
    // IMPORTANT: Keep existing cart, only reset item selection
    // Do NOT delete userCart - we need to preserve it for final total!
    userSelectedItems.delete(from);
    userOrderingSession.set(from, { state: 'awaiting_items' });
    
    const currentCart = userCart.get(from);
    const currentCartTotal = currentCart ? currentCart.reduce((sum, item) => sum + item.lineTotal, 0) : 0;
    console.log(`📝 Customer wants to add more items. Current cart total: ₹${currentCartTotal}`);
    
    await sock.sendMessage(from, {
      text: `🔄 *Back to Menu - Add More Items*\n\n${generateMenuMessage()}\n\n📌 Current cart value: ₹${currentCartTotal} (new items will be added to this)`
    });
  } else if (response === 'no' || response === 'n') {
    // Confirm order and save
    const cart = userCart.get(from);
    if (!cart) {
      console.log(`⚠️ No cart found for ${from}`);
      await sock.sendMessage(from, { text: generateMenuMessage() });
      userOrderingSession.set(from, { state: 'awaiting_items' });
      return;
    }

    const totalPrice = cart.reduce((sum, item) => sum + item.lineTotal, 0);
    const itemsJSON = JSON.stringify(cart);
    
    // ✅ USE IST TIMESTAMP INSTEAD OF UTC
    const timestamp = getISTTimestamp();
    console.log(`⏰ Timestamp (IST): ${timestamp}`);

    // ✅ Normalize phone number
    const normalizedPhone = normalizePhone(from);
    console.log(`📝 Processing order for: ${normalizedPhone}`);
    console.log(`📦 Items: ${JSON.stringify(cart.map(c => c.name))}`);

    // ✅ Fetch fresh customer data FIRST (before database operations)
    let customerDetails = await getCustomerDetails(from);
    console.log(`📦 Customer lookup result: name="${customerDetails.name}", phone="${customerDetails.phone}"`);

    // Save to database
    try {
      // Step 1: Insert or update customer (to satisfy foreign key constraint)
      await pool.query(
        `INSERT INTO customers (phone, name, created_at, updated_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (phone) DO UPDATE SET name = $2, updated_at = CURRENT_TIMESTAMP`,
        [customerDetails.phone, customerDetails.name]
      );
      console.log(`✅ Customer saved: ${customerDetails.name} (${customerDetails.phone})`);

      // Step 2: Insert order with customer details
      const result = await pool.query(
        'INSERT INTO orders (timestamp, name, phone, items, total_price, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [timestamp, customerDetails.name, customerDetails.phone, itemsJSON, totalPrice, 'pending']
      );
      console.log(`✅ Order saved: ID=${result.rows[0].id}, Amount=₹${totalPrice}`);
    } catch (error) {
      console.error(`❌ Database error:`, error.message);
      await sock.sendMessage(from, { text: '❌ Error processing order. Please try again.' });
      return;
    }

    // ✅ Save to CSV with customer details
    const cartSummary = cart.map(item => `${item.name}(${item.quantity})`).join(', ');
    saveOrderToCSV(timestamp, customerDetails.name, customerDetails.phone, cartSummary, totalPrice);
    console.log(`✅ CSV saved`);

    // Send order confirmation
    const cartDetails = cart.map(item => 
      `${item.name} x${item.quantity} = ₹${item.lineTotal}`
    ).join('\n');

    const confirmationMessage = `✅ *ORDER CONFIRMED!*\n\n📦 *Items:*\n${cartDetails}\n\n💰 *Total: ₹${totalPrice}*\n\n💳 *Payment Details:*\nPay below UPI Number - *9373332785*\n\nThank you for your order! 🙏`;
    
    await sock.sendMessage(from, { text: confirmationMessage });
    console.log(`📤 Confirmation sent`);

    // ✅ Emit to frontend with correct customer data
    io.emit('newOrder', {
      timestamp,
      name: customerDetails.name,
      phone: customerDetails.phone,
      items: cartSummary,
      total: totalPrice
    });
    console.log(`📡 Frontend notified`);

    // Clear session
    userCart.delete(from);
    userSelectedItems.delete(from);
    userOrderingSession.delete(from);

    console.log(`🎉 Complete: ${customerDetails.name} - ${cartSummary} = ₹${totalPrice}`);
  } else {
    // Ignore invalid yes/no responses - wait for valid input
    console.log(`⚠️ Invalid yes/no response from ${from}: "${text}"`);
  }
};

// ========================
// HELPER FUNCTIONS
// ========================

const getCustomerName = async (phone) => {
  const normalizedPhone = normalizePhone(phone);
  try {
    const result = await pool.query(
      'SELECT name FROM customers WHERE phone = $1',
      [normalizedPhone]
    );
    return result.rows.length > 0 ? result.rows[0].name : 'Customer';
  } catch (error) {
    console.error('❌ Error getting customer name:', error.message);
    return 'Customer';
  }
};

const saveOrderToCSV = (timestamp, name, phone, items, total) => {
  const csvPath = path.join(__dirname, 'orders.csv');
  const fileExists = fs.existsSync(csvPath);
  
  try {
    let csvContent = '';
    
    // Add header if file doesn't exist
    if (!fileExists) {
      csvContent = 'Timestamp,Name,Phone,Items,Total,Status\n';
    }
    
    // Escape CSV content properly
    const escapedItems = `"${items.replace(/"/g, '""')}"`;
    
    csvContent += `${timestamp},${name},${phone},${escapedItems},${total},confirmed\n`;
    
    // Append to file
    fs.appendFileSync(csvPath, csvContent);
    console.log(`✅ Order saved to CSV`);
  } catch (error) {
    console.error('❌ CSV write error:', error.message);
  }
};

// ========================
// CRON JOB - 9 AM MENU BROADCAST (Called once at startup)
// ========================
const initializeCronJob = () => {
  if (cronJobScheduled) return; // Already scheduled
  
  cronJobScheduled = true;
  
  cron.schedule('0 9 * * *', async () => {
    console.log('📢 Broadcasting menu at 9 AM...');
    
    const customersPath = path.join(__dirname, 'customers.json');
    if (!fs.existsSync(customersPath)) {
      console.log('⚠️ customers.json not found');
      return;
    }

    try {
      const customers = JSON.parse(fs.readFileSync(customersPath, 'utf8'));

      for (const customer of customers) {
        try {
          const jid = customer.phone.includes('@') ? customer.phone : `${customer.phone}@s.whatsapp.net`;
          await sock.sendMessage(jid, { text: generateMenuMessage() });
          console.log(`✅ Menu sent to ${customer.name} (${customer.phone})`);
        } catch (error) {
          console.error(`❌ Failed to send to ${customer.phone}: ${error.message}`);
        }
      }
      console.log('✅ Daily menu broadcast completed!');
    } catch (error) {
      console.error('❌ Broadcast error:', error.message);
    }
  });
};

// ========================
// SOCKET.IO
// ========================
io.on('connection', (socket) => {
  console.log(`👤 Client connected: ${socket.id}`);
  
  socket.emit('connectionStatus', { status: connectionStatus });
  if (qrCodeUrl) {
    socket.emit('qrCode', qrCodeUrl);
  }
  
  socket.on('disconnect', () => {
    console.log(`👤 Client disconnected: ${socket.id}`);
  });

  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error.message);
  });
});

// ========================
// API ROUTES
// ========================

app.get('/api/status', (req, res) => {
  res.json({
    status: connectionStatus,
    qrCode: qrCodeUrl
  });
});

app.get('/api/orders', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, timestamp, name, phone, items, total_price, status FROM orders ORDER BY timestamp DESC'
    );
    const orders = result.rows.map(order => ({
      ...order,
      items: typeof order.items === 'string' ? order.items : JSON.stringify(order.items)
    }));
    res.json(orders);
  } catch (error) {
    console.error('❌ Error fetching orders:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/menu', (req, res) => {
  res.json(Object.values(COMPLETE_MENU));
});

app.post('/api/customers', async (req, res) => {
  let { phone, name, address } = req.body;
  
  if (!phone || !name) {
    return res.status(400).json({ error: 'Phone and name are required' });
  }

  // ✅ NEW: Normalize phone number
  const normalizedPhone = normalizePhone(phone);

  try {
    await pool.query(
      'INSERT INTO customers (phone, name, address) VALUES ($1, $2, $3) ON CONFLICT (phone) DO UPDATE SET name = $2, address = $3',
      [normalizedPhone, name, address || null]
    );
    res.json({ success: true, message: 'Customer added', phone: normalizedPhone });
  } catch (error) {
    console.error('❌ Error adding customer:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/customers', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, phone, name, address, created_at FROM customers ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching customers:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/customers/:phone', async (req, res) => {
  let { phone } = req.params;
  phone = decodeURIComponent(phone);
  
  // ✅ NEW: Normalize phone number
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM customers WHERE phone = $1',
      [normalizedPhone]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    console.log(`✅ Customer deleted: ${normalizedPhone}`);
    res.json({ success: true, message: 'Customer deleted', changes: result.rowCount });
  } catch (error) {
    console.error('❌ Delete error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/export', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, timestamp, name, phone, items, total_price, status FROM orders ORDER BY timestamp DESC'
    );
    const csv = generateCSV(result.rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send(csv);
  } catch (error) {
    console.error('❌ Error exporting CSV:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const generateCSV = (orders) => {
  let csv = 'Timestamp,Name,Phone,Items,Total Price,Status\n';
  orders.forEach(order => {
    const items = typeof order.items === 'string' ? order.items : JSON.stringify(order.items);
    const itemsEscaped = items.replace(/"/g, '""'); // Escape quotes for CSV
    csv += `"${order.timestamp}","${order.name}","${order.phone}","${itemsEscaped}",${order.total_price},"${order.status}"\n`;
  });
  return csv;
};

// ========================
// START SERVER
// ========================
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log('\n═══════════════════════════════════════════════');
  console.log('🍽️  SWASTH ORDER AGENT - Server Started');
  console.log('═══════════════════════════════════════════════');
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(`📱 Frontend: http://localhost:3000`);
  console.log('\n🔄 Initializing WhatsApp Connection...');
  console.log('─────────────────────────────────────────────');
  
  await connectWhatsApp();
});

process.on('SIGINT', () => {
  console.log('\n⏹️ Shutting down gracefully...');
  pool.end(() => {
    console.log('✅ PostgreSQL connection pool closed');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
});
