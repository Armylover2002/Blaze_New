import { GlobalSettings } from '../models/settings.model.js';
import { sendResponse } from '../../../utils/response.js';
import { uploadImageBufferDetailed } from '../../../services/cloudinary.service.js';
import { getCache, setCache, deleteCache } from '../../../utils/cacheManager.js';

const SETTINGS_CACHE_KEY = 'global_settings_public';
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const clearGlobalSettingsCache = () => {
    deleteCache(SETTINGS_CACHE_KEY);
};

const buildSettingsPayload = (settings) => {
    const rawSettings = settings.toObject ? settings.toObject() : settings;
    const allowedModules = Object.keys(GlobalSettings.schema.paths)
        .filter(p => p.startsWith('modules.'))
        .map(p => p.replace('modules.', ''));
    const cleanedModules = {};

    allowedModules.forEach(mod => {
        cleanedModules[mod] = (rawSettings.modules && rawSettings.modules[mod] !== undefined)
            ? !!rawSettings.modules[mod]
            : true;
    });
    rawSettings.modules = cleanedModules;
    return rawSettings;
};

export async function getGlobalSettings(req, res, next) {
    try {
        const isPublicRoute = req.path === '/public' || req.originalUrl?.includes('/public');
        if (isPublicRoute) {
            const cached = getCache(SETTINGS_CACHE_KEY);
            if (cached) {
                res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
                return sendResponse(res, 200, 'Global settings fetched successfully', cached);
            }
        }

        let settings = await GlobalSettings.findOne();
        if (!settings) {
            settings = await GlobalSettings.create({
                companyName: 'Appzeto',
                email: 'admin@appzeto.com'
            });
        }

        const payload = buildSettingsPayload(settings);

        if (isPublicRoute) {
            setCache(SETTINGS_CACHE_KEY, payload, SETTINGS_CACHE_TTL_MS);
            res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
        }

        return sendResponse(res, 200, 'Global settings fetched successfully', payload);
    } catch (error) {
        next(error);
    }
}

