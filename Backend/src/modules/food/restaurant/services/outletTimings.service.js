import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodRestaurantOutletTimings } from '../models/outletTimings.model.js';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const normalizeDay = (value) => {
    const v = String(value || '').trim();
    if (!v) return null;
    const exact = DAY_NAMES.find((d) => d.toLowerCase() === v.toLowerCase());
    if (exact) return exact;
    const abbr = v.slice(0, 3).toLowerCase();
    const match = DAY_NAMES.find((d) => d.toLowerCase().startsWith(abbr));
    return match || null;
};

const normalizeTime = (value, fallback) => {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    // Accept "HH:mm" or "H:mm"
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return fallback;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return fallback;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const defaultTimings = () =>
    DAY_NAMES.map((day) => ({
        day,
        isOpen: true,
        openingTime: '09:00',
        closingTime: '22:00'
    }));

const SHORT_DAYS_MAP = {
    Mon: 'Monday',
    Tue: 'Tuesday',
    Wed: 'Wednesday',
    Thu: 'Thursday',
    Fri: 'Friday',
    Sat: 'Saturday',
    Sun: 'Sunday'
};

/** Build per-day outlet timings from onboarding delivery schedule (openDays + times). */
export function buildOutletTimingsArrayFromSchedule(openDays, openingTime, closingTime) {
    const rawDays = Array.isArray(openDays)
        ? openDays
        : typeof openDays === 'string'
            ? openDays.split(',').map((d) => d.trim()).filter(Boolean)
            : [];

    const normalizedOpenDays = rawDays
        .map((d) => SHORT_DAYS_MAP[d] || d)
        .filter(Boolean);

    const openTime = normalizeTime(openingTime, '');
    const closeTime = normalizeTime(closingTime, '');

    return DAY_NAMES.map((day) => {
        const isOpen = normalizedOpenDays.includes(day);
        return {
            day,
            isOpen,
            openingTime: openTime,
            closingTime: closeTime
        };
    });
}

export async function syncOutletTimingsFromOpenDays(restaurantId, openDays, openingTime, closingTime) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }

    const timings = buildOutletTimingsArrayFromSchedule(openDays, openingTime, closingTime);

    await FoodRestaurantOutletTimings.findOneAndUpdate(
        { restaurantId },
        { $set: { timings } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

const toClientShape = (doc) => {
    const timings = Array.isArray(doc?.timings) ? doc.timings : [];
    const map = {};
    for (const day of DAY_NAMES) {
        const found = timings.find((t) => normalizeDay(t?.day) === day);
        const isOpen = found ? found.isOpen !== false : true;
        map[day] = {
            isOpen,
            openingTime: normalizeTime(found?.openingTime, '09:00'),
            closingTime: normalizeTime(found?.closingTime, '22:00')
        };
    }
    return map;
};

export async function getOutletTimingsForRestaurant(restaurantId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    const doc = await FoodRestaurantOutletTimings.findOne({ restaurantId }).select('timings updatedAt').lean();
    if (!doc) return { outletTimings: toClientShape({ timings: defaultTimings() }) };
    return { outletTimings: toClientShape(doc) };
}

export async function upsertOutletTimingsForRestaurant(restaurantId, outletTimings) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    if (!outletTimings || typeof outletTimings !== 'object' || Array.isArray(outletTimings)) {
        throw new ValidationError('outletTimings must be an object keyed by day name');
    }

    const timings = DAY_NAMES.map((day) => {
        const src = outletTimings[day] && typeof outletTimings[day] === 'object' ? outletTimings[day] : {};
        const isOpen = src.isOpen !== false;
        return {
            day,
            isOpen,
            openingTime: normalizeTime(src.openingTime, '09:00'),
            closingTime: normalizeTime(src.closingTime, '22:00')
        };
    });

    const doc = await FoodRestaurantOutletTimings.findOneAndUpdate(
        { restaurantId },
        { $set: { timings } },
        { upsert: true, new: true, setDefaultsOnInsert: true, projection: 'timings updatedAt' }
    ).lean();

    return { outletTimings: toClientShape(doc) };
}

export async function attachOutletTimingsToRestaurants(restaurants) {
    if (!Array.isArray(restaurants) || restaurants.length === 0) return restaurants;
    const ids = restaurants.map((r) => r._id);
    const docs = await FoodRestaurantOutletTimings.find({ restaurantId: { $in: ids } }).lean();
    const map = {};
    for (const doc of docs) {
        map[String(doc.restaurantId)] = toClientShape(doc);
    }
    const fallback = toClientShape({ timings: defaultTimings() });
    for (const r of restaurants) {
        const rId = String(r._id);
        r.outletTimings = map[rId] || fallback;
    }
    return restaurants;
}
