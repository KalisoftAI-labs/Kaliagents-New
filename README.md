# WhatsApp Bot with QR Code Authentication

A powerful WhatsApp bot built with Node.js that provides interactive features through both WhatsApp messages and a terminal interface. This bot uses the `@whiskeysockets/baileys` library for WhatsApp Web integration.

## 🚀 Features

- **Dual Interface**: Control the bot via WhatsApp messages or terminal
- **QR Code Authentication**: Easy login process
- **Interactive Menus**: Navigate features with ease
- **Real-time Status**: Monitor bot status and uptime
- **Bulk Messaging**: Send messages to multiple contacts at once
- **Image/Media Sending**: Attach images (local file or URL) to any message
- **Campaign Manager**: Create, send, and track bulk messaging campaigns with delivery analytics
- **Auto-reconnect**: Automatically reconnects if connection is lost
- **Rate Limit Handling**: Smart delays to prevent account restrictions

## 📋 Prerequisites

- Node.js v14 or higher
- npm (comes with Node.js)
- A phone number for WhatsApp verification
- Basic terminal/command line knowledge

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/whatsapp-bot.git
   cd whatsapp-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

## 🔐 Authentication

### Method 1: QR Code (Recommended for Development)

1. Run the QR code generator:
   ```bash
   node whatsapp-qr.js
   ```
2. Open WhatsApp on your phone
3. Go to Menu (⋮) > Linked Devices > Link a Device
4. Scan the QR code shown in the terminal

### Method 2: Session File

After first authentication, an `auth_info_baileys` folder will be created containing your session data.

## 🚦 Quick Start

1. **Start the bot**:

   ```bash
   npm start
   ```

   or

   ```bash
   node index.js
   ```

2. **For QR code authentication**:
   ```bash
   node whatsapp-qr.js
   ```

## 🎮 Using the Bot

### WhatsApp Commands

- `!menu` - Show main menu
- `!help` - Show help information
- `!status` - Check bot status
- `!time` - Show current server time
- `!uptime` - Show bot uptime

### Bulk Messaging

Send messages to multiple contacts at once:

1. Prepare a text file (`contacts.txt`) with one phone number per line (include country code, no '+')

   ```
   919876543210
   919876543211
   919876543212
   ```

2. Run the bulk message script:

   ```bash
   node bulkMessage.js
   ```

3. Follow the prompts to:
   - Enter your message (type `.` on a new line to finish)
   - Optionally provide an image path or URL (or press Enter to skip)
   - Provide the path to your contacts file
   - Scan the QR code when prompted
   - Type `SEND` to start sending messages

### Campaign Manager (bulkReplySystem.js)

Full campaign lifecycle tool with analytics:

```bash
node bulkReplySystem.js
```

- Create a campaign with a name, message, and optional image attachment
- Select contact list from `data/contact_lists/`
- Sends messages with 2s rate limiting and tracks delivery/read receipts
- Records responses from recipients
- Send follow-up messages to past campaign recipients (with optional image)
- Analytics dashboard with response rates and best-performing campaigns

### Terminal Interface

When you run the main bot, you'll see a menu with these options:

1. Show Bot Status
2. Send Test Message (supports text + optional image)
3. Get Uptime
4. Exit

#### Sending Images via Terminal Menu

When sending a test message (option 2), you'll be prompted for:
1. **Phone number** (with country code, no `+`)
2. **Message text** (or press Enter to send just the image)
3. **Image path or URL** (or press Enter for text-only)

Supports both local file paths (e.g. `C:\photo.jpg` or `data\images\photo.jpg`) and web URLs.

## 🖼️ Image Sending

All scripts support sending images alongside text messages.

### Supported Formats

- **Local file**: Provide an absolute or relative path (e.g. `data/images/photo.jpg` or `C:\Users\Admin\Pictures\photo.png`)
- **Web URL**: Provide a direct image URL (e.g. `https://example.com/photo.jpg`)

### How It Works

When an image is provided, it's sent as a WhatsApp image with your text as the caption. If no text is entered, the image is sent with an empty caption.

### Storage Recommendation

Place your images in `data/images/` (create the folder if needed):

```
data/images/
├── promo1.jpg
├── promo2.jpg
└── banner.png
```

Then when prompted for an image path, enter: `data/images/promo1.jpg`

## 🔧 Troubleshooting

### Common Issues

1. **QR Code Not Working**

   - Ensure your phone has an active internet connection
   - Try deleting the `auth_info_baileys` folder and restarting
   - Make sure you're scanning with the same WhatsApp account
   - If QR code doesn't appear, check your terminal for any error messages

2. **Bulk Messaging Issues**

   - Ensure phone numbers are in international format (without '+')
   - Check that the contacts file exists and is readable
   - If messages fail to send, verify the numbers are registered on WhatsApp
   - The script includes rate limiting - don't modify the delays to avoid restrictions

3. **Connection Issues**

   ```bash
   # Clear npm cache
   npm cache clean --force

   # Delete node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Logger Errors**
   If you see "logger.child is not a function":
   ```bash
   npm install pino@latest pino-pretty@latest
   ```

## 📂 Project Structure

- `index.js` - Main bot application (interactive bot + terminal menu)
- `bulkMessage.js` - Send text/image to multiple contacts from a file
- `bulkReplySystem.js` - Full campaign manager with analytics and follow-ups
- `whatsapp-qr.js` - QR code authentication standalone
- `test-connection.js` - Connection test utility
- `package.json` - Project dependencies and scripts
- `auth_info_baileys/` - Session storage (created after first login)
- `data/contact_lists/` - Contact lists (one number per line)
- `data/campaigns/` - Campaign data (auto-created)

## 📦 Dependencies

- `@whiskeysockets/baileys` - WhatsApp Web API
- `qrcode-terminal` - Generate QR codes in terminal
- `pino` - Logging
- `dotenv` - Environment variable management

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [WhiskeySockets](https://github.com/WhiskeySockets/Baileys) for the baileys library
- All open source contributors

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
