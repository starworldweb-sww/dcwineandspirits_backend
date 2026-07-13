import { errorResponse } from '../utils/apiResponse.js';
import { verifyToken } from '../utils/generateToken.js';

export const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies?.token || req.headers?.authorization?.split(' ')[1];
        if (!token) {
            return errorResponse(res, 401, 'Access denied, no token provided');
        }

        if (typeof token !== 'string' || token.trim() === '') {
            return errorResponse(res, 401, 'Invalid token format');
        }

        const decoded = verifyToken(token);

        if (!decoded || !decoded.customer_id) {
            return errorResponse(res, 401, 'Invalid token payload');
        }

        req.customer = decoded;
        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return errorResponse(res, 401, 'Token expired, please login again');
        }
        if (error.name === 'JsonWebTokenError') {
            return errorResponse(res, 401, 'Invalid token');
        }
        if (error.name === 'NotBeforeError') {
            return errorResponse(res, 401, 'Token not active yet');
        }
        return errorResponse(res, 500, 'Authentication failed');
    }
};