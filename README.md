# Gebiya E-Commerce

Gebiya E-Commerce is a polished full-stack commerce platform built with Next.js and Django REST Framework. It pairs a modern storefront with JWT-based authentication, structured commerce APIs, and a Gemini-powered shopping assistant to create a production-ready shopping experience for both customers and administrators.

## Overview

The project is designed as two coordinated layers:

- The frontend delivers the shopping experience with responsive product discovery, account flows, cart and wishlist management, and a conversational assistant.
- The backend provides authenticated REST APIs for catalog, commerce, and chat workflows.
- Django enforces permissions and business rules before persisting data.
- PostgreSQL is supported for production deployments, with SQLite available for local development.

## Key Features

- Modern storefront with product browsing, search, filtering, and product detail pages
- Cart, wishlist, checkout, and user profile flows
- JWT authentication with signup, login, token refresh, and user profile endpoints
- Admin-restricted catalog management and protected commerce actions
- Persistent storage for addresses, orders, reviews, wishlist data, and chat history
- Gemini-powered chatbot integration for guided shopping assistance

## Technology Stack

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| State Management | React Context for auth, cart, and wishlist state |
| Backend | Django 5, Django REST Framework, SimpleJWT |
| Database | PostgreSQL, with SQLite fallback for local development |
| Tooling | ESLint, TypeScript, PostgreSQL helpers, Django management commands |

## Project Structure

- `app/` - Next.js App Router pages and layouts
- `components/` - Shared UI and feature components
- `context/` - Auth, cart, and wishlist state providers
- `hooks/` - Reusable React hooks
- `lib/` - API helpers, utilities, recommendations, and history logic
- `backend/` - Django project, store app, migrations, and management commands
- `public/` - Static assets
- `types/` - Shared TypeScript types

## API Surface

Authentication:

- `/api/health/`
- `/api/auth/signup/`
- `/api/auth/login/`
- `/api/auth/refresh/`
- `/api/auth/me/`

Catalog:

- `/api/categories/`
- `/api/products/`
- `/api/product-images/`

Commerce:

- `/api/addresses/`
- `/api/carts/`
- `/api/cart-items/`
- `/api/wishlists/`
- `/api/wishlist-items/`
- `/api/orders/`
- `/api/order-items/`
- `/api/payments/`
- `/api/reviews/`

Chat:

- `/api/chat/sessions/`
- `/api/chat/sessions/{session_id}/messages/`
- `/api/chat/sessions/{session_id}/append-exchange/`

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL if you want to mirror the production database locally

### 1. Install Frontend Dependencies

```bash
npm install
```

### 2. Configure Frontend Environment

Create a `.env.local` file in the repository root:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
NEXT_PUBLIC_GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

### 3. Configure Backend Environment

Copy `backend/.env.example` to `backend/.env` and update the values for your environment.

If `DATABASE_URL` is omitted, the backend automatically falls back to SQLite for local development.

### 4. Install Backend Dependencies

```bash
pip install -r backend/requirements.txt
```

### 5. Apply Database Migrations

```bash
python backend/manage.py migrate
```

### 6. Seed Sample Data

```bash
python backend/manage.py seed_products
```

### 7. Create an Admin User

```bash
python backend/manage.py createsuperuser
```

### 8. Start the Backend

```bash
python backend/manage.py runserver 8000
```

### 9. Start the Frontend

```bash
npm run dev
```

The backend runs at `http://127.0.0.1:8000` and the frontend is typically available at `http://localhost:3001`.

## Environment Variables

Frontend:

- `NEXT_PUBLIC_API_BASE_URL` - Base URL for the Django API
- `NEXT_PUBLIC_GEMINI_API_KEY` - Gemini API key for the chatbot

Backend:

- `DATABASE_URL` - PostgreSQL connection string
- `DB_SSL_REQUIRE` - Enable SSL for managed PostgreSQL providers
- `SECRET_KEY` - Django secret key
- `DEBUG` - Use `True` only for local development
- `ALLOWED_HOSTS` - Comma-separated host allowlist
- `CORS_ALLOWED_ORIGINS` - Comma-separated list of approved frontend origins

## Data Rules

- One default address per user
- One primary image per product
- One cart item per cart-product pair
- One wishlist item per wishlist-product pair
- One review per user-product pair
- Review ratings constrained between 1 and 5

## Useful Commands

```bash
python backend/manage.py check
python backend/manage.py test
python backend/manage.py seed_products
```

## Deployment Notes

- Use production-grade secret values and host allowlists.
- Set `DEBUG=False` in production.
- Use a production ASGI/WSGI server instead of `runserver`.
- Ensure HTTPS and secure cookie/token handling in production environments.

## Additional Notes

- The backend uses Django auth users stored in the `public.auth_user` table.
- Supabase Auth is a separate system and is not used for this application’s login flow.
- Full schema documentation is available in `backend/DATABASE_SCHEMA.md`.

---

For backend-focused operational details, see `backend/README.md`.
