import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';

export const signAccessToken = (payload) => {
    return jwt.sign(payload, config.jwtAccessSecret, {
        expiresIn: config.jwtAccessExpiresIn
    });
};

export const signRefreshToken = (payload) => {
    return jwt.sign(payload, config.jwtRefreshSecret, {
        expiresIn: config.jwtRefreshExpiresIn
    });
};

export const verifyAccessToken = (token) => {
    return jwt.verify(token, config.jwtAccessSecret);
};

export const verifyRefreshToken = (token) => {
    return jwt.verify(token, config.jwtRefreshSecret);
};

const REGISTRATION_PURPOSE = 'restaurant_onboarding';

/** Short-lived proof that a phone completed OTP (for onboarding draft/step APIs). */
export const signRestaurantRegistrationToken = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    return jwt.sign(
        {
            purpose: REGISTRATION_PURPOSE,
            phone: digits,
            phoneLast10: digits.slice(-10),
        },
        config.jwtAccessSecret,
        { expiresIn: '2h' }
    );
};

export const verifyRestaurantRegistrationToken = (token) => {
    const decoded = jwt.verify(token, config.jwtAccessSecret);
    if (decoded?.purpose !== REGISTRATION_PURPOSE) {
        const err = new Error('Invalid registration token');
        err.name = 'JsonWebTokenError';
        throw err;
    }
    return decoded;
};

