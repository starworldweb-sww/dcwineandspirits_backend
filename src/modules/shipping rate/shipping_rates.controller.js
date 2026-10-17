
import { getPriceByLocation } from "./shipping_rates.service.js";

export const getShippingPrice = async (req, res) => {
  const { countryId, zoneId, customerGroupId, quantity, postcode, productIds } = req.query;

  if (!countryId && !zoneId) {
    return res.status(400).json({ success: false, message: 'countryId or zoneId is required' });
  }

  const productIdList = [
    ...new Set(
      String(productIds || "")
        .split(",")
        .map((v) => parseInt(v.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
  const result = await getPriceByLocation({
    countryId: countryId ? Number(countryId) : undefined,
    zoneId: zoneId ? Number(zoneId) : undefined,
    customerGroupId: customerGroupId ? Number(customerGroupId) : undefined,
    quantity: quantity ? Number(quantity) : 1,
    postcode: postcode ? String(postcode) : "",
    productIds: productIdList,
  });

  if (!result) {
    return res.status(404).json({ success: false, message: 'No shipping rate found for this location' });
  }

  return res.status(200).json({ success: true, ...result });
};