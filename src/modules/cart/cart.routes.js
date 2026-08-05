import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateCart,
  removeFromCart,
  clearCart,
  upload
} from './cart.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { optionalAuth } from '../../middleware/optionalAuth.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';



const cartRouter = Router();

cartRouter.get('/', optionalAuth, asyncHandler(getCart));
cartRouter.post('/add', optionalAuth, upload.any(), asyncHandler(addToCart));
cartRouter.put('/update', optionalAuth, asyncHandler(updateCart));
cartRouter.delete('/delete/:cart_id', optionalAuth, asyncHandler(removeFromCart));
cartRouter.delete('/clear', authMiddleware, asyncHandler(clearCart));

export default cartRouter;