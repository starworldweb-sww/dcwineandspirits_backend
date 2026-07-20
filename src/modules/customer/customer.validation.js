import { body, validationResult } from 'express-validator';
import { errorResponse } from '../../utils/apiResponse.js';


export const loginRules = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email'),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];


export const registerRules = [
    body('firstname')
        .trim()
        .notEmpty().withMessage('First name is required')
        .isLength({ max: 32 }).withMessage('Max 32 characters allowed'),

    body('lastname')
        .trim()
        .notEmpty().withMessage('Last name is required'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email'),

    body('telephone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .isMobilePhone().withMessage('Enter a valid phone number'),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];


export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return errorResponse(res, 422, 'Validation failed', errors.array());
    }
    next();
}
