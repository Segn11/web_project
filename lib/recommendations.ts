import { Product } from '@/types';

// Simple AI simulation for recommendations based on user behavior
export const trackProductView = (product: Product) => {
  if (typeof window === 'undefined') return;
  
  // Track recently viewed
  const viewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
  const updatedViewed = [product.id, ...viewed.filter((id: number) => id !== product.id)].slice(0, 10);
  localStorage.setItem('recentlyViewed', JSON.stringify(updatedViewed));

  // Track category preferences
  const prefs = JSON.parse(localStorage.getItem('categoryPrefs') || '{}');
  prefs[product.category] = (prefs[product.category] || 0) + 1;
  localStorage.setItem('categoryPrefs', JSON.stringify(prefs));
};

export const getRecommendations = (allProducts: Product[], cartItems: Product[] = []): Product[] => {
  if (typeof window === 'undefined') return allProducts.slice(0, 4);

  const prefs = JSON.parse(localStorage.getItem('categoryPrefs') || '{}');
  const viewedIds = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
  
  // 1. If cart has items, recommend similar categories
  const cartCategories = [...new Set(cartItems.map(item => item.category))];
  
  // 2. Sort categories by preference score
  const topCategories = Object.entries(prefs)
    .sort((a: any, b: any) => b[1] - a[1])
    .map(entry => entry[0]);

  // Combine preferred categories with cart categories
  const targetCategories = [...new Set([...cartCategories, ...topCategories])];

  let recommendations = allProducts.filter(p => 
    targetCategories.includes(p.category) && !cartItems.find(c => c.id === p.id)
  );

  // If not enough recommendations, fallback to highly rated products
  if (recommendations.length < 4) {
    const highlyRated = allProducts
      .filter(p => p.rating.rate >= 4.0 && !recommendations.find(r => r.id === p.id))
      .sort((a, b) => b.rating.rate - a.rating.rate);
    recommendations = [...recommendations, ...highlyRated];
  }

  // Shuffle and return top 4
  return recommendations.sort(() => 0.5 - Math.random()).slice(0, 4);
};

export const getSimilarProducts = (product: Product, allProducts: Product[]): Product[] => {
  return allProducts
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 4);
};
