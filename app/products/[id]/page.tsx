'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Product } from '@/types';
import { getProduct, getProducts } from '@/lib/api';
import { trackProductView, getSimilarProducts } from '@/lib/recommendations';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Minus, Plus, ShoppingCart, Truck, ShieldCheck, Heart } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import toast from 'react-hot-toast';

const PRODUCT_IMAGE_FALLBACK = 'https://picsum.photos/seed/product/800/800';

export default function ProductDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();
  
  const isWished = product ? isInWishlist(product.id) : false;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productData, allProducts] = await Promise.all([
          getProduct(id),
          getProducts()
        ]);

        setProduct(productData);
        if (productData) {
          trackProductView(productData);
          setSimilarProducts(getSimilarProducts(productData, allProducts));
        } else {
          setSimilarProducts([]);
        }
      } catch (error) {
        console.error('Failed to fetch product details', error);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 md:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="aspect-square rounded-2xl bg-zinc-100 animate-pulse" />
          <div className="space-y-6 pt-8">
            <div className="h-8 w-3/4 rounded bg-zinc-100 animate-pulse" />
            <div className="h-6 w-1/4 rounded bg-zinc-100 animate-pulse" />
            <div className="h-24 w-full rounded bg-zinc-100 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return <div className="p-8 text-center">Product not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 md:px-6">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {/* Product Image */}
        <div className="flex items-center justify-center rounded-3xl bg-zinc-50 p-12">
          <img
            src={product.image}
            alt={product.title}
            className="max-h-[500px] w-full object-contain"
            onError={(event) => {
              const target = event.currentTarget;
              target.onerror = null;
              target.src = PRODUCT_IMAGE_FALLBACK;
            }}
          />
        </div>

        {/* Product Info */}
        <div className="flex flex-col justify-center">
          <Badge className="w-fit capitalize" variant="secondary">
            {product.category}
          </Badge>
          
          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            {product.title}
          </h1>
          
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-1 text-yellow-500">
              <Star className="h-5 w-5 fill-current" />
              <span className="font-medium text-zinc-900">{product.rating.rate}</span>
            </div>
            <span className="text-sm text-zinc-500 underline">
              {product.rating.count} reviews
            </span>
          </div>
          
          <p className="mt-8 text-3xl font-bold text-zinc-900">
            ${product.price.toFixed(2)}
          </p>
          
          <p className="mt-6 text-base leading-relaxed text-zinc-600">
            {product.description}
          </p>

          <div className="mt-10 flex items-center gap-4">
            <div className="flex items-center rounded-full border border-zinc-200 bg-white">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-12 w-12 items-center justify-center rounded-l-full text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="flex h-12 w-12 items-center justify-center rounded-r-full text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            
            <Button
              size="lg"
              className="h-12 flex-1 rounded-full text-base"
              onClick={() => {
                if (!user) {
                  toast.error('Please sign in to add items to your cart');
                  router.push('/login');
                  return;
                }
                addToCart(product, quantity);
              }}
            >
              <ShoppingCart className="mr-2 h-5 w-5" />
              Add to Cart
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-12 w-12 rounded-full"
              onClick={() => {
                if (!user) {
                  toast.error('Please sign in to add to wishlist');
                  router.push('/login');
                  return;
                }
                toggleWishlist(product);
              }}
            >
              <Heart className={`h-5 w-5 ${isWished ? 'fill-red-500 text-red-500' : ''}`} />
            </Button>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 border-t pt-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
                <Truck className="h-5 w-5 text-zinc-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Free Shipping</p>
                <p className="text-xs text-zinc-500">On orders over $50</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
                <ShieldCheck className="h-5 w-5 text-zinc-600" />
              </div>
              <div>
                <p className="text-sm font-medium">2 Year Warranty</p>
                <p className="text-xs text-zinc-500">Full coverage</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Products */}
      {similarProducts.length > 0 && (
        <div className="mt-24 border-t pt-16">
          <h2 className="mb-8 text-2xl font-bold tracking-tight">Similar Products</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {similarProducts.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
