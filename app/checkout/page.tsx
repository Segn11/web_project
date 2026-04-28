'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { CheckCircle2 } from 'lucide-react';
import { createOrder } from '@/lib/api';

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!user && !isSuccess) {
      toast.error('Please sign in to access checkout');
      router.push('/login');
      return;
    }
    if (items.length === 0 && !isSuccess) {
      router.push('/cart');
    }
  }, [items.length, isSuccess, router, user]);

  if (!user || (items.length === 0 && !isSuccess)) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const form = document.getElementById('checkout-form') as HTMLFormElement | null;
    const formData = form ? new FormData(form) : null;

    const address = {
      full_name: `${String(formData?.get('first_name') || '')} ${String(formData?.get('last_name') || '')}`.trim(),
      phone: String(formData?.get('phone') || '0000000000'),
      line1: String(formData?.get('line1') || ''),
      line2: String(formData?.get('line2') || ''),
      city: String(formData?.get('city') || ''),
      state: String(formData?.get('state') || ''),
      postal_code: String(formData?.get('postal_code') || ''),
      country: String(formData?.get('country') || 'USA'),
      is_default: true,
    };

    createOrder({
      address,
      items: items.map((item) => ({ product: item.id, quantity: item.quantity })),
      shipping_fee: 0,
    })
      .then(() => {
        setIsSuccess(true);
        clearCart();
        toast.success('Order placed successfully!');
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to place order');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  if (isSuccess) {
    return (
      <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 text-center md:px-6">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Order Confirmed!</h1>
        <p className="mt-2 text-zinc-500">Thank you for your purchase. We&apos;ll email you the receipt.</p>
        <Button onClick={() => router.push('/products')} size="lg" className="mt-8 rounded-full">
          Continue Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:px-6 lg:py-12">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Checkout</h1>
      
      <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <form id="checkout-form" onSubmit={handleSubmit} className="space-y-8">
            {/* Contact Info */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Contact Information</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">First Name</label>
                    <Input name="first_name" required defaultValue={user?.name?.split(' ')[0] || ''} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Last Name</label>
                    <Input name="last_name" required defaultValue={user?.name?.split(' ')[1] || ''} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Email Address</label>
                    <Input name="email" type="email" required defaultValue={user?.email || ''} />
                </div>
              </div>
            </div>

            {/* Shipping Info */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Shipping Address</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Street Address</label>
                  <Input name="line1" required />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">City</label>
                    <Input name="city" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">ZIP Code</label>
                    <Input name="postal_code" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">State</label>
                  <Input name="state" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Country</label>
                  <Input name="country" defaultValue="USA" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input name="phone" required />
                </div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Payment Details</h2>
              <div className="space-y-4 rounded-xl border p-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Card Number</label>
                  <Input required placeholder="0000 0000 0000 0000" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Expiry Date</label>
                    <Input required placeholder="MM/YY" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">CVC</label>
                    <Input required placeholder="123" type="password" maxLength={4} />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-5">
          <div className="sticky top-24 rounded-2xl border bg-zinc-50 p-6">
            <h2 className="text-lg font-bold">Order Summary</h2>
            
            <div className="mt-6 space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {items.map(item => (
                <div key={item.id} className="flex gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-white p-1 border">
                    <img src={item.image} alt={item.title} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="flex flex-1 flex-col justify-center">
                    <h4 className="text-sm font-medium line-clamp-1">{item.title}</h4>
                    <p className="text-xs text-zinc-500">Qty: {item.quantity}</p>
                  </div>
                  <div className="flex items-center">
                    <p className="text-sm font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-4 border-t pt-6">
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
              type="submit" 
              form="checkout-form" 
              size="lg" 
              className="mt-8 w-full rounded-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing...' : `Pay ${(totalPrice * 1.08).toFixed(2)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
