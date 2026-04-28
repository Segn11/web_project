from django.contrib import admin

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

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'created_at')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'stock', 'is_active', 'updated_at')
    list_filter = ('category', 'is_active')
    search_fields = ('name', 'slug', 'description')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ProductImageInline]


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ('product', 'is_primary', 'image_url', 'updated_at')
    list_filter = ('is_primary',)
    search_fields = ('product__name', 'image_url')

admin.site.register(Address)
admin.site.register(Cart)
admin.site.register(CartItem)
admin.site.register(ChatSession)
admin.site.register(ChatMessage)
admin.site.register(Wishlist)
admin.site.register(WishlistItem)
admin.site.register(Order)
admin.site.register(OrderItem)
admin.site.register(Payment)
admin.site.register(Review)
