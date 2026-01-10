from src.engine import IndustrialEngine
import sys

def main():
    print("="*80)
    print("🚀 Industrial Product Recommendation System")
    print("="*80)
    
    # Initialize engine
    engine = IndustrialEngine('data/final_structured_products.csv')
    stats = engine.get_stats()
    
    print(f"\n📊 Dataset Statistics:")
    print(f"   Total Products: {stats['total_products']}")
    print(f"   Unique Items: {stats['unique_products']}")
    print(f"   Categories: {len(stats['categories'])}")
    
    print(f"\n📦 Top Categories:")
    for cat, count in list(stats['categories'].items())[:5]:
        print(f"   - {cat}: {count}")
    
    # Example queries
    test_products = [
        "M 20 X 100 HEX BOLT M S",
        "POLYESTER CORDED STRAP 16 MM WIDTH (FOR PACKING) Roll of 850 mtr and One Box Consist of 2 rolls",
        "BUCKLES SIZE  16MM  (FOR PACKING)",
        "HAND SANITIZER 5 LTR JAR MAKE HAPPY HANDS/REVA MOQ 5 NO'S"
    ]
    
    # Allow user to select or use command line argument
    if len(sys.argv) > 1:
        query = ' '.join(sys.argv[1:])
    else:
        print(f"\n🔍 Example Products:")
        for i, prod in enumerate(test_products, 1):
            print(f"   {i}. {prod[:60]}...")
        
        choice = input(f"\nSelect a product (1-{len(test_products)}) or press Enter for default: ")
        try:
            idx = int(choice) - 1
            query = test_products[idx] if 0 <= idx < len(test_products) else test_products[0]
        except:
            query = test_products[0]
    
    print(f"\n{'='*80}")
    print(f"🔎 Analyzing: {query}")
    print(f"{'='*80}")
    
    # Test all three methods
    methods = ['hybrid', 'rule_based', 'content_based']
    
    for method in methods:
        print(f"\n📋 Method: {method.upper().replace('_', ' ')}")
        print("-" * 80)
        
        try:
            recs = engine.get_recommendations(query, top_n=5, method=method)
            
            for i, (idx, row) in enumerate(recs.iterrows(), 1):
                print(f"\n{i}. {row['raw_description'][:70]}")
                print(f"   Category: {row['category']} | Sub-Cat: {row['sub_cat']}")
                print(f"   Brand: {row['brand']} | Dimension: {row['dimension']}")
                print(f"   Match Score: {row['score']:.2f}")
        except Exception as e:
            print(f"   Error: {e}")
    
    print(f"\n{'='*80}")
    print("✅ Analysis Complete!")
    print("💡 Tip: Run 'streamlit run app.py' for the interactive web interface")
    print("="*80)

if __name__ == "__main__":
    main()