
import { env } from '../../config/envConfig.js';
import { successResponse, errorResponse } from '../../utils/apiResponse.js';
import { accountInformationService, changePasswordService, forgotPasswordRequestService, getProfile, loginCustomer, registerCustomer, resetPasswordService, } from './customer.service.js';


export const login = async (req, res) => {

    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '0.0.0.0';
    const { token, customer } = await loginCustomer(req.body, ip, req.cookies);


    res.cookie('token', token, {
        httpOnly: true,
        secure: env.nodeEnv === 'production',
        sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
        domain: env.nodeEnv === 'production' ? '.wineandchampagnegifts.com' : undefined,
        maxAge: 7 * 24 * 60 * 60 * 1000
    })

    return successResponse(res, 200, 'Login successful', customer);

}

export const register = async (req, res) => {

    const { captchaToken, ...rest } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '0.0.0.0';
    const result = await registerCustomer(rest, ip);
    return successResponse(res, 201, 'Registration successful', result);
}

export const profile = async (req, res) => {

    const data = await getProfile(req.customer.customer_id);
    return successResponse(res, 200, 'Profile fetched', data);

}

export const changePassword = async (req, res) => {
    const result = await changePasswordService(req.customer.customer_id, req.body);
    res.json(result);;
}


export const forgotPassword = async (req, res) => {

    const { email } = req.body;
    if (!email) return errorResponse(res, 400, 'Email is required');
    const data = await forgotPasswordRequestService(email);
    return successResponse(res, 200, 'Reset link sent', data);

};


export const resetPassword = async (req, res) => {

    const { code, new_password } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '0.0.0.0';
    if (!code) return errorResponse(res, 400, 'Reset code is required');
    if (!new_password) return errorResponse(res, 400, 'New password is required');
    if (new_password.length < 6) {
        return errorResponse(res, 400, 'Password must be at least 6 characters');
    }

    const data = await resetPasswordService(code, new_password,ip);
    return successResponse(res, 200, 'Password reset successfully', data);


};

export const editAccountInformation = async (req, res) => {

    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '0.0.0.0';
    const customer_id = req.customer?.customer_id ;
    const result = await accountInformationService(customer_id, req.body,ip);
    const { firstname, lastname, email, telephone } = result;
    return successResponse(res, 200, 'Account information updated successfully', { firstname, lastname, email, telephone });
}

export const logout = async (req, res) => {
    const cookiesToClear = ['token', 'guest_wishlist', 'guest_session'];

    const cookieOptions = {
        httpOnly: true,
        secure: env.nodeEnv === 'production',
        sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
        domain: env.nodeEnv === 'production' ? '.wineandchampagnegifts.com' : undefined,
    };

    cookiesToClear.forEach(cookieName => {
        res.clearCookie(cookieName, cookieOptions);
    });

    return successResponse(res, 200, 'Logout successful');
}


