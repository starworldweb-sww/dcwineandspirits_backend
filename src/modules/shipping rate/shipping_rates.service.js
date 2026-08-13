

import { prisma } from "../../../lib/prisma.js";
import { parseMultiFlatRateSettings } from "../../utils/parseShippingSettings.js";
const evaluateRuleGroup = (rules, value) => {
  if (!rules.length) return true;

  const isRules = rules.filter((r) => r.comparison === 'is');
  const notRules = rules.filter((r) => r.comparison === 'not');

  const isMatch = isRules.length ? isRules.some((r) => r.matchValue === value) : true;
  const notMatch = notRules.length ? notRules.every((r) => r.matchValue !== value) : true;

  return isMatch && notMatch;
};

const chargeMatches = (charge, { countryId, zoneId, customerGroupId }) => {
  // group 0 = applies to all customer groups
  if (charge.group && customerGroupId !== undefined && charge.group !== customerGroupId) {
    return false;
  }

  const zoneRules = charge.rules
    .filter((r) => r.type === 'zone')
    .map((r) => ({ comparison: r.comparison, matchValue: r.zoneId }));

  const countryRules = charge.rules
    .filter((r) => r.type === 'country')
    .map((r) => ({ comparison: r.comparison, matchValue: r.countryId }));

  return evaluateRuleGroup(zoneRules, zoneId) && evaluateRuleGroup(countryRules, countryId);
};

const computePrice = (charge, quantity) =>
  charge.type === 'peritem' ? Number(charge.charge) * quantity : Number(charge.charge);

export const getPriceByLocation = async ({ countryId, zoneId, customerGroupId, quantity = 1 }) => {
  const rows = await prisma.oc_setting.findMany({
    where: { code: 'shipping_multi_flat_rate' },
  });

  const charges = parseMultiFlatRateSettings(rows);

  const matched = charges
    .filter((charge) => chargeMatches(charge, { countryId, zoneId, customerGroupId }))
    .map((charge) => ({
      chargeNum: charge.chargeNum,
      title: charge.titleCustomer,
      price: computePrice(charge, quantity),
    }));

  if (!matched.length) return null;
  const sort_matched = matched.sort((a, b) => a?.price - b?.price);

  const cheapest = matched.reduce((a, b) => (b.price < a.price ? b : a));

  return {
    price: cheapest.price,
    matchedCharge: cheapest.title,
    quantity,
    allMatches: sort_matched,
  };
};  