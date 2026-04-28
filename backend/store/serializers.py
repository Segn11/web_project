from django.utils.text import slugify
from rest_framework import serializers
from django.conf import settings

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
from .services import build_stock_visibility, create_order_with_stock_validation


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = '__all__'

    def validate_image_url(self, value):
        return ProductImage.normalize_image_url(value)


class ProductSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    slug = serializers.CharField(required=False, allow_blank=True)
    image_url = serializers.CharField(required=False, allow_blank=True, write_only=True)
    in_stock = serializers.SerializerMethodField()
    stock_count = serializers.SerializerMethodField()
    low_stock = serializers.SerializerMethodField()
    stock_status = serializers.CharField(read_only=True)
    stock_label = serializers.CharField(read_only=True)

    class Meta:
        model = Product
        fields = '__all__'

    def _build_unique_slug(self, base_value: str) -> str:
        raw = (base_value or '').strip()
        slug_base = slugify(raw)[:250] or 'product'
        candidate = slug_base
        suffix = 1

        queryset = Product.objects.all()
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)

        while queryset.filter(slug=candidate).exists():
            suffix_str = f'-{suffix}'
            candidate = f'{slug_base[:250 - len(suffix_str)]}{suffix_str}'
            suffix += 1
        return candidate

    def _stock_visibility(self, obj: Product):
        expose_exact_stock = getattr(settings, 'EXPOSE_EXACT_STOCK_COUNT', True)
        return build_stock_visibility(obj, expose_exact_stock=expose_exact_stock)

    def get_in_stock(self, obj: Product) -> bool:
        return self._stock_visibility(obj).in_stock

    def get_stock_count(self, obj: Product):
        return self._stock_visibility(obj).stock_count

    def get_low_stock(self, obj: Product) -> bool:
        return self._stock_visibility(obj).low_stock

    def validate(self, attrs):
        name = attrs.get('name') or (self.instance.name if self.instance else '')
        provided_slug = attrs.get('slug')

        if provided_slug:
            attrs['slug'] = self._build_unique_slug(provided_slug)
        else:
            attrs['slug'] = self._build_unique_slug(name)

        image_url = attrs.get('image_url')
        if image_url:
            attrs['image_url'] = ProductImage.normalize_image_url(image_url)

        return attrs

    def create(self, validated_data):
        image_url = validated_data.pop('image_url', '').strip()
        product = super().create(validated_data)

        if image_url:
            ProductImage.objects.update_or_create(
                product=product,
                is_primary=True,
                defaults={'image_url': image_url},
            )

        return product

    def update(self, instance, validated_data):
        image_url = validated_data.pop('image_url', '').strip()
        product = super().update(instance, validated_data)

        if image_url:
            ProductImage.objects.update_or_create(
                product=product,
                is_primary=True,
                defaults={'image_url': image_url},
            )

        return product


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = '__all__'


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(source='product', queryset=Product.objects.all(), write_only=True)

    class Meta:
        model = CartItem
        fields = ['id', 'cart', 'product', 'product_id', 'quantity', 'created_at', 'updated_at']
        read_only_fields = ['cart']


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = '__all__'


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(source='product', queryset=Product.objects.all(), write_only=True)

    class Meta:
        model = WishlistItem
        fields = ['id', 'wishlist', 'product', 'product_id', 'created_at', 'updated_at']
        read_only_fields = ['wishlist']


class WishlistSerializer(serializers.ModelSerializer):
    items = WishlistItemSerializer(many=True, read_only=True)

    class Meta:
        model = Wishlist
        fields = '__all__'


class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'order', 'product', 'product_name', 'unit_price', 'quantity', 'created_at', 'updated_at']


class OrderItemCreateSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class CheckoutAddressSerializer(serializers.Serializer):
    label = serializers.CharField(required=False, allow_blank=True)
    full_name = serializers.CharField()
    phone = serializers.CharField()
    line1 = serializers.CharField()
    line2 = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField()
    state = serializers.CharField()
    postal_code = serializers.CharField()
    country = serializers.CharField()
    is_default = serializers.BooleanField(required=False, default=False)


class CheckoutSerializer(serializers.Serializer):
    address = CheckoutAddressSerializer()
    items = OrderItemCreateSerializer(many=True)
    shipping_fee = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError('At least one item is required.')
        return value

    def create(self, validated_data):
        request = self.context['request']
        user = request.user
        address_data = validated_data['address']
        items_data = validated_data['items']
        shipping_fee = validated_data.get('shipping_fee', 0)

        return create_order_with_stock_validation(
            user=user,
            address_data=address_data,
            items_data=items_data,
            shipping_fee=shipping_fee,
        )


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'


class PaymentSuccessSerializer(serializers.Serializer):
    order_id = serializers.IntegerField(min_value=1)
    provider = serializers.ChoiceField(choices=Payment.Provider.choices, default=Payment.Provider.CARD)
    transaction_id = serializers.CharField(max_length=120)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)


class OrderSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    payment = PaymentSerializer(read_only=True)

    class Meta:
        model = Order
        fields = '__all__'

    def get_items(self, obj):
        return [
            {
                'id': item.id,
                'order': item.order_id,
                'product': ProductSerializer(item.product).data,
                'product_name': item.product_name,
                'unit_price': item.unit_price,
                'quantity': item.quantity,
                'created_at': item.created_at,
                'updated_at': item.updated_at,
            }
            for item in obj.items.select_related('product').all()
        ]


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = '__all__'


class ChatMessageSerializer(serializers.ModelSerializer):
    session_id = serializers.UUIDField(source='session.public_id', read_only=True)

    class Meta:
        model = ChatMessage
        fields = [
            'id',
            'session_id',
            'role',
            'content',
            'content_type',
            'model_name',
            'prompt_tokens',
            'completion_tokens',
            'latency_ms',
            'metadata',
            'created_at',
            'updated_at',
        ]


class ChatSessionSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='public_id', read_only=True)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = [
            'id',
            'title',
            'status',
            'message_count',
            'last_message_at',
            'metadata',
            'last_message',
            'created_at',
            'updated_at',
        ]

    def get_last_message(self, obj):
        message = obj.messages.order_by('-created_at').first()
        if not message:
            return None
        return {
            'role': message.role,
            'content': message.content[:280],
            'created_at': message.created_at,
        }


class ChatSessionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatSession
        fields = ['title', 'metadata']


class ChatMessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['role', 'content', 'content_type', 'model_name', 'prompt_tokens', 'completion_tokens', 'latency_ms', 'metadata']


class ChatAppendExchangeSerializer(serializers.Serializer):
    user_message = serializers.CharField()
    assistant_message = serializers.CharField()
    model_name = serializers.CharField(required=False, allow_blank=True)
    prompt_tokens = serializers.IntegerField(required=False, min_value=0)
    completion_tokens = serializers.IntegerField(required=False, min_value=0)
    latency_ms = serializers.IntegerField(required=False, min_value=0)
    metadata = serializers.JSONField(required=False)
