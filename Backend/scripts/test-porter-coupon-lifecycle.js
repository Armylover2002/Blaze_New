/**
 * Porter coupon lifecycle verification script.
 * Run: node scripts/test-porter-coupon-lifecycle.js
 */
import {
    computeLifecycleStatus,
    resolveCouponStatusForSave,
    validateStatusCombination,
    validateStatusTransition,
    validateCouponForRedemption,
    buildStatusHistoryEntry,
} from '../src/modules/porter/utils/coupon-lifecycle.helpers.js';
import { ValidationError } from '../src/core/auth/errors.js';

const now = new Date('2026-06-30T12:00:00.000Z');
const past = new Date('2026-06-01T00:00:00.000Z');
const future = new Date('2026-07-15T00:00:00.000Z');
const farFuture = new Date('2026-08-01T00:00:00.000Z');

let passed = 0;
let failed = 0;

const assert = (label, condition) => {
    if (condition) {
        passed += 1;
        console.log(`  ✓ ${label}`);
    } else {
        failed += 1;
        console.error(`  ✗ ${label}`);
    }
};

const assertThrows = (label, fn, messageIncludes) => {
    try {
        fn();
        failed += 1;
        console.error(`  ✗ ${label} (expected throw)`);
    } catch (err) {
        const ok = err instanceof ValidationError
            && (!messageIncludes || String(err.message).includes(messageIncludes));
        if (ok) {
            passed += 1;
            console.log(`  ✓ ${label}`);
        } else {
            failed += 1;
            console.error(`  ✗ ${label} (wrong error: ${err.message})`);
        }
    }
};

console.log('\n--- Create lifecycle ---');
assert('Future coupon → scheduled', computeLifecycleStatus(future, farFuture, now) === 'scheduled');
assert('Current coupon → active', computeLifecycleStatus(past, future, now) === 'active');
assert('Expired coupon → expired', computeLifecycleStatus(past, past, now) === 'expired');
assert('Admin disabled → inactive', computeLifecycleStatus(past, future, now, 'inactive') === 'inactive');

console.log('\n--- Update / sticky inactive ---');
assert(
    'Inactive stays inactive on date-only update',
    resolveCouponStatusForSave({
        validFrom: past,
        validUntil: future,
        currentStatus: 'inactive',
        requestedStatus: undefined,
        now,
    }) === 'inactive',
);
assert(
    'Inactive + enable recalculates to active',
    resolveCouponStatusForSave({
        validFrom: past,
        validUntil: future,
        currentStatus: 'inactive',
        requestedStatus: 'active',
        now,
    }) === 'active',
);
assert(
    'Enabled coupon recalculates on date change to scheduled',
    resolveCouponStatusForSave({
        validFrom: future,
        validUntil: farFuture,
        currentStatus: 'active',
        requestedStatus: undefined,
        now,
    }) === 'scheduled',
);

console.log('\n--- Status validation ---');
assertThrows(
    'Expired cannot become scheduled',
    () => validateStatusTransition('expired', 'scheduled', past, past, now),
    'cannot become scheduled',
);
assertThrows(
    'Scheduled cannot have past validFrom',
    () => validateStatusCombination('scheduled', past, future, now),
    'start date in the past',
);
assertThrows(
    'Active cannot have expired validUntil',
    () => validateStatusCombination('active', past, past, now),
    'validity window',
);

console.log('\n--- Redemption ---');
assert(
    'Active in-window coupon redeemable',
    validateCouponForRedemption({
        status: 'active',
        validFrom: past,
        validUntil: future,
    }, now) === true,
);
assertThrows(
    'Scheduled coupon not redeemable',
    () => validateCouponForRedemption({ status: 'scheduled', validFrom: future, validUntil: farFuture }, now),
    'not active',
);
assertThrows(
    'Expired coupon not redeemable',
    () => validateCouponForRedemption({ status: 'expired', validFrom: past, validUntil: past }, now),
    'not active',
);
assertThrows(
    'Inactive coupon not redeemable',
    () => validateCouponForRedemption({ status: 'inactive', validFrom: past, validUntil: future }, now),
    'not active',
);
assertThrows(
    'Active but outside window not redeemable',
    () => validateCouponForRedemption({ status: 'active', validFrom: future, validUntil: farFuture }, now),
    'not valid at this time',
);

console.log('\n--- statusHistory ---');
const entry = buildStatusHistoryEntry('scheduled', 'active', { name: 'System' });
assert('statusHistory has oldStatus', entry.oldStatus === 'scheduled');
assert('statusHistory has newStatus', entry.newStatus === 'active');
assert('statusHistory mirrors newStatus in status field', entry.status === 'active');

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
process.exit(failed > 0 ? 1 : 0);
