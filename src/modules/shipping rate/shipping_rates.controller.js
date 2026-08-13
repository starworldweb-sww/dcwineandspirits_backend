import { getPriceByLocation } from "./shipping_rates.service.js";
import { successResponse, errorResponse } from "../../utils/apiResponse.js";


export const getShippingPrice = async (req, res) => {
  const { countryId, zoneId, customerGroupId, quantity } = req.query;

  if (!countryId && !zoneId) {
    return errorResponse(res, 400, 'countryId or zoneId is required');
  }

  const result = await getPriceByLocation({
    countryId: countryId ? Number(countryId) : undefined,
    zoneId: zoneId ? Number(zoneId) : undefined,
    customerGroupId: customerGroupId ? Number(customerGroupId) : undefined,
    quantity: quantity ? Number(quantity) : 1,
  });

  if (!result) {
    return errorResponse(res, 404, 'No shipping rate found for this location');
  }

  return successResponse(res, 200, 'Shipping rates fetched successfully', result);
};