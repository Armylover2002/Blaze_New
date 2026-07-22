/**
 * Porter coupon + payment lifecycle unit tests (no DB required).
 * Run: node --test scripts/test-porter-coupon-payment-lifecycle.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolvePorterCouponDiscountAmount,
    buildCouponConsumptionIncrement,
    canConsumePorterCoupon,
} from '../src/modules/porter/orders/services/porter-coupon-lifecycle.service.js';
import { PORTER_ORDER_STATUS, PORTER_PAYMENT_STATUS } from '../src/modules/porter/orders/constants/porterOrderStatus.constants.js';

const couponId = '507f1f77bcf86cd799439011';

function baseOrder(overrides = {}) {
    return {
        _id: '507f1f77bcf86cd799439012',
        orderNumber: 'POR-TEST-001',
        status: PORTER_ORDER_STATUS.CREATED,
        couponId,
        couponCode: 'SAVE50',
        couponConsumed: false,
        pricing: { discount: 50, total: 168 },
        payment: { method: 'wallet', status: PORTER_PAYMENT_STATUS.PAID },
        ...overrides,
    };
}

test('resolvePorterCouponDiscountAmount rounds and clamps negative values', () => {
    assert.equal(resolvePorterCouponDiscountAmount({ pricing: { discount: 49.6 } }), 50);
    assert.equal(resolvePorterCouponDiscountAmount({ pricing: { discount: -10 } }), 0);
    assert.equal(resolvePorterCouponDiscountAmount({}), 0);
});

test('buildCouponConsumptionIncrement includes totalDiscountGiven when discount > 0', () => {
    assert.deepEqual(buildCouponConsumptionIncrement(baseOrder()), {
        usedCount: 1,
        totalDiscountGiven: 50,
    });
});

test('buildCouponConsumptionIncrement skips totalDiscountGiven for zero discount', () => {
    assert.deepEqual(
        buildCouponConsumptionIncrement(baseOrder({ pricing: { discount: 0, total: 200 } })),
        { usedCount: 1 },
    );
});

test('Wallet + Coupon: consume when payment is paid at create', () => {
    const order = baseOrder({ payment: { method: 'wallet', status: PORTER_PAYMENT_STATUS.PAID } });
    assert.equal(canConsumePorterCoupon(order), true);
});

test('Razorpay + Coupon: consume only after payment captured', () => {
    const pending = baseOrder({ payment: { method: 'razorpay', status: PORTER_PAYMENT_STATUS.PENDING } });
    assert.equal(canConsumePorterCoupon(pending), false);

    const paid = baseOrder({ payment: { method: 'razorpay', status: PORTER_PAYMENT_STATUS.PAID } });
    assert.equal(canConsumePorterCoupon(paid), true);
});

test('COD + Coupon: do not consume until payment is captured at delivery', () => {
    const pending = baseOrder({ payment: { method: 'cash', status: PORTER_PAYMENT_STATUS.PENDING } });
    assert.equal(canConsumePorterCoupon(pending), false);

    const paid = baseOrder({
        status: PORTER_ORDER_STATUS.DELIVERED,
        payment: { method: 'cash', status: PORTER_PAYMENT_STATUS.PAID },
    });
    assert.equal(canConsumePorterCoupon(paid), true);
});

test('Unpaid cancel: coupon not consumed when payment never captured', () => {
    const order = baseOrder({
        status: PORTER_ORDER_STATUS.CANCELLED_BY_USER,
        payment: { method: 'razorpay', status: PORTER_PAYMENT_STATUS.PENDING },
        couponConsumed: false,
    });
    assert.equal(canConsumePorterCoupon(order), false);
});

test('Paid cancel: coupon remains consumed (no rollback gate)', () => {
    const order = baseOrder({
        status: PORTER_ORDER_STATUS.CANCELLED_BY_USER,
        payment: { method: 'wallet', status: PORTER_PAYMENT_STATUS.REFUNDED },
        couponConsumed: true,
    });
    assert.equal(canConsumePorterCoupon(order), false);
});

test('Delivered order: coupon consumed when paid', () => {
    const order = baseOrder({
        status: PORTER_ORDER_STATUS.DELIVERED,
        payment: { method: 'wallet', status: PORTER_PAYMENT_STATUS.PAID },
        couponConsumed: false,
    });
    assert.equal(canConsumePorterCoupon(order), true);
});

test('Idempotent: already consumed coupons cannot consume again', () => {
    const order = baseOrder({ couponConsumed: true });
    assert.equal(canConsumePorterCoupon(order), false);
});

test('Orders without coupon never consume', () => {
    const order = baseOrder({ couponId: null, couponCode: null });
    assert.equal(canConsumePorterCoupon(order), false);
});
