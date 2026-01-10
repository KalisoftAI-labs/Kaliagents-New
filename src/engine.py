import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re

class IndustrialEngine:
    def __init__(self, data_path):
        self.df = pd.read_csv(data_path)
        # Handle missing values to prevent logic errors
        self.df.fillna({'brand': 'Unknown', 'dimension': 'N/A', 
                        'sub_cat': 'Other', 'category': 'Miscellaneous'}, inplace=True)
        
        # Preprocess text for better matching
        self.df['processed_text'] = self.df.apply(self._preprocess_row, axis=1)
        
        # Build TF-IDF matrix for content-based filtering
        self.vectorizer = TfidfVectorizer(
            max_features=500,
            ngram_range=(1, 2),
            stop_words='english'
        )
        self.tfidf_matrix = self.vectorizer.fit_transform(self.df['processed_text'])
        
    def _preprocess_row(self, row):
        """Combine all features into searchable text"""
        text_parts = [
            str(row['raw_description']).lower(),
            str(row['category']).lower(),
            str(row['sub_cat']).lower(),
            str(row['brand']).lower() if row['brand'] != 'Unknown' else '',
            str(row['dimension']).lower() if row['dimension'] != 'N/A' else ''
        ]
        return ' '.join(text_parts)
    
    def _extract_size_number(self, dimension):
        """Extract numeric size from dimension (e.g., 'M20' -> 20, '12X100' -> 12)"""
        if dimension == 'N/A' or not dimension:
            return None
        match = re.search(r'(\d+)', str(dimension))
        return int(match.group(1)) if match else None

    def get_recommendations(self, product_name, top_n=5, method='hybrid'):
        """
        Get recommendations using specified method:
        - 'rule_based': Traditional rule-based scoring
        - 'content_based': TF-IDF similarity
        - 'hybrid': Combination of both (default)
        """
        target_idx = self.df[self.df['raw_description'] == product_name].index[0]
        target = self.df.iloc[target_idx]
        
        if method == 'content_based':
            return self._content_based_recommendations(target_idx, top_n)
        elif method == 'rule_based':
            return self._rule_based_recommendations(target, top_n)
        else:  # hybrid
            return self._hybrid_recommendations(target, target_idx, top_n)
    
    def _content_based_recommendations(self, target_idx, top_n=5):
        """Content-based filtering using TF-IDF similarity"""
        # Calculate cosine similarity
        similarities = cosine_similarity(
            self.tfidf_matrix[target_idx:target_idx+1],
            self.tfidf_matrix
        ).flatten()
        
        # Get top N similar items (excluding the item itself)
        similar_indices = similarities.argsort()[::-1][1:top_n+1]
        
        results = self.df.iloc[similar_indices].copy()
        results['score'] = similarities[similar_indices] * 100
        results['score'] = results['score'].round(2)
        
        return results

    def _rule_based_recommendations(self, target, top_n=5):
        """Enhanced rule-based recommendation system"""
        candidates = self.df[self.df['raw_description'] != target['raw_description']].copy()
        candidates['score'] = 0

        # --- BASE SCORING ---
        # Category match
        candidates.loc[candidates['category'] == target['category'], 'score'] += 25
        
        # Sub-category match (stronger signal)
        candidates.loc[candidates['sub_cat'] == target['sub_cat'], 'score'] += 40
        
        # Brand loyalty (if known brand)
        if target['brand'] != 'Unknown':
            candidates.loc[candidates['brand'] == target['brand'], 'score'] += 30
        
        # Exact dimension match
        if target['dimension'] != 'N/A':
            candidates.loc[candidates['dimension'] == target['dimension'], 'score'] += 50

        # --- CATEGORY-SPECIFIC ECOSYSTEMS ---
        cat = target['category']
        sub = target['sub_cat']
        dim = target['dimension']
        desc = target['raw_description'].upper()
        
        # 1. FASTENERS ECOSYSTEM (Bolts, Nuts, Washers, Anchors)
        if cat == 'Fasteners':
            size_num = self._extract_size_number(dim)
            
            # Cross-category recommendations (bolt -> nut, washer)
            if 'BOLT' in sub.upper():
                candidates.loc[candidates['sub_cat'].str.contains('Nut', case=False), 'score'] += 80
                candidates.loc[candidates['sub_cat'].str.contains('Washer', case=False), 'score'] += 70
            elif 'NUT' in sub.upper():
                candidates.loc[candidates['sub_cat'].str.contains('Bolt', case=False), 'score'] += 80
                candidates.loc[candidates['sub_cat'].str.contains('Washer', case=False), 'score'] += 70
            elif 'WASHER' in sub.upper():
                candidates.loc[candidates['sub_cat'].str.contains('Bolt', case=False), 'score'] += 70
                candidates.loc[candidates['sub_cat'].str.contains('Nut', case=False), 'score'] += 70
            
            # Dimension-based matching for fasteners
            if size_num:
                for idx, row in candidates.iterrows():
                    cand_size = self._extract_size_number(row['dimension'])
                    if cand_size == size_num:
                        candidates.at[idx, 'score'] += 100
        
        # 2. PACKAGING ECOSYSTEM
        elif cat == 'Packaging':
            # Straps need buckles
            if 'STRAP' in desc:
                candidates.loc[candidates['sub_cat'].str.contains('Buckle', case=False), 'score'] += 100
                # Match dimension for strap width
                candidates.loc[(candidates['dimension'] == dim) & 
                              (candidates['sub_cat'].str.contains('Buckle', case=False)), 'score'] += 50
            
            # Buckles need straps
            elif 'BUCKLE' in desc:
                candidates.loc[candidates['sub_cat'].str.contains('Strap', case=False), 'score'] += 100
                candidates.loc[(candidates['dimension'] == dim) & 
                              (candidates['sub_cat'].str.contains('Strap', case=False)), 'score'] += 50
            
            # Bags work with tapes
            elif 'BAG' in desc or 'POLY' in desc:
                candidates.loc[candidates['raw_description'].str.contains('TAPE|STRAP', case=False), 'score'] += 60
        
        # 3. CHEMICALS & PAINTS ECOSYSTEM
        elif cat == 'Chemicals & Paints':
            # Paint-related products
            if 'PAINT' in desc or 'COATING' in desc:
                candidates.loc[candidates['raw_description'].str.contains('ROLLER|BRUSH|THINNER|SOLVENT', case=False), 'score'] += 90
                # Safety items for chemical handling
                candidates.loc[candidates['category'] == 'Safety & Hygiene', 'score'] += 40
            
            # Oil/Grease need applicators
            if 'OIL' in desc or 'GREASE' in desc:
                candidates.loc[candidates['raw_description'].str.contains('FUNNEL|CAN|BRUSH', case=False), 'score'] += 70
        
        # 4. SAFETY & HYGIENE ECOSYSTEM
        elif cat == 'Safety & Hygiene':
            # Welding safety gear clustering
            if 'WELDING' in desc or 'HELMET' in desc:
                candidates.loc[candidates['raw_description'].str.contains('WELDING|GLOVE|APRON', case=False), 'score'] += 80
            
            # Ear protection with other PPE
            if 'EAR' in desc or 'MUFF' in desc or 'PLUG' in desc:
                candidates.loc[candidates['raw_description'].str.contains('MASK|GLOVE|GOGGLE', case=False), 'score'] += 60
            
            # Masks with sanitizers
            if 'MASK' in desc:
                candidates.loc[candidates['raw_description'].str.contains('SANITIZER|GLOVE', case=False), 'score'] += 70
        
        # 5. SERVICES (pair with relevant products)
        elif cat == 'Services':
            if 'CALIBRATION' in desc:
                candidates.loc[candidates['category'].isin(['Electronics & Automation', 'Miscellaneous']), 'score'] += 40
        
        # --- KEYWORD-BASED ASSOCIATIONS ---
        # 3M brand ecosystem
        if '3M' in target['brand'] or '3M' in desc:
            candidates.loc[candidates['brand'] == '3M', 'score'] += 50
        
        # HILTI brand ecosystem
        if 'HILTI' in target['brand'] or 'HILTI' in desc:
            candidates.loc[candidates['brand'] == 'HILTI', 'score'] += 50

        return candidates.sort_values(by='score', ascending=False).head(top_n)
    
    def _hybrid_recommendations(self, target, target_idx, top_n=5):
        """Hybrid approach: combine rule-based and content-based"""
        # Get rule-based scores
        rule_results = self._rule_based_recommendations(target, top_n=20)
        
        # Get content-based similarity scores
        similarities = cosine_similarity(
            self.tfidf_matrix[target_idx:target_idx+1],
            self.tfidf_matrix
        ).flatten()
        
        # Combine scores (70% rule-based, 30% content-based)
        hybrid_scores = []
        for idx, row in rule_results.iterrows():
            content_score = similarities[idx] * 100
            combined_score = (0.7 * row['score']) + (0.3 * content_score)
            hybrid_scores.append(combined_score)
        
        rule_results = rule_results.copy()
        rule_results['score'] = hybrid_scores
        
        return rule_results.sort_values(by='score', ascending=False).head(top_n)
    
    def search_products(self, query, top_n=10):
        """Search products by text query"""
        query_lower = query.lower()
        
        # Simple text matching
        mask = (
            self.df['raw_description'].str.lower().str.contains(query_lower, na=False) |
            self.df['category'].str.lower().str.contains(query_lower, na=False) |
            self.df['sub_cat'].str.lower().str.contains(query_lower, na=False) |
            self.df['brand'].str.lower().str.contains(query_lower, na=False)
        )
        
        results = self.df[mask].head(top_n)
        return results
    
    def get_stats(self):
        """Get dataset statistics"""
        stats = {
            'total_products': len(self.df),
            'unique_products': self.df['raw_description'].nunique(),
            'categories': self.df['category'].value_counts().to_dict(),
            'top_brands': self.df[self.df['brand'] != 'Unknown']['brand'].value_counts().head(10).to_dict(),
            'subcategories': self.df['sub_cat'].value_counts().head(10).to_dict()
        }
        return stats