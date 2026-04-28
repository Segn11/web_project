'use client';

import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function CartPage() {
  const { items, updateQuantity, removeFromCart, totalPrice } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 md:px-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-100">
          <ShoppingCart className="h-10 w-10 text-zinc-400" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Your cart is empty</h1>
        <p className="mt-2 text-zinc-500">Looks like you haven&apos;t added anything yet.</p>
        <Link href="/products" className="mt-8">
          <Button size="lg" className="rounded-full">Start Shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:px-6 lg:py-12">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Shopping Cart</h1>
      
      <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-12">
        {/* Cart Items */}
        <div className="lg:col-span-8">
          <div className="space-y-6">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-4 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:p-6">
                <Link href={`/products/${item.id}`} className="shrink-0">
                  <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-zinc-50 p-2">
                    <img src={item.image} alt={item.title} className="max-h-full max-w-full object-contain" />
                  </div>
                </Link>
                
                <div className="flex flex-1 flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <Link href={`/products/${item.id}`}>
                      <h3 className="font-medium text-zinc-900 line-clamp-2 hover:underline">{item.title}</h3>
                    </Link>
                    <p className="text-sm text-zinc-500 capitalize">{item.category}</p>
                    <p className="font-bold text-zinc-900">${item.price.toFixed(2)}</p>
                  </div>
                  
                  <div className="flex items-center justify-between sm:flex-col sm:items-end sm:gap-4">
                    <div className="flex items-center rounded-full border border-zinc-200 bg-white">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-l-full text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-r-full text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sm:hidden">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 rounded-2xl border bg-zinc-50 p-6">
            <h2 className="text-lg font-bold">Order Summary</h2>
            
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Subtotal</span>
                <span className="font-medium">${totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Shipping</span>
                <span className="font-medium text-green-600">Free</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Tax</span>
                <span className="font-medium">${(totalPrice * 0.08).toFixed(2)}</span>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold">Total</span>
                  <span className="text-xl font-bold">${(totalPrice * 1.08).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <Button 
              size="lg" 
              className="w-full rounded-full mt-8"
              onClick={() => {
                if (!user) {
                  toast.error('Please sign in to proceed to checkout');
                  router.push('/login');
                  return;
                }
                router.push('/checkout');
              }}
            >
              Proceed to Checkout
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Need to import ShoppingCart for the empty state
import { ShoppingCart } from 'lucide-react';
