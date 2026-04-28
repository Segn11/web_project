from django.db import transaction
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ObjectDoesNotExist

from .models import (
    Address,
    Cart,
    CartItem,
    ChatMessage,
    ChatSession,
    Category,
    Order,
    OrderItem,
    Payment,
    Product,
    ProductImage,
    Review,
    Wishlist,
    WishlistItem,
)
from .permissions import IsAdminOrReadOnly
from .serializers import (
    AddressSerializer,
    ChatAppendExchangeSerializer,
    ChatMessageCreateSerializer,
    ChatMessageSerializer,
    ChatSessionCreateSerializer,
    ChatSessionSerializer,
    CartItemSerializer,
    CartSerializer,
    CategorySerializer,
    CheckoutSerializer,
    OrderItemSerializer,
    OrderSerializer,
    PaymentSerializer,
    PaymentSuccessSerializer,
    ProductImageSerializer,
    ProductSerializer,
    ReviewSerializer,
    WishlistItemSerializer,
    WishlistSerializer,
)
from .services import StockError, confirm_payment_and_deduct_stock


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related('category').prefetch_related('images').all()
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.is_authenticated and self.request.user.is_staff:
            return queryset
        return queryset.filter(is_active=True)


class ProductImageViewSet(viewsets.ModelViewSet):
    queryset = ProductImage.objects.select_related('product').all()
    serializer_class = ProductImageSerializer
    permission_classes = [IsAdminOrReadOnly]


class AddressViewSet(viewsets.ModelViewSet):
    queryset = Address.objects.select_related('user').all()
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]


class CartViewSet(viewsets.ModelViewSet):
    queryset = Cart.objects.select_related('user').prefetch_related('items').all()
    serializer_class = CartSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return super().get_queryset()
        return super().get_queryset().filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CartItemViewSet(viewsets.ModelViewSet):
    queryset = CartItem.objects.select_related('cart', 'product').all()
    serializer_class = CartItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return super().get_queryset()
        return super().get_queryset().filter(cart__user=user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cart, _ = Cart.objects.get_or_create(user=request.user)
        product = serializer.validated_data['product']
        quantity = serializer.validated_data.get('quantity', 1)

        item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={'quantity': quantity},
        )
        if not created:
            item.quantity += quantity
            item.save(update_fields=['quantity'])

        output = CartItemSerializer(item, context={'request': request})
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        if serializer.instance.cart.user_id != self.request.user.id and not self.request.user.is_staff:
            raise PermissionDenied('You cannot modify another user\'s cart item.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.cart.user_id != self.request.user.id and not self.request.user.is_staff:
            raise PermissionDenied('You cannot remove another user\'s cart item.')
        instance.delete()


class WishlistViewSet(viewsets.ModelViewSet):
    queryset = Wishlist.objects.select_related('user').prefetch_related('items').all()
    serializer_class = WishlistSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return super().get_queryset()
        return super().get_queryset().filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class WishlistItemViewSet(viewsets.ModelViewSet):
    queryset = WishlistItem.objects.select_related('wishlist', 'product').all()
    serializer_class = WishlistItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return super().get_queryset()
        return super().get_queryset().filter(wishlist__user=user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
        product = serializer.validated_data['product']
        item, _ = WishlistItem.objects.get_or_create(wishlist=wishlist, product=product)
        output = WishlistItemSerializer(item, context={'request': request})
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_destroy(self, instance):
        if instance.wishlist.user_id != self.request.user.id and not self.request.user.is_staff:
            raise PermissionDenied('You cannot remove another user\'s wishlist item.')
        instance.delete()


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related('user', 'address').prefetch_related('items').all()
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return super().get_queryset()
        return super().get_queryset().filter(user=user)

    def get_serializer_class(self):
        if self.action == 'create':
            return CheckoutSerializer
        return OrderSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        output = OrderSerializer(order, context={'request': request})
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)


class OrderItemViewSet(viewsets.ModelViewSet):
    queryset = OrderItem.objects.select_related('order', 'product').all()
    serializer_class = OrderItemSerializer
    permission_classes = [permissions.IsAuthenticated]


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('order').all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='success')
    def success(self, request):
        serializer = PaymentSuccessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        try:
            payment, deducted = confirm_payment_and_deduct_stock(
                acting_user=request.user,
                order_id=payload['order_id'],
                provider=payload['provider'],
                transaction_id=payload['transaction_id'],
                amount=payload.get('amount'),
            )
        except ObjectDoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        except StockError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        except serializers.ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        output = PaymentSerializer(payment, context={'request': request})
        return Response(
            {
                'payment': output.data,
                'stock_deducted': deducted,
            },
            status=status.HTTP_200_OK,
        )


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.select_related('user', 'product').all()
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class ChatSessionViewSet(viewsets.ModelViewSet):
    queryset = ChatSession.objects.prefetch_related('messages').all()
    serializer_class = ChatSessionSerializer
    lookup_field = 'public_id'
    permission_classes = [permissions.AllowAny]

    def _get_client_id(self):
        return self.request.headers.get('X-Client-Id', '').strip()[:64]

    def get_queryset(self):
        base = super().get_queryset()
        user = self.request.user

        if user.is_authenticated:
            return base.filter(user=user)

        client_id = self._get_client_id()
        if not client_id:
            return base.none()
        return base.filter(user__isnull=True, client_id=client_id)

    def get_serializer_class(self):
        if self.action == 'create':
            return ChatSessionCreateSerializer
        return ChatSessionSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user if request.user.is_authenticated else None
        client_id = '' if user else self._get_client_id()
        if not user and not client_id:
            return Response({'detail': 'X-Client-Id header is required for guest chat sessions.'}, status=status.HTTP_400_BAD_REQUEST)

        session = ChatSession.objects.create(
            user=user,
            client_id=client_id,
            title=serializer.validated_data.get('title', 'New conversation'),
            metadata=serializer.validated_data.get('metadata', {}),
        )
        output = ChatSessionSerializer(session, context={'request': request})
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, public_id=None):
        session = self.get_object()

        if request.method.lower() == 'get':
            data = ChatMessageSerializer(session.messages.all(), many=True)
            return Response(data.data)

        serializer = ChatMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = ChatMessage.objects.create(session=session, **serializer.validated_data)
        output = ChatMessageSerializer(message)
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='append-exchange')
    def append_exchange(self, request, public_id=None):
        session = self.get_object()
        serializer = ChatAppendExchangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        with transaction.atomic():
            ChatMessage.objects.create(
                session=session,
                role=ChatMessage.Role.USER,
                content=payload['user_message'],
                content_type='text/plain',
                metadata=payload.get('metadata', {}),
            )
            model_message = ChatMessage.objects.create(
                session=session,
                role=ChatMessage.Role.MODEL,
                content=payload['assistant_message'],
                content_type='text/plain',
                model_name=payload.get('model_name', ''),
                prompt_tokens=payload.get('prompt_tokens'),
                completion_tokens=payload.get('completion_tokens'),
                latency_ms=payload.get('latency_ms'),
                metadata=payload.get('metadata', {}),
            )

        return Response(
            {
                'session_id': str(session.public_id),
                'message_id': model_message.id,
            },
            status=status.HTTP_201_CREATED,
        )
