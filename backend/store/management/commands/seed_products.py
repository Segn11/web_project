from decimal import Decimal

from django.core.management.base import BaseCommand

from store.models import Category, Product, ProductImage


class Command(BaseCommand):
    help = 'Seed sample categories and products'

    def handle(self, *args, **options):
        categories = [
            ('Electronics', 'electronics'),
            ('Jewelry', 'jewelry'),
            ('Clothing', 'clothing'),
        ]

        category_map = {}
        for name, slug in categories:
            category, _ = Category.objects.get_or_create(name=name, defaults={'slug': slug})
            if category.slug != slug:
                category.slug = slug
                category.save(update_fields=['slug'])
            category_map[slug] = category

        products = [
            {
                'category_slug': 'electronics',
                'name': 'Wireless Noise-Canceling Headphones',
                'slug': 'wireless-noise-canceling-headphones',
                'description': 'Premium over-ear headphones with adaptive noise cancelation.',
                'price': Decimal('199.99'),
                'stock': 40,
                'image_url': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200',
            },
            {
                'category_slug': 'electronics',
                'name': 'Smart Fitness Watch',
                'slug': 'smart-fitness-watch',
                'description': 'Track workouts, sleep, and heart rate with a 7-day battery life.',
                'price': Decimal('129.00'),
                'stock': 65,
                'image_url': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200',
            },
            {
                'category_slug': 'jewelry',
                'name': 'Sterling Silver Necklace',
                'slug': 'sterling-silver-necklace',
                'description': 'Minimal pendant necklace crafted in sterling silver.',
                'price': Decimal('79.50'),
                'stock': 120,
                'image_url': 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=1200',
            },
            {
                'category_slug': 'clothing',
                'name': 'Classic Cotton Hoodie',
                'slug': 'classic-cotton-hoodie',
                'description': 'Unisex heavyweight hoodie for everyday wear.',
                'price': Decimal('54.90'),
                'stock': 90,
                'image_url': 'https://images.unsplash.com/photo-1618354691261-7f1f10b8c1f8?w=1200',
            },
        ]

        created_count = 0
        for item in products:
            category = category_map[item['category_slug']]
            product, created = Product.objects.get_or_create(
                slug=item['slug'],
                defaults={
                    'category': category,
                    'name': item['name'],
                    'description': item['description'],
                    'price': item['price'],
                    'stock': item['stock'],
                    'is_active': True,
                },
            )
            if not created:
                product.category = category
                product.name = item['name']
                product.description = item['description']
                product.price = item['price']
                product.stock = item['stock']
                product.is_active = True
                product.save()
            else:
                created_count += 1

            ProductImage.objects.update_or_create(
                product=product,
                is_primary=True,
                defaults={'image_url': item['image_url']},
            )

        self.stdout.write(self.style.SUCCESS(f'Seed complete. Created {created_count} new products.'))
