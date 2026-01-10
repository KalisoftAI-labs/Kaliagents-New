# Quick Start Guide

## 🚀 Getting Started in 3 Steps

### Step 1: Activate Virtual Environment

```bash
cd /Users/meetpatel/Desktop/Industrial_rec_system
source venv/bin/activate
```

### Step 2: Choose Your Interface

#### Option A: Web Interface (Recommended) 🌐

```bash
streamlit run app.py
```

Then open: http://localhost:8501

**Features:**

- Beautiful interactive dashboard
- Product search
- Visual analytics
- Multiple recommendation algorithms
- Real-time filtering

#### Option B: Command Line 💻

```bash
python main.py
```

Or test specific products:

```bash
python main.py "M 20 X 100 HEX BOLT M S"
```

#### Option C: Quick Demo 🎬

```bash
python demo.py
```

Shows all system capabilities with examples

## 📖 How to Use the Web Interface

### Tab 1: Get Recommendations

1. Select a product from the dropdown (or type to search)
2. Choose algorithm: Hybrid (best), Rule-Based, or Content-Based
3. Set number of recommendations (3-10)
4. Click "🚀 Get Recommendations"
5. View results as visual cards and detailed table

### Tab 2: Product Search

1. Enter search keywords (product name, brand, dimension, category)
2. Browse results
3. Expand any product to see details

### Tab 3: Analytics

- View category distribution
- See top sub-categories
- Analyze brand popularity
- Understand dataset composition

## 🎯 Recommendation Methods Explained

### Hybrid (Default) ⭐

- **Best overall performance**
- Combines industry knowledge (70%) + ML similarity (30%)
- Example: M20 bolt → M20 nut (dimension match) + related products (ML)

### Rule-Based 📏

- **Domain expertise driven**
- Uses industrial logic and compatibility rules
- Best for: Standard product ecosystems
- Example: Bolts always suggest matching nuts and washers

### Content-Based 🤖

- **Pure machine learning**
- Text similarity using TF-IDF
- Best for: Finding similar descriptions
- Example: "HEX BOLT M20" finds other hex bolts

## 💡 Example Use Cases

### 1. E-Commerce Cross-Selling

```
Customer adds: "M 20 X 100 HEX BOLT M S"
System suggests: M20 nuts, M20 washers, similar bolts
Result: Increased cart value
```

### 2. Inventory Planning

```
Ordering: "POLYESTER STRAP 16MM"
System reminds: Don't forget 16MM buckles!
Result: Complete stock of compatible items
```

### 3. Sales Support

```
Customer asks: "What works with this paint?"
System shows: Brushes, rollers, thinners, safety gear
Result: Better customer service
```

## 🔍 Tips for Best Results

1. **Use Hybrid method** for general recommendations
2. **Use Rule-Based** when you want strict compatibility
3. **Use Content-Based** for finding similar products by description
4. **Increase recommendation count** to see more options
5. **Use Product Search** to explore the catalog

## 📊 Understanding Scores

- **150-200**: Excellent match (same dimension + category)
- **100-149**: Good match (compatible ecosystem)
- **50-99**: Moderate match (related category)
- **0-49**: Low match (general similarity)

## 🛠️ Troubleshooting

### Virtual environment not activated?

```bash
source venv/bin/activate
```

### Missing packages?

```bash
pip install -r requirements.txt
```

### Port 8501 already in use?

```bash
streamlit run app.py --server.port 8502
```

### Want to reset everything?

```bash
deactivate
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 📈 Performance Tips

- First load takes 2-3 seconds (building TF-IDF matrix)
- Subsequent queries are instant (~50ms)
- System caches the engine for best performance
- Can handle 1000+ products easily

## 🎓 Next Steps

1. ✅ Run `streamlit run app.py` to see it live
2. 📝 Check `README.md` for detailed documentation
3. 🔧 Edit `src/engine.py` to customize rules
4. 🚀 Deploy to Streamlit Cloud for production use
5. 📊 Add your own product data

## 💼 Production Deployment

### Deploy to Streamlit Cloud (Free)

1. Push code to GitHub
2. Go to share.streamlit.io
3. Connect your repository
4. Your app goes live!

### Deploy to AWS/Azure

1. Use Docker container
2. Set up environment variables
3. Deploy to ECS/App Service
4. Add load balancer

## 🤝 Need Help?

- Check `README.md` for full documentation
- Run `python demo.py` to see examples
- Review `src/engine.py` for algorithm details
- Test with `python main.py` for quick checks

---

**Remember**: The system learns patterns from your data. The more you use it, the better you'll understand which algorithm works best for your specific use cases!
