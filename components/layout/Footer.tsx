import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="border-t bg-zinc-50 py-12">
      <div className="container mx-auto grid grid-cols-1 gap-8 px-4 md:grid-cols-4 md:px-6">
        <div>
          <div className="flex items-center gap-2">
            <Image
              src="/images/gebiya.png"
              alt="Gebiya logo"
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="text-lg font-bold tracking-tight">Gebiya</span>
          </div>
          <p className="mt-4 text-sm text-zinc-500">
            A modern e-commerce experience built with React, Tailwind CSS, and Next.js.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider">Shop</h3>
          <ul className="mt-4 space-y-2 text-sm text-zinc-500">
            <li><Link href="/products" className="hover:text-zinc-900">All Products</Link></li>
            <li><Link href="/products?category=electronics" className="hover:text-zinc-900">Electronics</Link></li>
            <li><Link href="/products?category=jewelry" className="hover:text-zinc-900">Jewelry</Link></li>
            <li><Link href="/products?category=men's clothing" className="hover:text-zinc-900">Men&apos;s Clothing</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider">Support</h3>
          <ul className="mt-4 space-y-2 text-sm text-zinc-500">
            <li><a href="#" className="hover:text-zinc-900">FAQ</a></li>
            <li><a href="#" className="hover:text-zinc-900">Shipping & Returns</a></li>
            <li><a href="#" className="hover:text-zinc-900">Contact Us</a></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider">Legal</h3>
          <ul className="mt-4 space-y-2 text-sm text-zinc-500">
            <li><a href="#" className="hover:text-zinc-900">Privacy Policy</a></li>
            <li><a href="#" className="hover:text-zinc-900">Terms of Service</a></li>
          </ul>
        </div>
      </div>
      <div className="container mx-auto mt-12 border-t px-4 pt-8 md:px-6">
        <p className="text-center text-sm text-zinc-500">
          © {new Date().getFullYear()} Gebiya. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
