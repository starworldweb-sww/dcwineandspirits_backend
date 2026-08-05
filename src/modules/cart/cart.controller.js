import {
  addToCartService,
  getCartService,
  updateCartQuantityService,
  removeFromCartService,
  clearCartService,
} from './cart.service.js';
import { successResponse, errorResponse } from '../../utils/apiResponse.js';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

const getCustomerId = (req) => req.customer?.customer_id || 0;


const resolveSessionId = (req, res) => {
  let sessionId = req.cookies?.guest_session || '';

  if (!sessionId) {
    sessionId = crypto.randomBytes(16).toString('hex');
    res.cookie('guest_session', sessionId, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
    });
  }

  return sessionId;
};


export const getCart = async (req, res) => {

  const customerId = getCustomerId(req);
  const sessionId = req.cookies?.guest_session || '';

  const items = await getCartService(req.query,{ sessionId, customerId });
  return successResponse(res, 200, 'Cart fetched',  items || []);

};


export const addToCart = async (req, res) => {
  try {
    let product_id, quantity = 1, option, recurring_id = 0;
    const optionData = {};

    if (req.is('multipart/form-data')) {
      product_id = req.body.product_id;
      quantity = req.body.quantity || 1;
      recurring_id = req.body.recurring_id || 0;
      if (req.body.option) {
        if (Array.isArray(req.body.option)) {
          req.body.option.forEach((value, index) => {
            if (value !== null && value !== undefined && value !== '') {
              optionData[index] = value;
            }
          });
        } else if (typeof req.body.option === 'object') {
          Object.assign(optionData, req.body.option);
        }
      } else {
        Object.keys(req.body).forEach(key => {
          const match = key.match(/^option\[(\d+)\]$/);
          if (match) {
            optionData[match[1]] = req.body[key];
          }
        });
      }

      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          const match = file.fieldname.match(/^option\[(\d+)\]$/);
          if (match) {
            optionData[match[1]] = `${file.filename}`;
          }
        });
      }
      
      option = optionData;
    } else {
      ({ product_id, quantity = 1, option, recurring_id = 0 } = req.body);
    }

    if (!product_id) return errorResponse(res, 400, 'product_id is required');

    const customerId = getCustomerId(req);
    const optionStr = typeof option === 'string' ? option : JSON.stringify(option || {});

    const sessionId = resolveSessionId(req, res);

    const item = await addToCartService({
      sessionId,
      customerId,
      productId: Number(product_id),
      quantity: Number(quantity),
      option: optionStr,
      recurringId: Number(recurring_id),
    });

    return successResponse(res, 200, 'Added to cart', item);
  } catch (error) {
    console.error('Add to cart error:', error);
    return errorResponse(res, 500, 'Failed to add to cart');
  }
};

// Export the upload middleware for the route
export { upload };


export const updateCart = async (req, res) => {

  const { cart_id, quantity,options } = req.body;
 
  if (!cart_id) return errorResponse(res, 400, 'cart_id is required');

  const result = await updateCartQuantityService({
    cartId: Number(cart_id),
    quantity: Number(quantity),
    option:options
  });
  return successResponse(res, 200, 'Cart updated', result);

};


export const removeFromCart = async (req, res) => {

  const { cart_id } = req.params;
  if (!cart_id) return errorResponse(res, 400, 'cart_id is required');

  const deletedItem = await removeFromCartService({ cartId: Number(cart_id) });
  return successResponse(res, 200, 'Item removed from cart', deletedItem);

};


export const clearCart = async (req, res) => {

  const customerId = getCustomerId(req);
  const sessionId = req.cookies?.guest_session || '';

  await clearCartService({ sessionId, customerId });
  return successResponse(res, 200, 'Cart cleared');

};