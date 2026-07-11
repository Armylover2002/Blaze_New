import express from 'express';
import { getDistance, getDistancesBatch } from '../controllers/maps.controller.js';

const router = express.Router();

router.get('/distance', getDistance);
router.post('/distance/batch', getDistancesBatch);

export default router;
