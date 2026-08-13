// Parses oc_setting rows for code = 'shipping_multi_flat_rate' into structured
// charge objects, mirroring what you see in the OpenCart admin UI.
//
// Input row shape (matches your oc_setting model):
//   { setting_id, store_id, code, key, value, serialized }
//
// Recognized key patterns:
//   shipping_multi_flat_rate_charge_{n}_group
//   shipping_multi_flat_rate_charge_{n}_title_admin
//   shipping_multi_flat_rate_charge_{n}_title_en-gb
//   shipping_multi_flat_rate_charge_{n}_type
//   shipping_multi_flat_rate_charge_{n}_charges
//   shipping_multi_flat_rate_charge_{n}_rule_{m}_type
//   shipping_multi_flat_rate_charge_{n}_rule_{m}_comparison
//   shipping_multi_flat_rate_charge_{n}_rule_{m}_value   -> "Maryland [3643]"
//
// Any other key (status, testing_mode, heading_en-gb, sort_order, etc.) is
// a top-level extension setting, not tied to a specific charge — ignored here.

const CHARGE_KEY_RE = /^shipping_multi_flat_rate_charge_(\d+)_(.+)$/;
const RULE_KEY_RE = /^rule_(\d+)_(type|comparison|value)$/;
const VALUE_WITH_ID_RE = /^(.*)\s\[(\d+)\]$/; // e.g. "Maryland [3643]"

const blankCharge = (chargeNum) => ({
  chargeNum,
  group: 0,
  titleAdmin: '',
  titleCustomer: '',
  type: '',
  charge: 0,
  rules: new Map(), // ruleNum -> rule
});

const blankRule = (ruleNum) => ({
  ruleNum,
  type: 'zone',
  comparison: 'is',
  zoneId: null,
  countryId: null,
  label: '',
});

export const parseMultiFlatRateSettings = (settingRows) => {
  const chargesMap = new Map();

  for (const row of settingRows) {
    const chargeMatch = row.key.match(CHARGE_KEY_RE);
    if (!chargeMatch) continue; // top-level setting, skip

    const [, chargeNumStr, rest] = chargeMatch;
    const chargeNum = Number(chargeNumStr);

    if (!chargesMap.has(chargeNum)) chargesMap.set(chargeNum, blankCharge(chargeNum));
    const charge = chargesMap.get(chargeNum);

    const ruleMatch = rest.match(RULE_KEY_RE);
    if (ruleMatch) {
      const [, ruleNumStr, field] = ruleMatch;
      const ruleNum = Number(ruleNumStr);

      if (!charge.rules.has(ruleNum)) charge.rules.set(ruleNum, blankRule(ruleNum));
      const rule = charge.rules.get(ruleNum);

      if (field === 'type') rule.type = row.value;
      if (field === 'comparison') rule.comparison = row.value;
      if (field === 'value') {
        const m = row.value?.match(VALUE_WITH_ID_RE);
        rule.label = m ? m[1] : row.value;
        const id = m ? Number(m[2]) : null;
        if (rule.type === 'zone') rule.zoneId = id;
        if (rule.type === 'country') rule.countryId = id;
      }
      continue;
    }

    switch (rest) {
      case 'group':
        charge.group = Number(row.value);
        break;
      case 'title_admin':
        charge.titleAdmin = row.value;
        break;
      case 'title_en-gb':
        charge.titleCustomer = row.value;
        break;
      case 'type':
        charge.type = row.value;
        break;
      case 'charges':
        charge.charge = Number(row.value);
        break;
      default:
        break; // unknown sub-key, ignore
    }
  }

  return Array.from(chargesMap.values())
    .sort((a, b) => a.chargeNum - b.chargeNum)
    .map((c) => ({
      ...c,
      rules: Array.from(c.rules.values()).sort((a, b) => a.ruleNum - b.ruleNum),
    }));
};