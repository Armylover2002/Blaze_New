import express from 'express';
import { getDistance, getDistancesBatch, reverseGeocode } from '../controllers/maps.controller.js';

const router = express.Router();

router.get('/distance', getDistance);
router.post('/distance/batch', getDistancesBatch);
router.get('/reverse-geocode', reverseGeocode);

export default router;
