# 🍽️ Swasth Order Agent

A complete beginner-friendly WhatsApp Order Management System using Node.js backend with Express.js and Baileys WhatsApp API, paired with a React frontend featuring Tailwind CSS and DaisyUI for a modern WhatsApp Business-like dashboard.

## 🎯 Features

- **WhatsApp Integration**: QR code scanner to connect WhatsApp via Baileys API
- **Automated Menu Broadcasting**: Daily 9 AM cron job sends menu to all registered customers
- **Real-time Order Processing**: Customers reply with menu numbers (1-3) to place orders
- **Live Dashboard**: Order stats, customer management, and real-time updates via Socket.io
- **CSV Export**: One-click export of all orders with timestamps
- **Customer Management**: Add and manage customer phone numbers and names
- **SQLite Database**: Persistent storage of orders and customer data

## 📁 Project Structure

```
swasth-order-agent/
├── backend/
│   ├── server.js              # Main WhatsApp connection & API
│   ├── package.json
│   ├── .env                   # Configuration (PORT=3001)
│   ├── .gitignore
│   ├── auth/                  # QR session storage (auto-created)
│   ├── customers.json         # Customer phone numbers list
│   └── database.db            # SQLite orders & customers table
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js             # Main dashboard component
│   │   ├── App.css
│   │   ├── index.js
│   │   ├── index.css
│   │   └── components/
│   │       ├── QRScanner.js   # QR code display
│   │       ├── Dashboard.js   # Stats & export
│   │       ├── OrdersList.js  # Orders table
│   │       └── CustomerManagement.js
│   ├── package.json
│   ├── .gitignore
│   └── ...
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the backend server:**
   ```bash
   npm run dev
   ```
   
   The backend will start on `http://localhost:3001`
   
   You'll see a message: "🔄 Connecting WhatsApp..."
   A QR code will be displayed in the terminal or frontend.

### Frontend Setup

In a **new terminal window**:

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the frontend:**
   ```bash
   npm start
   ```
   
   The frontend will automatically open at `http://localhost:3000`

## 📱 How to Use

### 1. Connect WhatsApp
- Open the frontend dashboard
- You'll see a QR code on the screen
- Open WhatsApp on your phone
- Go to Settings → Linked Devices → Link a Device
- Scan the QR code with your phone camera
- Approve the login

### 2. Add Customers
- Go to the **Customers** tab
- Enter customer name and phone number
- Click **Add Customer**
- Phone format: `919876543210` (country code + number)

### 3. Broadcast Menu
- At 9 AM every day, the system automatically sends:
  ```
  🍽️ Menu:
  1️⃣ Spinach Juice ₹60
  2️⃣ Carrot Juice ₹40
  3️⃣ Sprout bowl ₹30
  ```
- Customers reply with a number (1, 2, or 3) to place an order

### 4. View Orders
- Go to the **Orders** tab
- See all orders with timestamps, customer names, and items
- Click **Export CSV** to download orders as CSV file

### 5. Dashboard Stats
- View total orders count
- View active customers count
- Check connection status (Online/Offline)
- Quick export button

## 📊 Menu

The default menu is:
- **1️⃣ Spinach Juice** - ₹60
- **2️⃣ Carrot Juice** - ₹40
- **3️⃣ Sprout bowl** - ₹30

To change the menu, edit the `menuItems` object in `backend/server.js`.

## 📋 Default Customers

The `backend/customers.json` includes sample customers:
```json
[
  { "phone": "919876543210", "name": "Raj Kumar" },
  { "phone": "919876543211", "name": "Priya Singh" },
  { "phone": "919876543212", "name": "Amit Patel" }
]
```

Replace these with your actual customer numbers.

## 🔌 API Endpoints

- **GET `/api/status`** - Get WhatsApp connection status and QR code
- **GET `/api/orders`** - Get all orders from database
- **GET `/api/orders/export`** - Download orders as CSV
- **GET `/api/menu`** - Get available menu items
- **GET `/api/customers`** - Get all registered customers
- **POST `/api/customers`** - Add new customer
  ```json
  {
    "phone": "919876543210",
    "name": "Customer Name"
  }
  ```

## 🔧 Configuration

Edit `backend/.env`:
```
PORT=3001
NODE_ENV=development
```

## 📦 Dependencies

### Backend
- Express.js - Web framework
- @whiskeysockets/baileys - WhatsApp API
- Socket.io - Real-time communication
- SQLite3 - Database
- node-cron - Scheduled jobs
- qrcode - QR code generation

### Frontend
- React - UI library
- Socket.io-client - Real-time updates
- Axios - HTTP requests
- Tailwind CSS - Styling
- DaisyUI - UI components

## 🐛 Troubleshooting

### WhatsApp QR Code Not Showing
- Make sure both backend and frontend are running
- Check if port 3001 is not in use
- Clear browser cache and refresh

### Orders Not Saving
- Check if `database.db` was created in the backend folder
- Ensure SQLite3 is properly installed
- Check console for error messages

### Menu Not Broadcasting at 9 AM
- The cron job uses system timezone
- Make sure backend is running continuously
- Check console logs for broadcast messages

### Connection Lost
- The app will auto-reconnect automatically
- If persistent, restart the backend server

## 📝 CSV Export Format

Exported CSV includes:
```
Timestamp,Name,Phone,Item,Status
2024-02-27T09:15:30.000Z,Raj Kumar,919876543210,Spinach Juice,pending
```

## 🎓 Learning Resources

- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
- [Express.js Guide](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [Socket.io Tutorial](https://socket.io/docs/)
- [Tailwind CSS](https://tailwindcss.com/)
- [DaisyUI Components](https://daisyui.com/)

## 📞 Support

For issues or questions:
1. Check the console logs (both terminal and browser)
2. Verify all ports are available
3. Ensure all npm packages are installed
4. Try restarting both backend and frontend servers

## 📄 License

Open source - Feel free to use and modify!

---

**Happy ordering! 🎉**
