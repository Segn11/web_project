'use client';

import { useEffect, useState } from 'react';
import { Product } from '@/types';
import { getProducts } from '@/lib/api';
import { getRecommendations } from '@/lib/recommendations';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { items: cartItems } = useCart();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allProducts = await getProducts();
        setProducts(allProducts);
        // Simulate AI recommendations based on cart and history
        setRecommendations(getRecommendations(allProducts, cartItems));
      } catch (error) {
        console.error('Failed to fetch products', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [cartItems]);

  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-30 mix-blend-overlay" />
        <div className="container relative mx-auto flex min-h-[600px] flex-col items-center justify-center px-4 text-center md:px-6">
          <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
            Elevate Your <br className="hidden sm:block" /> Everyday Style
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-300 sm:text-xl">
            Discover our curated collection of premium electronics, jewelry, and clothing. Designed for the modern lifestyle.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link href="/products">
              <Button size="lg" className="h-14 w-full rounded-full bg-white px-8 text-base text-zinc-950 hover:bg-zinc-100 sm:w-auto">
                Shop Collection
              </Button>
            </Link>
            <Link href="/products?category=electronics">
              <Button size="lg" variant="outline" className="h-14 w-full rounded-full border-zinc-700 bg-zinc-900/50 px-8 text-base backdrop-blur-md hover:bg-zinc-800 sm:w-auto">
                Explore Electronics
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* AI Recommendations */}
      <section className="container mx-auto px-4 md:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-yellow-500" />
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Recommended for You</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : recommendations.map(product => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      {/* Featured Categories */}
      <section className="container mx-auto px-4 md:px-6">
        <h2 className="mb-8 text-2xl font-bold tracking-tight md:text-3xl">Shop by Category</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { name: 'Electronics', image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=800&auto=format&fit=crop', link: '/products?category=electronics' },
            { name: 'Jewelry', image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=800&auto=format&fit=crop', link: '/products?category=jewelry' },
            { name: "Men's Clothing", image: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?q=80&w=800&auto=format&fit=crop', link: '/products?category=clothing' },
          ].map((category) => (
            <Link key={category.name} href={category.link} className="group relative h-80 overflow-hidden rounded-3xl">
              <div className="absolute inset-0 bg-zinc-900/20 transition-colors group-hover:bg-zinc-900/40 z-10" />
              <img src={category.image} alt={category.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center text-white">
                <h3 className="text-3xl font-bold tracking-tight">{category.name}</h3>
                <span className="mt-4 flex items-center gap-2 text-sm font-medium opacity-0 transition-all group-hover:opacity-100 group-hover:translate-y-0 translate-y-4">
                  Explore <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending Products */}
      <section className="container mx-auto px-4 md:px-6">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Trending Now</h2>
          <Link href="/products" className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : products.slice(0, 8).map(product => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>
    </div>
  );
}
