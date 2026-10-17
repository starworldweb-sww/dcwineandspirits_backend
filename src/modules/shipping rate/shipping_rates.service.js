

import { prisma } from "../../../lib/prisma.js";
import { parseMultiFlatRateSettings } from "../../utils/parseShippingSettings.js";
const SAME_DAY_ZONE_ID = 3624;
const SAME_DAY_POSTCODE_MIN = 90001;
const SAME_DAY_POSTCODE_MAX = 90101;
const SAME_DAY_CATEGORY_SLUG = "los-angeles";
const LANGUAGE_ID = 1;
const STORE_ID = 0;

const isSameDayTitle = (title) => /same day/i.test(title || "");
console.log("SAME_DAY_ZONE_ID", SAME_DAY_ZONE_ID, SAME_DAY_POSTCODE_MIN, SAME_DAY_POSTCODE_MAX, SAME_DAY_CATEGORY_SLUG);
let cachedCategoryId = null;
const getSameDayCategoryId = async () => {
  if (cachedCategoryId) return cachedCategoryId;

  const rows = await prisma.oc_seo_url.findMany({
    where: {
      keyword: SAME_DAY_CATEGORY_SLUG,
      store_id: STORE_ID,
      language_id: LANGUAGE_ID,
    },
    select: { query: true },
  });
   console.log("rows", rows);
  const row = rows.find((r) => r.query.startsWith("category_id="));
  const id = row ? parseInt(row.query.split("=")[1], 10) : null;
  if (id) cachedCategoryId = id;
  return id;
};

export const isSameDayEligible = async ({ zoneId, postcode, productIds = [] }) => {
  if (Number(zoneId) !== SAME_DAY_ZONE_ID) return false;

  const pc = parseInt(String(postcode || "").trim().slice(0, 5), 10);
  if (isNaN(pc) || pc < SAME_DAY_POSTCODE_MIN || pc > SAME_DAY_POSTCODE_MAX) return false;
  if (!productIds.length) return false;

  const categoryId = await getSameDayCategoryId();
  if (!categoryId) return false;

  const paths = await prisma.oc_category_path.findMany({
    where: { path_id: categoryId },
    select: { category_id: true },
  });
  const categoryIds = paths.map((p) => p.category_id);
  if (!categoryIds.length) return false;

  const links = await prisma.oc_product_to_category.findMany({
    where: { product_id: { in: productIds }, category_id: { in: categoryIds } },
    select: { product_id: true },
  });

  const allowed = new Set(links.map((l) => l.product_id));
  return productIds.every((id) => allowed.has(id));
};
const evaluateRuleGroup = (rules, value) => {
  if (!rules.length) return true;

  const isRules = rules.filter((r) => r.comparison === 'is');
  const notRules = rules.filter((r) => r.comparison === 'not');

  const isMatch = isRules.length ? isRules.some((r) => r.matchValue === value) : true;
  const notMatch = notRules.length ? notRules.every((r) => r.matchValue !== value) : true;

  return isMatch && notMatch;
};

const chargeMatches = (charge, { countryId, zoneId, customerGroupId }) => {

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

export const getPriceByLocation = async ({
  countryId, zoneId, customerGroupId, quantity = 1, postcode, productIds = [],
}) => {
  const rows = await prisma.oc_setting.findMany({
    where: { code: 'shipping_multi_flat_rate' },
  });

  const charges = parseMultiFlatRateSettings(rows);
  const sameDayAllowed = await isSameDayEligible({ zoneId, postcode, productIds });

  const matched = charges
    .filter((charge) => chargeMatches(charge, { countryId, zoneId, customerGroupId }))
    .map((charge) => ({
      chargeNum: charge.chargeNum,
      title: charge.titleCustomer,
      price: computePrice(charge, quantity),
    }))
    .filter((c) => {
      if (Number(zoneId) !== SAME_DAY_ZONE_ID) return true;
      return sameDayAllowed || !isSameDayTitle(c.title);
    });

  if (!matched.length) return null;

  const sort_matched = matched.sort((a, b) => a.price - b.price);
  const cheapest = sort_matched[0];

  return {
    price: cheapest.price,
    matchedCharge: cheapest.title,
    quantity,
    sameDayAllowed,
    allMatches: sort_matched,
  };
};  