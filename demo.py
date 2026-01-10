"""
Quick Start Guide for Industrial Recommendation System
Run this file to understand the system capabilities
"""

from src.engine import IndustrialEngine

def demo():
    print("="*80)
    print(" INDUSTRIAL PRODUCT RECOMMENDATION SYSTEM - QUICK DEMO")
    print("="*80)
    
    # Load engine
    engine = IndustrialEngine('data/final_structured_products.csv')
    
    # Example 1: Fastener Ecosystem
    print("\n" + "="*80)
    print("EXAMPLE 1: Fastener Ecosystem (Bolt → Nut + Washer)")
    print("="*80)
    product = "M 20 X 100 HEX BOLT M S"
    print(f"\nSelected: {product}")
    print("\nRecommendations:")
    
    recs = engine.get_recommendations(product, top_n=3, method='hybrid')
    for i, (idx, row) in enumerate(recs.iterrows(), 1):
        print(f"\n{i}. {row['raw_description']}")
        print(f"   ├─ Category: {row['category']}")
        print(f"   ├─ Sub-Category: {row['sub_cat']}")
        print(f"   ├─ Dimension: {row['dimension']}")
        print(f"   └─ Match Score: {row['score']:.1f}/200")
    
    # Example 2: Packaging Ecosystem
    print("\n\n" + "="*80)
    print("EXAMPLE 2: Packaging Ecosystem (Strap → Buckle)")
    print("="*80)
    product = "POLYESTER CORDED STRAP 16 MM WIDTH (FOR PACKING) Roll of 850 mtr and One Box Consist of 2 rolls"
    print(f"\nSelected: {product[:60]}...")
    print("\nRecommendations:")
    
    recs = engine.get_recommendations(product, top_n=3, method='hybrid')
    for i, (idx, row) in enumerate(recs.iterrows(), 1):
        print(f"\n{i}. {row['raw_description']}")
        print(f"   ├─ Category: {row['category']}")
        print(f"   ├─ Sub-Category: {row['sub_cat']}")
        print(f"   ├─ Dimension: {row['dimension']}")
        print(f"   └─ Match Score: {row['score']:.1f}/200")
    
    # Example 3: Search Functionality
    print("\n\n" + "="*80)
    print("EXAMPLE 3: Product Search")
    print("="*80)
    query = "3M"
    print(f"\nSearching for: '{query}'")
    
    results = engine.search_products(query, top_n=5)
    print(f"\nFound {len(results)} products:")
    for i, (idx, row) in enumerate(results.iterrows(), 1):
        print(f"\n{i}. {row['raw_description'][:60]}...")
        print(f"   Brand: {row['brand']} | Category: {row['category']}")
    
    # Example 4: Compare Algorithms
    print("\n\n" + "="*80)
    print("EXAMPLE 4: Algorithm Comparison")
    print("="*80)
    product = "M 20 NYLOCK NUT"
    print(f"\nProduct: {product}")
    
    methods = ['hybrid', 'rule_based', 'content_based']
    for method in methods:
        print(f"\n--- {method.upper().replace('_', ' ')} ---")
        recs = engine.get_recommendations(product, top_n=3, method=method)
        for i, (idx, row) in enumerate(recs.iterrows(), 1):
            print(f"{i}. {row['raw_description'][:50]:<50} Score: {row['score']:.1f}")
    
    # Statistics
    print("\n\n" + "="*80)
    print("DATASET STATISTICS")
    print("="*80)
    stats = engine.get_stats()
    print(f"\nTotal Products: {stats['total_products']}")
    print(f"Unique Items: {stats['unique_products']}")
    print(f"\nTop 5 Categories:")
    for cat, count in list(stats['categories'].items())[:5]:
        print(f"  • {cat}: {count} products")
    
    print(f"\nTop 5 Brands:")
    for brand, count in list(stats['top_brands'].items())[:5]:
        print(f"  • {brand}: {count} products")
    
    print("\n" + "="*80)
    print("✅ DEMO COMPLETE!")
    print("\n💡 Next Steps:")
    print("   1. Run 'streamlit run app.py' for the web interface")
    print("   2. Run 'python main.py' for CLI with more examples")
    print("   3. Check README.md for full documentation")
    print("="*80 + "\n")

if __name__ == "__main__":
    demo()
