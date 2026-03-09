const express = require('express');
const { Server: SocketIOServer } = require('socket.io');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
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

// Database setup
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database error:', err.message);
  } else {
    console.log('📊 Connected to SQLite database');
    initializeDatabase();
  }
});

const initializeDatabase = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      items TEXT NOT NULL,
      total_price REAL NOT NULL,
      status TEXT DEFAULT 'pending'
    )
  `, (err) => {
    if (err) console.error('❌ Orders table error:', err.message);
    else console.log('✅ Orders table ready');
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT
    )
  `, (err) => {
    if (err) console.error('❌ Customers table error:', err.message);
    else console.log('✅ Customers table ready');
  });
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
    const timestamp = new Date().toISOString();

    console.log(`📝 Processing order for ${customerName}: ${JSON.stringify(cart.map(c => c.name))}`);

    // Save to database
    db.run(
      'INSERT INTO orders (timestamp, name, phone, items, total_price) VALUES (?, ?, ?, ?, ?)',
      [timestamp, customerName, from, itemsJSON, totalPrice],
      (err) => {
        if (err) {
          console.error(`❌ Database error for ${from}:`, err.message);
        } else {
          console.log(`✅ Order saved to database for ${customerName}: ₹${totalPrice}`);
        }
      }
    );

    // Save to CSV
    const cartSummary = cart.map(item => `${item.name}(${item.quantity})`).join(', ');
    saveOrderToCSV(timestamp, customerName, from, cartSummary, totalPrice);

    // Send order confirmation
    const cartDetails = cart.map(item => 
      `${item.name} x${item.quantity} = ₹${item.lineTotal}`
    ).join('\n');

    const confirmationMessage = `✅ *ORDER CONFIRMED!*\n\n📦 *Items:*\n${cartDetails}\n\n💰 *Total: ₹${totalPrice}*\n\n💳 *Payment Details:*\nPay below UPI Number - *9373332785*\n\nThank you for your order! 🙏`;
    
    await sock.sendMessage(from, { text: confirmationMessage });
    console.log(`📤 Confirmation message sent to ${from}`);

    // Emit to frontend
    io.emit('newOrder', {
      timestamp,
      name: customerName,
      phone: from,
      items: cartSummary,
      total: totalPrice
    });

    // Clear session
    userCart.delete(from);
    userSelectedItems.delete(from);
    userOrderingSession.delete(from);

    console.log(`🎉 Order confirmed for ${customerName}: ${cartSummary} = ₹${totalPrice}`);
  } else {
    // Ignore invalid yes/no responses - wait for valid input
    console.log(`⚠️ Invalid yes/no response from ${from}: "${text}" (will wait for valid yes/no response)`);
  }
};

// ========================
// HELPER FUNCTIONS
// ========================

const getCustomerName = async (phone) => {
  return new Promise((resolve) => {
    db.get('SELECT name FROM customers WHERE phone = ?', [phone], (err, row) => {
      if (row) {
        resolve(row.name);
      } else {
        resolve('Customer');
      }
    });
  });
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

app.get('/api/orders', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY timestamp DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

app.get('/api/menu', (req, res) => {
  res.json(Object.values(COMPLETE_MENU));
});

app.post('/api/customers', (req, res) => {
  const { phone, name, address } = req.body;
  
  if (!phone || !name) {
    return res.status(400).json({ error: 'Phone and name are required' });
  }

  db.run('INSERT OR REPLACE INTO customers (phone, name, address) VALUES (?, ?, ?)',
    [phone, name, address || ''],
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ success: true, message: 'Customer added' });
      }
    }
  );
});

app.get('/api/customers', (req, res) => {
  db.all('SELECT * FROM customers', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

app.delete('/api/customers/:phone', (req, res) => {
  let { phone } = req.params;
  phone = decodeURIComponent(phone);
  
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  db.run('DELETE FROM customers WHERE phone = ?', [phone], function(err) {
    if (err) {
      console.error('❌ Delete error:', err.message);
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Customer not found' });
    } else {
      console.log(`✅ Customer deleted: ${phone}`);
      res.json({ success: true, message: 'Customer deleted', changes: this.changes });
    }
  });
});

app.get('/api/orders/export', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY timestamp DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const csv = generateCSV(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
      res.send(csv);
    }
  });
});

const generateCSV = (orders) => {
  let csv = 'Timestamp,Name,Phone,Items,Total Price,Status\n';
  orders.forEach(order => {
    const items = order.items.replace(/"/g, '""'); // Escape quotes for CSV
    csv += `"${order.timestamp}","${order.name}","${order.phone}","${items}",${order.total_price},"${order.status}"\n`;
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
  console.log('Shutting down gracefully...');
  db.close();
  server.close();
  process.exit(0);
});
