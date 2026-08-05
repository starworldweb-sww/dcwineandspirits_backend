import {
  addToWishlistService,
  getWishlistService,
  removeFromWishlistService,
  isInWishlistService,
} from './wishlist.service.js';
import { successResponse, errorResponse } from '../../utils/apiResponse.js';

const getCustomerId = (req) => req.customer?.customer_id || 0;

export const getWishlist = async (req, res) => {
    const items = await getWishlistService(req.query, { customerId: getCustomerId(req) });
    return successResponse(res, 200, 'Wishlist fetched', { total: items.length, items });
};


export const addToWishlist = async (req, res) => {
 
    const { product_id } = req.body;
    if (!product_id) return errorResponse(res, 400, 'product_id is required');

    const customerId = getCustomerId(req);
    const productId  = Number(product_id);

    if (customerId === 0) {
    
      const existing = req.cookies?.guest_wishlist || '';
      const ids = existing ? existing.split(',').map(Number).filter(Boolean) : [];

      if (!ids.includes(productId)) ids.push(productId);

      res.cookie('guest_wishlist', ids.join(','), {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
      });

      return successResponse(res, 200, 'Added to wishlist (guest)', { source: 'cookie', ids });
    }

    
    const result = await addToWishlistService({ customerId, productId });
    return successResponse(res, 200,
      result.already_exists ? 'Already in wishlist' : 'Added to wishlist',
      { source: 'db', ...result }
    );
};

export const removeFromWishlist = async (req, res) => {
    const productId  = Number(req.params.product_id);
    const customerId = getCustomerId(req);
   const deleted = await removeFromWishlistService({ customerId, productId });
    return successResponse(res, 200, 'Removed from wishlist', deleted);
};

export const checkWishlist = async (req, res) => {
  
    const customerId = getCustomerId(req);
    const productId  = Number(req.params.product_id);

    if (customerId === 0) {
      const existing = req.cookies?.guest_wishlist || '';
      const ids = existing ? existing.split(',').map(Number) : [];
      return successResponse(res, 200, 'Checked', { inWishlist: ids.includes(productId) });
    }

    const inWishlist = await isInWishlistService({ customerId, productId });
    return successResponse(res, 200, 'Checked', { inWishlist });
};