import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getShippingPrice } from './shipping_rates.controller.js';

const shippingRouter = Router();

// GET /api/shipping/price?countryId=222&zoneId=3628&quantity=2
shippingRouter.get('/', asyncHandler(getShippingPrice));

export default shippingRouter;