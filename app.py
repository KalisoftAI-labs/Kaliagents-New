import streamlit as st
import pandas as pd
from src.engine import IndustrialEngine
import plotly.express as px

# Page Styling
st.set_page_config(
    page_title="Industrial Product Recommendations",
    page_icon="🛠️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
    <style>
    .main-header {
        font-size: 3rem;
        font-weight: bold;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 1rem;
    }
    .metric-card {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 0.5rem;
        text-align: center;
    }
    </style>
""", unsafe_allow_html=True)

st.markdown('<p class="main-header">🛠️ Industrial Product Recommendation System</p>', unsafe_allow_html=True)

# Initialize Engine
@st.cache_resource
def load_system():
    engine = IndustrialEngine('data/final_structured_products.csv')
    return engine

recommender = load_system()
stats = recommender.get_stats()

# Sidebar
with st.sidebar:
    st.image("https://img.icons8.com/color/96/000000/factory.png", width=100)
    st.header("📊 Dataset Overview")
    st.metric("Total Products", stats['total_products'])
    st.metric("Unique Items", stats['unique_products'])
    st.metric("Categories", len(stats['categories']))
    
    st.markdown("---")
    st.subheader("Top Categories")
    for cat, count in list(stats['categories'].items())[:5]:
        st.write(f"**{cat}:** {count}")
    
    st.markdown("---")
    st.subheader("Recommendation Method")
    method = st.radio(
        "Choose Algorithm:",
        ["hybrid", "rule_based", "content_based"],
        help="""
        - **Hybrid**: Best of both worlds (Default)
        - **Rule-Based**: Industry logic & patterns
        - **Content-Based**: Text similarity (ML)
        """
    )
    
    st.markdown("---")
    st.subheader("Number of Recommendations")
    num_recs = st.slider("How many?", 3, 10, 5)

# Main Content
tab1, tab2, tab3 = st.tabs(["🔍 Get Recommendations", "📦 Product Search", "📈 Analytics"])

with tab1:
    st.markdown("### Select a Product to Get Recommendations")
    
    col1, col2 = st.columns([3, 1])
    
    with col1:
        selected_item = st.selectbox(
            "🔎 Search or Select from Catalog:",
            options=sorted(recommender.df['raw_description'].unique()),
            index=0,
            help="Type to search through all industrial products"
        )
    
    with col2:
        st.markdown("&nbsp;")  # spacing
        analyze_btn = st.button("🚀 Get Recommendations", use_container_width=True, type="primary")
    
    if selected_item and analyze_btn:
        st.markdown("---")
        
        # Show selected product details
        product_info = recommender.df[recommender.df['raw_description'] == selected_item].iloc[0]
        
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Category", product_info['category'])
        with col2:
            st.metric("Sub-Category", product_info['sub_cat'])
        with col3:
            st.metric("Brand", product_info['brand'])
        with col4:
            st.metric("Dimension", product_info['dimension'])
        
        st.markdown("---")
        
        # Get Recommendations
        with st.spinner("Analyzing product ecosystem..."):
            results = recommender.get_recommendations(
                selected_item, 
                top_n=num_recs, 
                method=method
            )
        
        st.success(f"✅ Found {len(results)} compatible products!")
        st.markdown("### 💡 Recommended Compatible Items")
        
        # Display as cards
        cols = st.columns(min(3, len(results)))
        for i, (idx, row) in enumerate(results.iterrows()):
            with cols[i % 3]:
                with st.container():
                    st.markdown(f"""
                    <div style='background-color: #f0f8ff; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid #1f77b4;'>
                        <div style='color: #1f77b4; font-size: 0.8rem; font-weight: bold; margin-bottom: 0.3rem;'>RECOMMENDATION #{i+1}</div>
                        <div style='font-size: 1rem; margin: 0.3rem 0; font-weight: bold; color: #000; line-height: 1.4;'>{row['raw_description']}</div>
                        <div style='font-size: 0.75rem; color: #666; margin-top: 0.5rem; line-height: 1.5;'>
                            <strong>Category:</strong> {row['category']}<br>
                            <strong>Sub-Category:</strong> {row['sub_cat']}<br>
                            <strong>Brand:</strong> {row['brand']} | <strong>Dimension:</strong> {row['dimension']}
                        </div>
                    </div>
                    """, unsafe_allow_html=True)
                    
                    # Match strength indicator
                    strength = min(row['score'] / 200, 1.0)
                    st.progress(strength)
                    st.caption(f"Match Score: {row['score']:.1f}/200")
        
        # Show detailed table
        st.markdown("---")
        st.markdown("### 📋 Detailed Recommendations Table")
        display_df = results[['raw_description', 'category', 'sub_cat', 'brand', 'dimension', 'score']].copy()
        display_df['score'] = display_df['score'].round(2)
        st.dataframe(display_df, use_container_width=True, hide_index=True)

with tab2:
    st.markdown("### 🔍 Search Products by Keywords")
    
    search_query = st.text_input(
        "Enter search term (product name, category, brand, etc.):",
        placeholder="e.g., bolt, 3M, tape, M20..."
    )
    
    if search_query:
        with st.spinner("Searching..."):
            search_results = recommender.search_products(search_query, top_n=20)
        
        if len(search_results) > 0:
            st.success(f"Found {len(search_results)} products matching '{search_query}'")
            
            # Display results
            for idx, row in search_results.iterrows():
                with st.expander(f"📦 {row['raw_description']}", expanded=False):
                    col1, col2, col3, col4 = st.columns(4)
                    with col1:
                        st.write(f"**Category:** {row['category']}")
                    with col2:
                        st.write(f"**Sub-Category:** {row['sub_cat']}")
                    with col3:
                        st.write(f"**Brand:** {row['brand']}")
                    with col4:
                        st.write(f"**Dimension:** {row['dimension']}")
        else:
            st.warning("No products found. Try a different search term.")

with tab3:
    st.markdown("### 📈 Product Catalog Analytics")
    
    col1, col2 = st.columns(2)
    
    with col1:
        # Category Distribution
        st.subheader("Distribution by Category")
        cat_df = pd.DataFrame(list(stats['categories'].items()), columns=['Category', 'Count'])
        fig = px.pie(cat_df, values='Count', names='Category', title='Product Categories')
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        # Top Sub-categories
        st.subheader("Top 10 Sub-Categories")
        subcat_df = pd.DataFrame(list(stats['subcategories'].items()), columns=['Sub-Category', 'Count'])
        fig = px.bar(subcat_df, x='Count', y='Sub-Category', orientation='h', title='Most Common Sub-Categories')
        st.plotly_chart(fig, use_container_width=True)
    
    # Top Brands
    if stats['top_brands']:
        st.subheader("Top Brands in Catalog")
        brand_df = pd.DataFrame(list(stats['top_brands'].items()), columns=['Brand', 'Count'])
        fig = px.bar(brand_df, x='Brand', y='Count', title='Most Popular Brands')
        st.plotly_chart(fig, use_container_width=True)

# Footer
st.markdown("---")
st.markdown("""
<div style='text-align: center; color: #666; font-size: 0.9rem;'>
    <p>🛠️ Industrial Product Recommendation System | Powered by ML & Rule-Based Logic</p>
    <p>Using hybrid recommendation approach for optimal results</p>
</div>
""", unsafe_allow_html=True)