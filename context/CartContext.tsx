'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { CartItem, Product } from '@/types';
import { addCartItem, deleteCartItem, getCartItems, updateCartItem } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface AuthCartItem extends CartItem {
  cartItemId?: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const [items, setItems] = useState<AuthCartItem[]>([]);

  useEffect(() => {
    const loadCart = async () => {
      if (isLoading) {
        return;
      }

      if (!user) {
        setItems([]);
        return;
      }

      try {
        const backendItems = await getCartItems();
        setItems(
          backendItems.map((item) => ({
            ...item.product,
            quantity: item.quantity,
            cartItemId: item.id,
          }))
        );
      } catch (error) {
        console.error('Failed to load cart', error);
      }
    };

    void loadCart();
  }, [isLoading, user]);

  const addToCart = (product: Product, quantity = 1) => {
    if (!user) return;

    void (async () => {
      try {
        const item = await addCartItem(product.id, quantity);
        setItems((currentItems) => {
          const existing = currentItems.find((current) => current.id === product.id);
          if (existing) {
            return currentItems.map((current) =>
              current.id === product.id
                ? { ...current, quantity: item.quantity, cartItemId: item.id }
                : current
            );
          }
          return [...currentItems, { ...item.product, quantity: item.quantity, cartItemId: item.id }];
        });
        toast.success(`Added ${product.title} to cart`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to add item to cart');
      }
    })();
  };

  const removeFromCart = (productId: number) => {
    if (!user) return;

    void (async () => {
      const existing = items.find((item) => item.id === productId);
      if (!existing?.cartItemId) return;

      try {
        await deleteCartItem(existing.cartItemId);
        setItems((currentItems) => currentItems.filter((item) => item.id !== productId));
        toast.success('Item removed from cart');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to remove item');
      }
    })();
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (!user) return;
    if (quantity < 1) {
      removeFromCart(productId);
      return;
    }

    void (async () => {
      const existing = items.find((item) => item.id === productId);
      if (!existing?.cartItemId) return;

      try {
        const updated = await updateCartItem(existing.cartItemId, quantity);
        setItems((currentItems) =>
          currentItems.map((item) =>
            item.id === productId
              ? { ...item, quantity: updated.quantity, cartItemId: updated.id }
              : item
          )
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update quantity');
      }
    })();
  };

  const clearCart = () => {
    if (!user) {
      setItems([]);
      return;
    }

    void (async () => {
      try {
        await Promise.all(items.filter((item) => item.cartItemId).map((item) => deleteCartItem(item.cartItemId!)));
        setItems([]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to clear cart');
      }
    })();
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
