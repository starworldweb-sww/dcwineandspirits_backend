
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { changePassword, editAccountInformation, forgotPassword, login, logout, profile, register, resetPassword } from './customer.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from './customer.validation.js';
import { loginRules } from './customer.validation.js';
import { registerRules } from './customer.validation.js';



const customerRouter = Router();


const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Too many login attempts. Try again after 15 minutes.'
    }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: {
        success: false,
        message: 'Too many registrations. Try again after 1 hour.'
    }
});

// Public Routes
customerRouter.post('/login', loginRules, validate, asyncHandler(login));
customerRouter.post('/register', registerRules, validate, asyncHandler(register));
customerRouter.post('/forgot-password', asyncHandler(forgotPassword));
customerRouter.post('/reset-password', asyncHandler(resetPassword));

// Protected Route (token required)
customerRouter.post('/logout', authMiddleware, asyncHandler(logout));
customerRouter.get('/profile', authMiddleware, asyncHandler(profile));
customerRouter.put('/change-password', authMiddleware, asyncHandler(changePassword));
customerRouter.put('/edit-information', authMiddleware, asyncHandler(editAccountInformation));
export default customerRouter;