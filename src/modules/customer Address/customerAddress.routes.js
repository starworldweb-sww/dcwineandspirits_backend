import { Router } from 'express';
import { createAddress, deleteAddress, getAddress, getAddresses, getCountries, getZones, updateAddress } from './customerAddress.controller.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { addressValidation, updateValidation } from '../../utils/addressValidation.js';



const customerAddressRoutes = Router();

customerAddressRoutes.get('/countries', asyncHandler(getCountries));
customerAddressRoutes.get('/zones/:countryId', asyncHandler(getZones));
customerAddressRoutes.get('/',  authMiddleware, asyncHandler(getAddresses));
customerAddressRoutes.post('/create-address', addressValidation,  authMiddleware, asyncHandler(createAddress));
customerAddressRoutes.get('/:addressId',  authMiddleware, asyncHandler(getAddress));
customerAddressRoutes.put('/:addressId', updateValidation,  authMiddleware, asyncHandler(updateAddress));
customerAddressRoutes.delete('/delete/:addressId',  authMiddleware, asyncHandler(deleteAddress));

export default customerAddressRoutes;