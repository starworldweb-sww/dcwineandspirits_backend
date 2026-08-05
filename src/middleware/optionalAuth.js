import { verifyToken } from '../utils/generateToken.js';


export const optionalAuth = (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token || typeof token !== 'string' || token.trim() === '') {
      req.customer = null;
      return next();
    }

    const decoded = verifyToken(token);

    if (!decoded || !decoded.customer_id) {
      req.customer = null;
      return next();
    }

    req.customer = decoded;
    return next();

  } catch (error) {
   
    req.customer = null;
    return next();
  }
};