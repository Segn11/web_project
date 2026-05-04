# Backend Service Guide

Django REST backend for the Gebiya Commerce Platform.

This service is responsible for authentication, authorization, catalog management, and all persistent commerce data in PostgreSQL.

## Stack

- Django 5
- Django REST Framework
- djangorestframework-simplejwt
- PostgreSQL via psycopg3
- dj-database-url + python-dotenv

## Responsibilities

- Register and authenticate users using JWT
- Enforce role-based access (admin-only catalog writes)
- Persist cart and wishlist state per authenticated user
- Create and manage orders with order items and addresses
- Expose API endpoints consumed by the Next.js frontend

## Project Structure

- config/: Django project configuration
- store/: Domain app (models, serializers, views, routes, permissions)
- store/management/commands/: Seed and utility commands

## Quick Start

1. Create and activate virtual environment.
2. Install dependencies:
   - pip install -r requirements.txt
3. Configure environment:
   - Copy .env.example to .env and set values
4. Apply schema:
   - python manage.py migrate
5. Seed catalog:
   - python manage.py seed_products
6. Create admin user:
   - python manage.py createsuperuser
7. Run API server:
   - python manage.py runserver 8000

## Environment Variables

- DATABASE_URL: PostgreSQL DSN
- DB_SSL_REQUIRE: True for managed Postgres/Supabase
- SECRET_KEY: Django secret key (use a strong value)
- DEBUG: True in local dev only
- ALLOWED_HOSTS: Comma-separated host allowlist
- CORS_ALLOWED_ORIGINS: Frontend origins allowed to call API

## Authentication Model

- User storage: Django auth table (public.auth_user)
- Token model: JWT access + refresh
- Endpoints:
  - /api/auth/signup/
  - /api/auth/login/
  - /api/auth/refresh/
  - /api/auth/me/

Important:

- Supabase Auth dashboard (auth.users) is a different auth system.
- This backend uses Django auth users in public.auth_user.

## Authorization Rules

- Public read: active products and categories
- Admin write: categories, products, product images
- Authenticated user scope:
  - cart/cart-items limited to owner
  - wishlist/wishlist-items limited to owner
  - orders limited to owner (admins can inspect all)

## API Endpoints

Health:
- /api/health/

Auth:
- /api/auth/signup/
- /api/auth/login/
- /api/auth/refresh/
- /api/auth/me/

Catalog:
- /api/categories/
- /api/products/
- /api/product-images/

Commerce:
- /api/addresses/
- /api/carts/
- /api/cart-items/
- /api/wishlists/
- /api/wishlist-items/
- /api/orders/
- /api/order-items/
- /api/payments/
- /api/reviews/

Chat History:
- /api/chat/sessions/
- /api/chat/sessions/{session_id}/messages/
- /api/chat/sessions/{session_id}/append-exchange/

## Seed and Validation

Seed sample data:

- python manage.py seed_products

System checks:

- python manage.py check

## Database Schema

Detailed entity and relationship documentation is maintained in:

- DATABASE_SCHEMA.md
