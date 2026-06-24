import mongoose from 'mongoose';
import dns from 'dns';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

export const connectDB = async () => {
    try {
        // Set DNS servers to public DNS (Google & Cloudflare) to avoid local DNS/SRV resolution failures
        try {
            dns.setServers(['8.8.8.8', '1.1.1.1']);
        } catch (dnsErr) {
            logger.warn(`Failed to set DNS servers: ${dnsErr.message}`);
        }

        const conn = await mongoose.connect(config.mongodbUri, {
            family: 4,                    // Force IPv4
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000,
            maxPoolSize: 15,              // Limit active connections (default 100 is too heavy for Render free tier)
            minPoolSize: 2,               // Keep minimum connections alive to avoid cold-start latency
            autoIndex: false              // 🚀 CRITICAL PERF: Prevent Mongoose from building indexes on every boot
        });
        logger.info(`MongoDB connected: ${conn.connection.host}`);

        // Programmatically inspect and drop legacy non-sparse index to prevent duplicate null key errors
        try {
            const db = conn.connection.db;
            const collections = await db.listCollections({ name: 'common_users' }).toArray();
            if (collections.length > 0) {
                const userCol = db.collection('common_users');
                const indexes = await userCol.indexes();
                const phoneIndex = indexes.find(idx => idx.name === 'phone_1');
                if (phoneIndex && !phoneIndex.sparse) {
                    logger.info("Dropping legacy non-sparse index 'phone_1' on 'common_users' to enable dual email/phone auth...");
                    await userCol.dropIndex('phone_1');
                    logger.info("Legacy non-sparse index 'phone_1' dropped successfully.");
                }
            }

            const qpCollections = await db.listCollections({ name: 'quick_products' }).toArray();
            if (qpCollections.length > 0) {
                const qpCol = db.collection('quick_products');
                const indexes = await qpCol.indexes();
                const slugIndex = indexes.find(idx => idx.name === 'slug_1');
                if (slugIndex && slugIndex.unique) {
                    logger.info("Dropping legacy global unique 'slug_1' index on 'quick_products' to support seller-scoped slug uniqueness...");
                    await qpCol.dropIndex('slug_1');
                    logger.info("Legacy global unique 'slug_1' index dropped successfully.");
                }
            }
        } catch (idxErr) {
            logger.warn(`Failed to inspect/drop legacy index: ${idxErr.message}`);
        }
    } catch (error) {
        logger.error(`MongoDB connection error: ${error.message}`);
        // Log the URI without password for debugging
        const maskedUri = config.mongodbUri.replace(/\/\/.*@/, "//***:***@");
        logger.info(`Attempted to connect to: ${maskedUri}`);
        process.exit(1);
    }
};

/**
 * Close MongoDB connection (e.g. graceful shutdown).
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
};
