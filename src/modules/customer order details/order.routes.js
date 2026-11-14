import { Router } from "express";
import { CustomerBulkOrderDetails, CustomerBulkOrderHistory, CustomerOrderDetailsByOrderId, CustomerOrderHistory, trackOrder } from "./order.controller.js";
import { authMiddleware } from "../../middleware/authMiddleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";



const orderRouter = Router();

orderRouter.get('/order-history',authMiddleware ,asyncHandler(CustomerOrderHistory))
orderRouter.get('/order-info/:id',authMiddleware,asyncHandler(CustomerOrderDetailsByOrderId))
orderRouter.post('/track-order', asyncHandler(trackOrder))
orderRouter.get("/bulk-history", authMiddleware, CustomerBulkOrderHistory);
orderRouter.get("/bulk-info/:id", authMiddleware, asyncHandler(CustomerBulkOrderDetails));


export default orderRouter ;