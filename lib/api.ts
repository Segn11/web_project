import { Product } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000/api';
const ACCESS_TOKEN_KEY = 'auth-access-token';
const REFRESH_TOKEN_KEY = 'auth-refresh-token';
const PRODUCT_IMAGE_FALLBACK = 'https://picsum.photos/seed/product/800/800';

let refreshAccessTokenPromise: Promise<string | null> | null = null;

function emitSessionExpiredEvent() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('auth:session-expired'));
}

interface BackendCategory {
  id: number;
  name: string;
  slug: string;
}

interface BackendProductImage {
  id: number;
  image_url: string;
  is_primary: boolean;
}

interface BackendProduct {
  id: number;
  category: BackendCategory | number;
  name: string;
  slug: string;
  description: string;
  price: string;
  stock: number;
  is_active: boolean;
  images?: BackendProductImage[];
}

interface BackendProductListResponse {
  results: BackendProduct[];
}

interface BackendCategoryListResponse {
  results: BackendCategory[];
}

interface BackendCartItem {
  id: number;
  quantity: number;
  product: BackendProduct;
}

interface BackendWishlistItem {
  id: number;
  product: BackendProduct;
}

interface BackendListResponse<T> {
  results: T[];
}

interface ApiRequestOptions extends RequestInit {
  includeAuth?: boolean;
}

function normalizeImageInput(value: string): string {
  const raw = (value || '').trim();
  if (!raw) return raw;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('google.') && parsed.pathname === '/imgres') {
      return (parsed.searchParams.get('imgurl') || raw).trim();
    }
    if (host.includes('google.') && parsed.pathname === '/url') {
      return (parsed.searchParams.get('q') || raw).trim();
    }
    return raw;
  } catch {
    return raw;
  }
}

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  if (!refreshAccessTokenPromise) {
    refreshAccessTokenPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem('auth-user');
        emitSessionExpiredEvent();
        return null;
      }

      const payload = (await response.json()) as { access?: string };
      if (!payload?.access) {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        emitSessionExpiredEvent();
        return null;
      }

      localStorage.setItem(ACCESS_TOKEN_KEY, payload.access);
      return payload.access;
    })().finally(() => {
      refreshAccessTokenPromise = null;
    });
  }

  return refreshAccessTokenPromise;
}

async function requestJson<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  const { includeAuth = true, ...requestInit } = options || {};
  const sendRequest = async (accessTokenOverride?: string | null) => {
    const authHeader = includeAuth
      ? (accessTokenOverride
          ? { Authorization: `Bearer ${accessTokenOverride}` }
          : getAuthHeaders())
      : {};

    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...authHeader,
        ...(requestInit.headers || {}),
      },
      ...requestInit,
    });

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        const contentType = response.headers.get('content-type') || 'unknown';
        const snippet = text.slice(0, 120).replace(/\s+/g, ' ').trim();
        throw new Error(
          `Invalid API response from ${path}: expected JSON but received ${contentType}. Response starts with: ${snippet}`
        );
      }
    }

    return { response, payload };
  };

  let { response, payload } = await sendRequest();

  const tokenInvalid = response.status === 401
    && typeof payload === 'object'
    && payload !== null
    && (
      (payload as { code?: string }).code === 'token_not_valid'
      || String((payload as { detail?: string }).detail || '').toLowerCase().includes('token')
    );

  if (includeAuth && tokenInvalid) {
    const refreshedAccessToken = await refreshAccessToken();
    if (refreshedAccessToken) {
      ({ response, payload } = await sendRequest(refreshedAccessToken));
    }
  }

  if (!response.ok) {
    const message = typeof payload === 'string'
      ? payload
      : (payload as { detail?: string; message?: string } | null)?.detail
        || (payload as { detail?: string; message?: string } | null)?.message
        || 'Request failed';
    throw new Error(message);
  }

  return payload as T;
}

function resolveImage(product: BackendProduct): string {
  const primaryImage = product.images?.find((image) => image.is_primary) || product.images?.[0];
  const imageUrl = primaryImage?.image_url?.trim();
  if (!imageUrl) {
    return PRODUCT_IMAGE_FALLBACK;
  }

  if (imageUrl.includes('images.unsplash.com') && !imageUrl.includes('auto=format')) {
    const separator = imageUrl.includes('?') ? '&' : '?';
    return `${imageUrl}${separator}auto=format&fit=crop&q=80`;
  }

  return imageUrl;
}

function normalizeCategory(category: BackendProduct['category']): string {
  if (typeof category === 'number') {
    return String(category);
  }
  return category.slug || category.name;
}

function mapProduct(product: BackendProduct, categoryMap?: Map<number, string>): Product {
  let resolvedCategory = normalizeCategory(product.category);
  if (typeof product.category === 'number' && categoryMap?.has(product.category)) {
    resolvedCategory = categoryMap.get(product.category) || resolvedCategory;
  }

  return {
    id: product.id,
    title: product.name,
    price: Number(product.price),
    description: product.description,
    category: resolvedCategory,
    image: resolveImage(product),
    rating: { rate: 0, count: 0 },
  };
}

