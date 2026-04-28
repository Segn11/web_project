'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Product } from '@/types';
import { addWishlistItem, deleteWishlistItem, getWishlistItems } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface WishlistContextType {
  wishlistItems: Product[];
  toggleWishlist: (product: Product) => void;
  isInWishlist: (productId: number) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);
  const [wishlistItemIds, setWishlistItemIds] = useState<Record<number, number>>({});

  useEffect(() => {
    const loadWishlist = async () => {
      if (!user) {
        setWishlistItems([]);
        setWishlistItemIds({});
        return;
      }

      try {
        const backendItems = await getWishlistItems();
        setWishlistItems(backendItems.map((item) => item.product));
        const idMap: Record<number, number> = {};
        backendItems.forEach((item) => {
          idMap[item.product.id] = item.id;
        });
        setWishlistItemIds(idMap);
      } catch (error) {
        console.error('Failed to load wishlist', error);
      }
    };

    void loadWishlist();
  }, [user]);

  const toggleWishlist = (product: Product) => {
    if (!user) return;

    void (async () => {
      const existingId = wishlistItemIds[product.id];
      if (existingId) {
        try {
          await deleteWishlistItem(existingId);
          setWishlistItems((current) => current.filter((item) => item.id !== product.id));
          setWishlistItemIds((current) => {
            const copy = { ...current };
            delete copy[product.id];
            return copy;
          });
          toast.success('Removed from wishlist');
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to update wishlist');
        }
        return;
      }

      try {
        const created = await addWishlistItem(product.id);
        setWishlistItems((current) => {
          if (current.some((item) => item.id === product.id)) return current;
          return [...current, created.product];
        });
        setWishlistItemIds((current) => ({ ...current, [product.id]: created.id }));
        toast.success('Added to wishlist');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update wishlist');
      }
    })();
  };

  const isInWishlist = (productId: number) => {
    return wishlistItems.some((item) => item.id === productId);
  };

  return (
    <WishlistContext.Provider value={{ wishlistItems, toggleWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
