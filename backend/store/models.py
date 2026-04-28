from django.conf import settings
from django.db import models
from django.utils import timezone
import uuid
from urllib.parse import parse_qs, urlparse


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Category(TimeStampedModel):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True)

    def __str__(self) -> str:
        return self.name


class Product(TimeStampedModel):
    category = models.ForeignKey(Category, related_name='products', on_delete=models.PROTECT)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=270, unique=True)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=['is_active', 'price'])]

    @property
    def is_in_stock(self) -> bool:
        return self.stock > 0

    @property
    def low_stock(self) -> bool:
        return 0 < self.stock < 5

    @property
    def stock_status(self) -> str:
        if self.stock <= 0:
            return 'out_of_stock'
        if self.low_stock:
            return 'low_stock'
        return 'in_stock'

    @property
    def stock_label(self) -> str:
        if self.stock <= 0:
            return 'Out of stock'
        if self.low_stock:
            return f'Only {self.stock} left'
        return 'In stock'

    def __str__(self) -> str:
        return self.name


class ProductImage(TimeStampedModel):
    product = models.ForeignKey(Product, related_name='images', on_delete=models.CASCADE)
    image_url = models.URLField(max_length=500)
    is_primary = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['product'],
                condition=models.Q(is_primary=True),
                name='unique_primary_image_per_product',
            )
        ]

    @staticmethod
    def normalize_image_url(value: str) -> str:
        url = (value or '').strip()
        if not url:
            return url

        try:
            parsed = urlparse(url)
        except ValueError:
            return url

        host = (parsed.netloc or '').lower()
        path = parsed.path or ''
        query = parse_qs(parsed.query or '')

        if 'google.' in host and path == '/imgres':
            return (query.get('imgurl', [''])[0] or url).strip()

        if 'google.' in host and path == '/url':
            return (query.get('q', [''])[0] or url).strip()

        return url

    def save(self, *args, **kwargs):
        self.image_url = self.normalize_image_url(self.image_url)
        super().save(*args, **kwargs)


class Address(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='addresses', on_delete=models.CASCADE)
    label = models.CharField(max_length=80, blank=True)
    full_name = models.CharField(max_length=160)
    phone = models.CharField(max_length=30)
    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=120)
    state = models.CharField(max_length=120)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=120)
    is_default = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user'],
                condition=models.Q(is_default=True),
                name='unique_default_address_per_user',
            )
        ]


class Cart(TimeStampedModel):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name='cart', on_delete=models.CASCADE)


class CartItem(TimeStampedModel):
    cart = models.ForeignKey(Cart, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name='cart_items', on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ('cart', 'product')


class Wishlist(TimeStampedModel):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name='wishlist', on_delete=models.CASCADE)


class WishlistItem(TimeStampedModel):
    wishlist = models.ForeignKey(Wishlist, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name='wishlist_items', on_delete=models.CASCADE)

    class Meta:
        unique_together = ('wishlist', 'product')


class Order(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PAID = 'paid', 'Paid'
        SHIPPED = 'shipped', 'Shipped'
        DELIVERED = 'delivered', 'Delivered'
        CANCELED = 'canceled', 'Canceled'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='orders', on_delete=models.PROTECT)
    address = models.ForeignKey(Address, related_name='orders', on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    shipping_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ['-created_at']


class OrderItem(TimeStampedModel):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name='order_items', on_delete=models.PROTECT)
    product_name = models.CharField(max_length=255)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()


class Payment(TimeStampedModel):
    class Provider(models.TextChoices):
        CARD = 'card', 'Card'
        CASH = 'cash', 'Cash'
        PAYPAL = 'paypal', 'PayPal'

    order = models.OneToOneField(Order, related_name='payment', on_delete=models.CASCADE)
    provider = models.CharField(max_length=20, choices=Provider.choices, default=Provider.CARD)
    transaction_id = models.CharField(max_length=120, unique=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_at = models.DateTimeField(null=True, blank=True)


class Review(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='reviews', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name='reviews', on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)

    class Meta:
        unique_together = ('user', 'product')
        constraints = [models.CheckConstraint(check=models.Q(rating__gte=1, rating__lte=5), name='rating_between_1_and_5')]


class ChatSession(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        ARCHIVED = 'archived', 'Archived'

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='chat_sessions', on_delete=models.CASCADE, null=True, blank=True)
    client_id = models.CharField(max_length=64, blank=True, db_index=True)
    title = models.CharField(max_length=200, default='New conversation')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    message_count = models.PositiveIntegerField(default=0)
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', 'last_message_at']),
            models.Index(fields=['user', 'status']),
            models.Index(fields=['client_id', 'status']),
        ]
        ordering = ['-updated_at']

    def __str__(self) -> str:
        owner = self.user.email if self.user_id else self.client_id or 'guest'
        return f'ChatSession<{owner}:{self.public_id}>'


class ChatMessage(TimeStampedModel):
    class Role(models.TextChoices):
        USER = 'user', 'User'
        MODEL = 'model', 'Model'
        SYSTEM = 'system', 'System'
        TOOL = 'tool', 'Tool'

    session = models.ForeignKey(ChatSession, related_name='messages', on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=Role.choices)
    content = models.TextField()
    content_type = models.CharField(max_length=50, default='text/plain')
    model_name = models.CharField(max_length=120, blank=True)
    prompt_tokens = models.PositiveIntegerField(null=True, blank=True)
    completion_tokens = models.PositiveIntegerField(null=True, blank=True)
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['session', 'created_at']),
            models.Index(fields=['role', 'created_at']),
        ]
        ordering = ['created_at']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        ChatSession.objects.filter(pk=self.session_id).update(
            message_count=models.F('message_count') + 1,
            last_message_at=timezone.now(),
            updated_at=timezone.now(),
        )

    def __str__(self) -> str:
        return f'ChatMessage<{self.role}:{self.session.public_id}>'