async function initProducts(): Promise<Product[]> {
  if (typeof window === 'undefined') return [];

  const [response, categoriesResponse] = await Promise.all([
    requestJson<BackendProductListResponse | BackendProduct[]>('/products/', { includeAuth: false }),
    requestJson<BackendCategoryListResponse | BackendCategory[]>('/categories/', { includeAuth: false }),
  ]);

  const categories = Array.isArray(categoriesResponse) ? categoriesResponse : categoriesResponse.results;
  const categoryMap = new Map<number, string>(categories.map((category) => [category.id, category.slug || category.name]));
  const products = Array.isArray(response) ? response : response.results;
  return products.map((product) => mapProduct(product, categoryMap));
}

export async function getProducts(): Promise<Product[]> {
  return await initProducts();
}

export async function getProduct(id: string | number): Promise<Product> {
  const product = await requestJson<BackendProduct>(`/products/${id}/`, { includeAuth: false });
  return mapProduct(product);
}

export async function getCategories(): Promise<string[]> {
  const products = await initProducts();
  const categories = new Set(products.map((p) => p.category));
  return Array.from(categories);
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  const products = await initProducts();
  return products.filter((p) => p.category === category);
}

// Admin functions
export async function addProduct(product: Omit<Product, 'id'>): Promise<Product> {
  const categoryResponse = await requestJson<BackendListResponse<{ id: number; slug: string; name: string }> | Array<{ id: number; slug: string; name: string }>>('/categories/');
  const categories = Array.isArray(categoryResponse) ? categoryResponse : categoryResponse.results;
  const category = categories.find((item) => item.slug === product.category || item.name === product.category)
    || categories[0];

  if (!category) {
    throw new Error('No category available to create a product');
  }

  const created = await requestJson<BackendProduct>('/products/', {
    method: 'POST',
    body: JSON.stringify({
      category: category.id,
      name: product.title,
      slug: product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      description: product.description,
      price: product.price,
      stock: 0,
      is_active: true,
      image_url: normalizeImageInput(product.image || ''),
    }),
  });

  const createdWithImages = await requestJson<BackendProduct>(`/products/${created.id}/`, { includeAuth: false });
  return mapProduct(createdWithImages, new Map([[category.id, category.slug || category.name]]));
}

export async function deleteProduct(id: number): Promise<void> {
  await requestJson<void>(`/products/${id}/`, {
    method: 'DELETE',
  });
}

export async function createOrder(payload: {
  address: {
    label?: string;
    full_name: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    is_default?: boolean;
  };
  items: Array<{ product: number; quantity: number }>;
  shipping_fee?: number;
}) {
  return requestJson('/orders/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getOrders() {
  return requestJson('/orders/');
}

function normalizeList<T>(response: BackendListResponse<T> | T[]): T[] {
  return Array.isArray(response) ? response : response.results;
}

export async function getCartItems(): Promise<Array<{ id: number; quantity: number; product: Product }>> {
  const response = await requestJson<BackendListResponse<BackendCartItem> | BackendCartItem[]>('/cart-items/');
  return normalizeList(response).map((item) => ({
    id: item.id,
    quantity: item.quantity,
    product: mapProduct(item.product),
  }));
}

export async function addCartItem(productId: number, quantity = 1) {
  const item = await requestJson<BackendCartItem>('/cart-items/', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId, quantity }),
  });
  return {
    id: item.id,
    quantity: item.quantity,
    product: mapProduct(item.product),
  };
}

export async function updateCartItem(itemId: number, quantity: number) {
  const item = await requestJson<BackendCartItem>(`/cart-items/${itemId}/`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
  return {
    id: item.id,
    quantity: item.quantity,
    product: mapProduct(item.product),
  };
}

export async function deleteCartItem(itemId: number) {
  await requestJson<void>(`/cart-items/${itemId}/`, { method: 'DELETE' });
}

export async function getWishlistItems(): Promise<Array<{ id: number; product: Product }>> {
  const response = await requestJson<BackendListResponse<BackendWishlistItem> | BackendWishlistItem[]>('/wishlist-items/');
  return normalizeList(response).map((item) => ({
    id: item.id,
    product: mapProduct(item.product),
  }));
}

export async function addWishlistItem(productId: number) {
  const item = await requestJson<BackendWishlistItem>('/wishlist-items/', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId }),
  });
  return {
    id: item.id,
    product: mapProduct(item.product),
  };
}

export async function deleteWishlistItem(itemId: number) {
  await requestJson<void>(`/wishlist-items/${itemId}/`, { method: 'DELETE' });
}

export async function requestPasswordReset(email: string): Promise<{ detail: string; debug?: { uid: string; token: string; reset_url: string } }> {
  return requestJson('/auth/password-reset/request/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(payload: { uid: string; token: string; new_password: string }): Promise<{ detail: string }> {
  return requestJson('/auth/password-reset/confirm/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
