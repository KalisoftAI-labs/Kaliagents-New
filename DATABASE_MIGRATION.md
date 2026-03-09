# 🔄 DATABASE MIGRATION GUIDE

## ⚠️ Important: Orders Table Structure Changed

The orders table schema has been updated from the old format to support multiple items per order.

### **Old Schema**
```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  item TEXT NOT NULL,           ← Single item only
  status TEXT DEFAULT 'pending'
)
```

### **New Schema**
```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  items TEXT NOT NULL,          ← JSON array of items
  total_price REAL NOT NULL,    ← Total amount
  status TEXT DEFAULT 'pending'
)
```

---

## 🔄 Migration Steps

### **OPTION 1: Fresh Start (Recommended)**
If you don't have important existing orders:

1. **Stop the backend**
   ```powershell
   # Close the running backend process or press Ctrl+C
   ```

2. **Delete old database**
   ```powershell
   Remove-Item c:\Swasth_order_agent\backend\database.db -Force
   ```

3. **Start backend again**
   ```powershell
   cd c:\Swasth_order_agent\backend
   node server.js
   ```

   The system will automatically create a new database with the correct schema.

---

### **OPTION 2: Preserve Existing Orders**
If you have important order history to keep:

1. **Backup CSV export first**
   - Go to dashboard → Orders tab
   - Click "Export Orders to CSV"
   - Save the file to a safe location

2. **Stop the backend**
   ```powershell
   # Close the running backend process
   ```

3. **Rename old database**
   ```powershell
   Rename-Item c:\Swasth_order_agent\backend\database.db -NewName database_old.db
   ```

4. **Start backend**
   ```powershell
   node server.js
   ```
   
   New database will be created automatically.

5. **Manually migrate important orders**
   You can add them back through the dashboard or re-import from CSV if needed.

---

## ✅ Verification

After migration, verify the new structure works:

1. **Check database created**
   ```powershell
   Test-Path c:\Swasth_order_agent\backend\database.db
   ```
   Should return: `True`

2. **Test ordering workflow**
   - Add a test customer through dashboard
   - Send test message from WhatsApp
   - Check if order appears in Orders tab with new format

3. **Verify columns**
   Orders should now show:
   - Items (multiple items, not just one)
   - Total (aggregate price)

---

## 🔧 If You Need to Manually Fix the Database

If migration is complicated, use SQLite directly:

1. **Open database with SQLite client**
   ```powershell
   # Using SQLite3 command line (if installed)
   cd c:\Swasth_order_agent\backend
   sqlite3 database.db
   ```

2. **Backup old table**
   ```sql
   CREATE TABLE orders_backup AS SELECT * FROM orders;
   ```

3. **Drop old table**
   ```sql
   DROP TABLE orders;
   ```

4. **Create new table**
   ```sql
   CREATE TABLE orders (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     timestamp TEXT NOT NULL,
     name TEXT NOT NULL,
     phone TEXT NOT NULL,
     items TEXT NOT NULL,
     total_price REAL NOT NULL,
     status TEXT DEFAULT 'pending'
   );
   ```

5. **Exit**
   ```sql
   .quit
   ```

---

## 📋 Sample Data Format

Once migrated, new orders will look like this in the database:

```
id: 1
timestamp: 2026-03-09T10:30:00.000Z
name: Raj Kumar
phone: 919876543210@s.whatsapp.net
items: [{"id":1,"name":"Amla juice","price":25,"category":"Juice","quantity":1,"lineTotal":25},{"id":2,"name":"Beetroot juice","price":25,"category":"Juice","quantity":2,"lineTotal":50}]
total_price: 75
status: pending
```

---

## ✨ Next Steps

1. ✅ Complete migration
2. ✅ Test the ordering workflow
3. ✅ Verify orders appear correctly
4. ✅ Check CSV export works
5. ✅ Monitor new orders coming through

---

**Migration Difficulty:** ⭐ Easy (just delete and restart)  
**Recommended Option:** Fresh Start (Option 1)  
**Time Required:** 2-3 minutes

If you need help, refer to the IMPLEMENTATION_GUIDE.md file.
