from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import serializers

from .models import Address, Order, OrderItem, Payment, Product


class StockError(serializers.ValidationError):
    pass


@dataclass
class StockVisibility:
    in_stock: bool
    stock_count: int | None
    low_stock: bool


def build_stock_visibility(product: Product, expose_exact_stock: bool = True) -> StockVisibility:
    return StockVisibility(
        in_stock=product.is_in_stock,
        stock_count=product.stock if expose_exact_stock else None,
        low_stock=product.low_stock,
    )


def _normalize_items(items_data: list[dict[str, Any]]) -> dict[int, int]:
    quantities_by_product: dict[int, int] = defaultdict(int)

    for item in items_data:
        product_id = item.get("product")
        quantity = item.get("quantity")

        if not isinstance(product_id, int):
            raise serializers.ValidationError({"items": "Invalid product id."})
        if not isinstance(quantity, int) or quantity <= 0:
            raise serializers.ValidationError({"items": "Invalid quantity."})

        quantities_by_product[product_id] += quantity

    if not quantities_by_product:
        raise serializers.ValidationError({"items": "At least one item is required."})

    return quantities_by_product


def create_order_with_stock_validation(
    *,
    user,
    address_data: dict[str, Any],
    items_data: list[dict[str, Any]],
    shipping_fee: Decimal,
) -> Order:
    product_quantities = _normalize_items(items_data)

    with transaction.atomic():
        product_ids = list(product_quantities.keys())
        products = {
            product.id: product
            for product in Product.objects.select_for_update().filter(pk__in=product_ids, is_active=True)
        }

        if len(products) != len(product_ids):
            raise serializers.ValidationError({"items": "One or more products are invalid."})

        for product_id, requested_qty in product_quantities.items():
            product = products[product_id]
            if requested_qty > product.stock:
                raise StockError({"detail": "Insufficient stock"})

        address = Address.objects.filter(user=user, is_default=True).first()
        if address:
            for field, value in address_data.items():
                setattr(address, field, value)
            address.user = user
            address.save()
        else:
            address = Address.objects.create(user=user, **address_data)

        subtotal = Decimal("0.00")
        order = Order.objects.create(
            user=user,
            address=address,
            subtotal=0,
            shipping_fee=shipping_fee,
            total=0,
        )

        for product_id, quantity in product_quantities.items():
            product = products[product_id]
            subtotal += product.price * quantity
            OrderItem.objects.create(
                order=order,
                product=product,
                product_name=product.name,
                unit_price=product.price,
                quantity=quantity,
            )

        order.subtotal = subtotal
        order.total = subtotal + shipping_fee
        order.save(update_fields=["subtotal", "total"])

        return order


def confirm_payment_and_deduct_stock(
    *,
    acting_user,
    order_id: int,
    provider: str,
    transaction_id: str,
    amount: Decimal | None = None,
) -> tuple[Payment, bool]:
    with transaction.atomic():
        order = (
            Order.objects.select_for_update()
            .prefetch_related("items")
            .get(pk=order_id)
        )

        if not acting_user.is_staff and order.user_id != acting_user.id:
            raise serializers.ValidationError({"detail": "You do not have permission to confirm this payment."})

        existing_payment = Payment.objects.filter(order=order).first()
        if order.status == Order.Status.PAID and existing_payment:
            return existing_payment, False

        order_items = list(order.items.all())
        if not order_items:
            raise serializers.ValidationError({"detail": "Order has no items."})

        product_ids = [item.product_id for item in order_items]
        products = {
            product.id: product
            for product in Product.objects.select_for_update().filter(pk__in=product_ids)
        }

        for item in order_items:
            product = products.get(item.product_id)
            if product is None or item.quantity > product.stock:
                raise StockError({"detail": "Insufficient stock"})

        for item in order_items:
            Product.objects.filter(pk=item.product_id).update(stock=F("stock") - item.quantity)

        if amount is None:
            amount = order.total

        payment_values = {
            "provider": provider,
            "transaction_id": transaction_id,
            "amount": amount,
            "paid_at": timezone.now(),
        }

        payment, _ = Payment.objects.update_or_create(order=order, defaults=payment_values)

        order.status = Order.Status.PAID
        order.save(update_fields=["status"])

        return payment, True
