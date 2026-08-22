import { Router } from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlist,
} from './wishlish.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { optionalAuth } from '../../middleware/optionalAuth.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';


const wishlistRouter = Router();

wishlistRouter.get('/', optionalAuth, asyncHandler(getWishlist));
wishlistRouter.post('/add', optionalAuth, asyncHandler(addToWishlist));
wishlistRouter.delete('/delete/:product_id', optionalAuth, asyncHandler(removeFromWishlist));
wishlistRouter.get('/check/:product_id', optionalAuth, asyncHandler(checkWishlist));

export default wishlistRouter;