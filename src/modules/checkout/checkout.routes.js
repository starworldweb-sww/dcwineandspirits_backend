import {Router} from 'express';
import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { placeOrder, createPaymentIntent, handleWebhook } from './checkout.controller.js';

const checkoutRouter = Router();
const webhookRouter = Router();

checkoutRouter.post("/", asyncHandler(placeOrder));
webhookRouter.post("/webhook", express.raw({ type: 'application/json' }), handleWebhook);
checkoutRouter.post("/create-payment-intent", asyncHandler(createPaymentIntent));

export { webhookRouter };
export default checkoutRouter;
