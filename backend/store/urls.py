from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .auth_views import (
    HealthCheckView,
    LoginView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    SignupView,
)
from .views import (
    AddressViewSet,
    CartItemViewSet,
    CartViewSet,
    ChatSessionViewSet,
    CategoryViewSet,
    OrderItemViewSet,
    OrderViewSet,
    PaymentViewSet,
    ProductImageViewSet,
    ProductViewSet,
    ReviewViewSet,
    WishlistItemViewSet,
    WishlistViewSet,
)

router = DefaultRouter()
router.register('categories', CategoryViewSet, basename='category')
router.register('chat/sessions', ChatSessionViewSet, basename='chat-session')
router.register('products', ProductViewSet, basename='product')
router.register('product-images', ProductImageViewSet, basename='product-image')
router.register('addresses', AddressViewSet, basename='address')
router.register('carts', CartViewSet, basename='cart')
router.register('cart-items', CartItemViewSet, basename='cart-item')
router.register('wishlists', WishlistViewSet, basename='wishlist')
router.register('wishlist-items', WishlistItemViewSet, basename='wishlist-item')
router.register('orders', OrderViewSet, basename='order')
router.register('order-items', OrderItemViewSet, basename='order-item')
router.register('payments', PaymentViewSet, basename='payment')
router.register('reviews', ReviewViewSet, basename='review')

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('auth/signup/', SignupView.as_view(), name='auth-signup'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', MeView.as_view(), name='auth-me'),
    path('auth/password-reset/request/', PasswordResetRequestView.as_view(), name='auth-password-reset-request'),
    path('auth/password-reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
    path('', include(router.urls)),
]
