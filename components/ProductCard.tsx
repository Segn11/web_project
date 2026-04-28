'use client';

import { Product } from '@/types';
import Link from 'next/link';
import { Star, ShoppingCart, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface ProductCardProps {
  product: Product;
}

const PRODUCT_IMAGE_FALLBACK = 'https://picsum.photos/seed/product/800/800';

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();
  const router = useRouter();
  
  const isWished = isInWishlist(product.id);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border bg-white p-4 transition-all hover:shadow-lg">
      <button
        onClick={(e) => {
          e.preventDefault();
          if (!user) {
            toast.error('Please sign in to add to wishlist');
            router.push('/login');
            return;
          }
          toggleWishlist(product);
        }}
        className="absolute right-3 top-3 z-10 rounded-full bg-white/80 p-2 text-zinc-900 backdrop-blur-md transition-all hover:bg-white hover:scale-110"
      >
        <Heart className={`h-4 w-4 ${isWished ? 'fill-red-500 text-red-500' : ''}`} />
      </button>
      <Link href={`/products/${product.id}`} className="relative aspect-square overflow-hidden rounded-xl bg-zinc-50 p-6">
        <img
          src={product.image}
          alt={product.title}
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
          onError={(event) => {
            const target = event.currentTarget;
            target.onerror = null;
            target.src = PRODUCT_IMAGE_FALLBACK;
          }}
        />
        <Badge className="absolute left-3 top-3 capitalize" variant="secondary">
          {product.category}
        </Badge>
      </Link>
      
      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex items-center gap-1 text-sm text-yellow-500">
          <Star className="h-4 w-4 fill-current" />
          <span className="font-medium text-zinc-700">{product.rating.rate}</span>
          <span className="text-zinc-400">({product.rating.count})</span>
        </div>
        
        <Link href={`/products/${product.id}`}>
          <h3 className="mt-2 line-clamp-2 text-sm font-medium text-zinc-900 group-hover:underline">
            {product.title}
          </h3>
        </Link>
        
        <div className="mt-auto pt-4 flex items-center justify-between">
          <span className="text-lg font-bold text-zinc-900">${product.price.toFixed(2)}</span>
          <Button 
            size="icon" 
            variant="outline" 
            className="h-8 w-8 rounded-full"
            onClick={(e) => {
              e.preventDefault();
              if (!user) {
                toast.error('Please sign in to add items to your cart');
                router.push('/login');
                return;
              }
              addToCart(product);
            }}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border bg-white p-4">
      <div className="aspect-square rounded-xl bg-zinc-100 animate-pulse" />
      <div className="mt-4 space-y-3">
        <div className="h-4 w-1/4 rounded bg-zinc-100 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-zinc-100 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-zinc-100 animate-pulse" />
        </div>
        <div className="pt-4 flex items-center justify-between">
          <div className="h-6 w-1/3 rounded bg-zinc-100 animate-pulse" />
          <div className="h-8 w-8 rounded-full bg-zinc-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
