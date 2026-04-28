from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Category, Order, Product


class StockManagementTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='buyer',
            email='buyer@example.com',
            password='strong-password-123',
        )
        self.client.force_authenticate(user=self.user)

        self.category = Category.objects.create(name='Phones', slug='phones')
        self.product = Product.objects.create(
            category=self.category,
            name='Pixel Test',
            slug='pixel-test',
            description='Test device',
            price=Decimal('100.00'),
            stock=3,
            is_active=True,
        )

    def _checkout_payload(self, quantity=1):
        return {
            'address': {
                'label': 'Home',
                'full_name': 'Buyer User',
                'phone': '+1000000000',
                'line1': 'Main Street 1',
                'line2': '',
                'city': 'City',
                'state': 'State',
                'postal_code': '1000',
                'country': 'Country',
                'is_default': True,
            },
            'items': [
                {
                    'product': self.product.id,
                    'quantity': quantity,
                }
            ],
            'shipping_fee': '10.00',
        }

    def test_create_order_fails_when_stock_is_insufficient(self):
        response = self.client.post('/api/orders/', data=self._checkout_payload(quantity=4), format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('detail'), 'Insufficient stock')

    def test_order_does_not_reduce_stock_until_payment_success(self):
        order_response = self.client.post('/api/orders/', data=self._checkout_payload(quantity=2), format='json')
        self.assertEqual(order_response.status_code, status.HTTP_201_CREATED)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)

        order_id = order_response.data['id']
        payment_response = self.client.post(
            '/api/payments/success/',
            data={
                'order_id': order_id,
                'provider': 'card',
                'transaction_id': 'txn-1',
            },
            format='json',
        )

        self.assertEqual(payment_response.status_code, status.HTTP_200_OK)
        self.assertTrue(payment_response.data['stock_deducted'])

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 1)

        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.status, Order.Status.PAID)

    def test_payment_success_is_idempotent(self):
        order_response = self.client.post('/api/orders/', data=self._checkout_payload(quantity=2), format='json')
        order_id = order_response.data['id']

        first = self.client.post(
            '/api/payments/success/',
            data={'order_id': order_id, 'provider': 'card', 'transaction_id': 'txn-2'},
            format='json',
        )
        second = self.client.post(
            '/api/payments/success/',
            data={'order_id': order_id, 'provider': 'card', 'transaction_id': 'txn-2'},
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertFalse(second.data['stock_deducted'])

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 1)

    def test_order_creation_rejects_empty_items(self):
        payload = self._checkout_payload(quantity=1)
        payload['items'] = []

        response = self.client.post('/api/orders/', data=payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_product_api_exposes_stock_visibility_fields(self):
        response = self.client.get(f'/api/products/{self.product.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['in_stock'])
        self.assertEqual(response.data['stock_count'], 3)
        self.assertTrue(response.data['low_stock'])
        self.assertEqual(response.data['stock_status'], 'low_stock')
        self.assertEqual(response.data['stock_label'], 'Only 3 left')
