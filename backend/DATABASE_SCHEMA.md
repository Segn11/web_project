# Database Schema Reference

PostgreSQL schema used by the Django backend (store app + Django auth).

## Scope

This schema supports:

- Authentication and user identity (Django auth)
- Product catalog and media
- Cart and wishlist persistence
- Checkout, orders, and payments
- Product reviews
- Persistent AI chatbot conversation history

## Core Tables

### Authentication

- public.auth_user
  - Django-managed users
  - Used by /api/auth/signup and /api/auth/login

### Catalog

- public.store_category
  - Category name and slug
- public.store_product
  - Product metadata, price, stock, active flag
- public.store_productimage
  - Product images with primary-image support

### Commerce

- public.store_address
  - User shipping/billing addresses
- public.store_cart
  - One cart per user
- public.store_cartitem
  - Product rows and quantities in cart
- public.store_wishlist
  - One wishlist per user
- public.store_wishlistitem
  - Product rows in wishlist
- public.store_order
  - Order header (status, subtotal, shipping, total)
- public.store_orderitem
  - Snapshot of purchased product name/price/quantity
- public.store_payment
  - Payment state per order

### Engagement

- public.store_review
  - User rating and comment on product

### Chat History

- public.store_chatsession
  - Session container with user or guest client ownership
  - Tracks status, message count, and last activity timestamp
- public.store_chatmessage
  - Durable message log with role, content, model metadata, and latency/token metrics

## Relationships

- Category 1 -> many Product
- Product 1 -> many ProductImage
- User 1 -> many Address
- User 1 -> 1 Cart
- Cart 1 -> many CartItem
- User 1 -> 1 Wishlist
- Wishlist 1 -> many WishlistItem
- User 1 -> many Order
- Address 1 -> many Order
- Order 1 -> many OrderItem
- Order 1 -> 1 Payment
- User many -> many Product (via Review)

## Constraints and Integrity Rules

- One default address per user (conditional unique constraint)
- One primary image per product (conditional unique constraint)
- Unique cart row per cart-product pair
- Unique wishlist row per wishlist-product pair
- Unique review per user-product pair
- Review rating must be between 1 and 5

## Indexing

- Product composite index on (is_active, price)
  - Supports listing and filtering on active catalog and pricing

## Ownership and Access Patterns

- Cart/cart items are user-scoped in API access
- Wishlist/wishlist items are user-scoped in API access
- Orders are user-scoped; admins can inspect all orders
- Catalog writes are admin-only; reads are public for active products

## Data Lifecycle Notes

- Signup creates records in public.auth_user
- Seed command creates baseline categories/products/images
- Checkout creates/updates address, then inserts order + order items
- Cart/wishlist changes persist as dedicated rows, not local session data

## Migration Source

- store/migrations/0001_initial.py
