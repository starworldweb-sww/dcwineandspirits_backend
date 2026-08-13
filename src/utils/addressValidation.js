import { body } from "express-validator";

 export const addressValidation = [
  body('firstname')  .notEmpty().withMessage('Firstname is required').isLength({ max: 32 }),
  body('lastname')   .notEmpty().withMessage('Lastname is required').isLength({ max: 32 }),
  body('address_1')  .notEmpty().withMessage('Address line 1 is required').isLength({ max: 128 }),
  body('city')       .notEmpty().withMessage('City is required').isLength({ max: 128 }),
  body('postcode')   .notEmpty().withMessage('Postcode is required').isLength({ max: 10 }),
  body('country_id') .notEmpty().withMessage('Country is required').isInt({ min: 1 }),
  body('zone_id')    .notEmpty().withMessage('Zone/State is required').isInt({ min: 1 }),
];

 export const updateValidation = [
  body('firstname')  .optional().isLength({ max: 32 }),
  body('lastname')   .optional().isLength({ max: 32 }),
  body('address_1')  .optional().isLength({ max: 128 }),
  body('city')       .optional().isLength({ max: 128 }),
  body('postcode')   .optional().isLength({ max: 10 }),
  body('country_id') .optional().isInt({ min: 1 }),
  body('zone_id')    .optional().isInt({ min: 1 }),
];