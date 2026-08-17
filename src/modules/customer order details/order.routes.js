import { Router } from "express";
import { CustomerOrderDetailsByOrderId, CustomerOrderHistory, trackOrder } from "./order.controller.js";
import { authMiddleware } from "../../middleware/authMiddleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";



const orderRouter = Router();

orderRouter.get('/order-history',authMiddleware ,asyncHandler(CustomerOrderHistory))
orderRouter.get('/order-info/:id',authMiddleware,asyncHandler(CustomerOrderDetailsByOrderId))
orderRouter.post('/track-order', asyncHandler(trackOrder))

export default orderRouter ;