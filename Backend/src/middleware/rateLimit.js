import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

const windowMs = config.rateLimitWindowMinutes * 60 * 1000;

export const apiRateLimiter = rateLimit({
    windowMs,
    // Dev UX: local UI can generate lots of background API calls (location, polling, etc).
    // Keep production strict, but avoid blocking local development.
    max: config.nodeEnv === 'development' ? Math.max(config.rateLimitMaxRequests, 2000) : config.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    }
});

const authWindowMs = config.authRateLimitWindowMinutes * 60 * 1000;

/** Stricter rate limit for auth routes (OTP, login, refresh, logout). Applied in addition to global limiter. */
export const authRateLimiter = rateLimit({
    windowMs: authWindowMs,
    // Dev UX: login/otp testing can be frequent. Keep production strict (e.g. 30), 
    // but relax local development to avoid 429 when testing flows.
    max: config.nodeEnv === 'development' ? Math.max(config.authRateLimitMax, 100) : config.authRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many authentication attempts. Please try again later.'
    }
});

const mapsWindowMs = config.mapsRateLimitWindowMinutes * 60 * 1000;

/** Stricter rate limit for Google Maps proxy endpoints (Distance Matrix). */
export const mapsRateLimiter = rateLimit({
    windowMs: mapsWindowMs,
    max: config.nodeEnv === 'development'
        ? Math.max(config.mapsRateLimitMax, 300)
        : config.mapsRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many map distance requests. Please try again later.',
    },
});

const ALLOWED_MAPS_CLIENT_ORIGINS = [
    'https://dukaanwallah.vercel.app',
    /^https:\/\/dukaanwallah.*\.vercel\.app$/,
    'https://blaze-new-1.onrender.com',
    /^https:\/\/.*\.onrender\.com$/,
    'http://localhost:5173',
    'http://localhost:3000',
];

const isAllowedMapsClientOrigin = (value = '') => {
    const normalized = String(value || '').trim();
    if (!normalized) return false;
    return ALLOWED_MAPS_CLIENT_ORIGINS.some((pattern) => {
        if (typeof pattern === 'string') {
            return normalized === pattern || normalized.startsWith(`${pattern}/`);
        }
        return pattern.test(normalized);
    });
};

/**
 * Restrict maps proxy to app clients (browser origin), authenticated users, or QC sessions.
 * Blocks unauthenticated direct API abuse while keeping guest checkout flows working.
 */
export const requireMapsApiAccess = (req, res, next) => {
    const hasAuth = /^Bearer\s+\S+/i.test(String(req.headers.authorization || ''));
    const hasQuickSession = Boolean(String(req.headers['x-quick-session'] || '').trim());
    const fromApp = isAllowedMapsClientOrigin(req.headers.origin)
        || isAllowedMapsClientOrigin(req.headers.referer);

    if (hasAuth || hasQuickSession || fromApp) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: 'Maps distance API is only available to authenticated app clients.',
    });
};