export async function updateGlobalSettings(req, res, next) {
    try {
        let data = {};
        if (req.body.data) {
            try {
                data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
            } catch (e) {
                console.error("Error parsing settings data:", e);
                data = req.body;
            }
        } else {
            data = req.body;
        }
        
        const { 
            companyName, email, phoneCountryCode, phoneNumber, address, state, pincode, region, 
            adminLogoUrl, adminFaviconUrl, userLogoUrl, userFaviconUrl, deliveryLogoUrl, deliveryFaviconUrl, restaurantLogoUrl, restaurantFaviconUrl, sellerLogoUrl, sellerFaviconUrl, loginBannerUrl,
            sellerLoginBannerUrl, restaurantLoginBannerUrl,
            sellerLoginBannerActive, restaurantLoginBannerActive,
            themeColor, modules 
        } = data;
        
        console.log("Updating global settings with data:", data);

        // Validation
        if (companyName !== undefined && (!companyName || companyName.trim().length < 2 || companyName.trim().length > 50)) {
            return res.status(400).json({ success: false, message: 'Company name must be between 2 and 50 characters' });
        }
        
        if (email && (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
            return res.status(400).json({ success: false, message: 'Invalid email address' });
        }
        
        if (phoneNumber && !/^\d{7,15}$/.test(phoneNumber.trim())) {
            return res.status(400).json({ success: false, message: 'Invalid phone number (7-15 digits required)' });
        }

        let settings = await GlobalSettings.findOne();
        if (!settings) {
            settings = new GlobalSettings();
        }

        if (companyName) settings.companyName = companyName;
        if (email) settings.email = email;
        if (phoneCountryCode || phoneNumber) {
            settings.phone = {
                countryCode: phoneCountryCode || settings.phone?.countryCode || '+91',
                number: phoneNumber || settings.phone?.number || ''
            };
        }
        if (address !== undefined) settings.address = address;
        if (state !== undefined) settings.state = state;
        if (pincode !== undefined) settings.pincode = pincode;
        if (region) settings.region = region;

        // Update URLs if provided
        const mediaFields = [
            'adminLogo', 'adminFavicon', 'userLogo', 'userFavicon', 
            'deliveryLogo', 'deliveryFavicon', 'restaurantLogo', 'restaurantFavicon', 
            'sellerLogo', 'sellerFavicon', 'loginBanner', 'sellerLoginBanner', 'restaurantLoginBanner'
        ];
        mediaFields.forEach(field => {
            const urlKey = `${field}Url`;
            if (data[urlKey] !== undefined) {
                settings[field] = {
                    url: String(data[urlKey] || '').trim(),
                    publicId: settings[field]?.publicId || '',
                    active: settings[field]?.active !== undefined ? settings[field].active : true
                };
                settings.markModified(field);
            }
        });

        if (sellerLoginBannerActive !== undefined) {
            settings.sellerLoginBanner = {
                url: settings.sellerLoginBanner?.url || '',
                publicId: settings.sellerLoginBanner?.publicId || '',
                active: !!sellerLoginBannerActive
            };
            settings.markModified('sellerLoginBanner');
        }
        if (restaurantLoginBannerActive !== undefined) {
            settings.restaurantLoginBanner = {
                url: settings.restaurantLoginBanner?.url || '',
                publicId: settings.restaurantLoginBanner?.publicId || '',
                active: !!restaurantLoginBannerActive
            };
            settings.markModified('restaurantLoginBanner');
        }

        if (themeColor !== undefined) {
            settings.themeColor = themeColor;
        }

        // Strictly define modules and ensure persistence
        const incomingModules = modules || data.modules || {};
        const currentModules = settings.modules || {};
        
        // Dynamically rebuild the modules object using the schema keys (single source of truth)
        const allowedModules = Object.keys(GlobalSettings.schema.paths)
            .filter(p => p.startsWith('modules.'))
            .map(p => p.replace('modules.', ''));
            
        settings.modules = {};
        allowedModules.forEach(mod => {
            settings.modules[mod] = incomingModules[mod] !== undefined 
                ? !!incomingModules[mod] 
                : (currentModules[mod] !== undefined ? !!currentModules[mod] : true);
        });
        
        // Use markModified to ensure the modules object is fully replaced in DB
        settings.markModified('modules');

        // Handle file uploads
        if (req.files) {
            const mediaUploadFields = [
                { name: 'adminLogo', folder: 'business/logos/admin' },
                { name: 'adminFavicon', folder: 'business/favicons/admin' },
                { name: 'userLogo', folder: 'business/logos/user' },
                { name: 'userFavicon', folder: 'business/favicons/user' },
                { name: 'deliveryLogo', folder: 'business/logos/delivery' },
                { name: 'deliveryFavicon', folder: 'business/favicons/delivery' },
                { name: 'restaurantLogo', folder: 'business/logos/restaurant' },
                { name: 'restaurantFavicon', folder: 'business/favicons/restaurant' },
                { name: 'sellerLogo', folder: 'business/logos/seller' },
                { name: 'sellerFavicon', folder: 'business/favicons/seller' },
                { name: 'loginBanner', folder: 'business/banners/login' },
                { name: 'sellerLoginBanner', folder: 'business/banners/seller_login' },
                { name: 'restaurantLoginBanner', folder: 'business/banners/restaurant_login' }
            ];

            for (const field of mediaUploadFields) {
                if (req.files[field.name] && req.files[field.name][0]) {
                    const result = await uploadImageBufferDetailed(req.files[field.name][0].buffer, field.folder);
                    settings[field.name] = {
                        url: result.secure_url,
                        publicId: result.public_id,
                        active: settings[field.name]?.active !== undefined ? settings[field.name].active : true
                    };
                    settings.markModified(field.name);
                }
            }
        }

        await settings.save();
        clearGlobalSettingsCache();
        return sendResponse(res, 200, 'Global settings updated successfully', settings);
    } catch (error) {
        next(error);
    }
}
