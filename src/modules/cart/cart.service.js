import { prisma } from '../../../lib/prisma.js';
import { parsePositiveInt } from '../../utils/parsePositiveInt.js';
import { LANGUAGE_ID } from '../../utils/producthalper.js';


const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;


const isSpecialPriceValid = (special) => {
  if (!special) return false;

  const now = new Date();
  const start = special.date_start && special.date_start !== '0000-00-00'
    ? new Date(special.date_start) : null;
  const end = special.date_end && special.date_end !== '0000-00-00'
    ? new Date(special.date_end) : null;

  if (start && now < start) return false;
  if (end && now > end) return false;

  return true;
};

const fetchProductOptions = async (productIds) => {
  const productOptions = await prisma.oc_product_option.findMany({
    where: {
      product_id: { in: productIds },

    },
  });

  if (!productOptions.length) return [];

  const optionIds = [...new Set(productOptions.map((o) => o.option_id))];
  const productOptionIds = productOptions.map((o) => o.product_option_id);

  const [optionDescriptions, options, productOptionValues] = await Promise.all([
    prisma.oc_option_description.findMany({
      where: { option_id: { in: optionIds }, language_id: LANGUAGE_ID },
      select: { option_id: true, name: true },
    }),
    prisma.oc_option.findMany({
      where: { option_id: { in: optionIds } },
      select: { option_id: true, type: true, sort_order: true },
    }),
    prisma.oc_product_option_value.findMany({
      where: { product_option_id: { in: productOptionIds } },
    }),
  ]);

  const optionValueIds = [
    ...new Set(productOptionValues.map((v) => v.option_value_id)),
  ];
  const povIds = productOptionValues.map((v) => v.product_option_value_id);

  const [optionValueDescriptions, optionValues, optionImages] = await Promise.all([
    optionValueIds.length
      ? prisma.oc_option_value_description.findMany({
        where: {
          option_value_id: { in: optionValueIds },
          language_id: LANGUAGE_ID,
        },
        select: { option_value_id: true, name: true },
      })
      : [],
    optionValueIds.length
      ? prisma.oc_option_value.findMany({
        where: { option_value_id: { in: optionValueIds } },
        select: { option_value_id: true, image: true, sort_order: true },
      })
      : [],
    povIds.length
      ? prisma.oc_product_option_image.findMany({
        where: { product_option_value_id: { in: povIds } },
        select: { product_option_value_id: true, option_image: true },
      })
      : [],
  ]);

  return productOptions
    .map((po) => {
      const option = options.find((o) => o.option_id === po.option_id);
      const optionDesc = optionDescriptions.find((d) => d.option_id === po.option_id);

      const values = productOptionValues
        .filter((v) => v.product_option_id === po.product_option_id)
        .map((v) => {
          const valDesc = optionValueDescriptions.find(
            (d) => d.option_value_id === v.option_value_id
          );
          const val = optionValues.find(
            (ov) => ov.option_value_id === v.option_value_id
          );
          const images = optionImages
            .filter(
              (img) =>
                img.product_option_value_id === v.product_option_value_id
            )
            .map((img) => img.option_image)
            .filter(Boolean);

          const priceAdjust = Number(v.price);
          const signedPrice =
            v.price_prefix === "-" ? -priceAdjust : priceAdjust;

          return {
            id: v.product_option_value_id,
            option_value_id: v.option_value_id,
            name: valDesc?.name ?? null,
            image: val?.image ?? null,
            images,
            price: priceAdjust,
            price_adjustment: signedPrice,
            price_prefix: v.price_prefix,
            quantity: v.quantity,
            subtract: v.subtract,
            weight: Number(v.weight),
            weight_prefix: v.weight_prefix,
            sort_order: val?.sort_order ?? 0,
          };
        })
        .sort((a, b) => a.sort_order - b.sort_order);

      return {
        id: po.product_option_id,
        option_id: po.option_id,
        product_id: po.product_id,
        name: optionDesc?.name ?? null,
        type: option?.type ?? null,
        required: po.required,
        sort_order: option?.sort_order ?? 0,
        value: po.value || null,
        values,
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);
};


export const addToCartService = async ({
  sessionId = '',
  customerId = 0,
  productId,
  quantity = 1,
  option = '[]',
  recurringId = 0,
}) => {
  const existing = await prisma.oc_cart.findFirst({
    where: {
      customer_id: customerId,
      session_id: sessionId,
      product_id: productId,
      option: option,
      recurring_id: recurringId,
    },
  });

  if (existing) {
    return await prisma.oc_cart.update({
      where: { cart_id: existing.cart_id },
      data: { quantity: existing.quantity + quantity },
    });
  }

  return await prisma.oc_cart.create({
    data: {
      api_id: 0,
      customer_id: customerId,
      session_id: sessionId,
      product_id: productId,
      recurring_id: recurringId,
      option: option,
      quantity: quantity,
      date_added: new Date(),
    },
  });
};

export const getCartService = async (query, { sessionId = '', customerId = 0 }) => {

  const page = parsePositiveInt(query.page, 1);
  const requestedLimit = parsePositiveInt(query.limit, DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const skip = (page - 1) * limit;

  const where =
    customerId > 0
      ? { customer_id: customerId }
      : { customer_id: 0, session_id: sessionId };

  const [cartItems, total] = await Promise.all([
    await prisma.oc_cart.findMany({
      where,
      orderBy: { date_added: 'desc' },
      skip,
      take: limit,
      include: {
        oc_product: {
          select: {
            product_id: true,
            price: true,
            image: true,
            model: true,
            quantity: true,
            status: true,
            oc_product_description: {
              where: { language_id: 1 },
              select: { name: true },
            },
            // Special price
            oc_product_special: {
              select: {
                price: true,
                date_start: true,
                date_end: true,
                priority: true,
              },
              orderBy: { priority: 'asc' },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.oc_cart.count({ where })
  ])




  const productIds = cartItems.map(item => `product_id=${item.product_id}`);
  const productIdForOption = cartItems.map((item) =>
    parseInt(item?.product_id)
  );

  const optiondata = await fetchProductOptions(productIdForOption);

  const seoUrls = await prisma.oc_seo_url.findMany({
    where: {
      query: { in: productIds },
      store_id: 0,
      language_id: 1,
    },
    select: { query: true, keyword: true }
  });

  const slugMap = {};
  seoUrls.forEach(s => {
    const id = s.query.split('product_id=')[1];
    slugMap[id] = s.keyword;
  });
  const cartItemsFormatted = cartItems.map((item) => {
    const selectedOptions = [];
    const specialData = item.oc_product.oc_product_special[0];

    const selectedOptionData = item.option
      ? JSON.parse(item.option)
      : {};

    const productOptions = optiondata.filter(
      (opt) => Number(opt.product_id) === Number(item.product_id)
    );

    Object.entries(selectedOptionData).forEach(
      ([optionId, selectedValue]) => {
        const matchedOption = productOptions.find(
          (opt) => String(opt.id) === String(optionId)
        );


        if (!matchedOption) return;

        let finalValue = selectedValue;
        let optionPrice = 0;

        // radio/select option value name nikalo
        if (matchedOption.values?.length > 0) {
          const selectedItem =
            matchedOption.values.find(
              (val) =>
                String(val.id) === String(selectedValue)
            );

          if (selectedItem) {
            finalValue = selectedItem.name;
            optionPrice = selectedItem.price_adjustment || 0;
          }
        }

        selectedOptions.push({
          option_id: matchedOption.id,
          option_name: matchedOption.name,
          value: finalValue,
          type: matchedOption.type,
          price: optionPrice,
          // For file type, add the full image URL if the value is a file path
          image_url: matchedOption.type === 'file' && finalValue
            ? `${process.env.BACKEND_URL || 'http://localhost:8000/'}${finalValue}` 
            : null
        });
      }
    );

    return {
      cart_id: item.cart_id,
      customer_id: item.customer_id,
      session_id: item.session_id,
      product_id: item.product_id,
      quantity: item.quantity,
      recurring_id: item.recurring_id,
      date_added: item.date_added,

      selected_options: selectedOptions,
      optiondata: productOptions,
      product: item.oc_product
        ? {
          product_id: item.oc_product.product_id,
          name:
            item.oc_product
              .oc_product_description[0]?.name || "",
          price: item.oc_product.price,
          special_price: isSpecialPriceValid(specialData)
            ? specialData?.price
            : null,
          image: item.oc_product.image,
          model: item.oc_product.model,
          stock: item.oc_product.quantity,
          status: item.oc_product.status,
          slug:
            slugMap[item.product_id] ?? null,
        }
        : null,
    };
  });

  return {
    total,
    items: cartItemsFormatted,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
};


export const updateCartQuantityService = async ({ cartId, quantity, option }) => {
  if (quantity <= 0) {
    return await prisma.oc_cart.delete({ where: { cart_id: cartId } });
  }

  return await prisma.oc_cart.update({
    where: { cart_id: cartId },
    data: { quantity, option: JSON.stringify(option) },
  });
};


export const removeFromCartService = async ({ cartId }) => {
  const deleted = await prisma.oc_cart.delete({ where: { cart_id: cartId } });
  return deleted;
};


export const clearCartService = async ({ sessionId = '', customerId = 0 }) => {
  if (customerId > 0) {
    return await prisma.oc_cart.deleteMany({
      where: { customer_id: customerId },
    });
  }

  return await prisma.oc_cart.deleteMany({
    where: { customer_id: 0, session_id: sessionId },
  });
};


export const mergeGuestCartService = async ({ sessionId, customerId }) => {
  if (!sessionId || !customerId || customerId === 0) return;

  const guestItems = await prisma.oc_cart.findMany({
    where: { session_id: sessionId, customer_id: 0 },
  });


  if (guestItems.length === 0) return;

  for (const item of guestItems) {
    const existing = await prisma.oc_cart.findFirst({
      where: {
        customer_id: customerId,
        product_id: item.product_id,
        option: item.option,
        recurring_id: item.recurring_id,
      },
    });

    if (existing) {
      await prisma.oc_cart.update({
        where: { cart_id: existing.cart_id },
        data: { quantity: existing.quantity + item.quantity },
      });
      await prisma.oc_cart.delete({ where: { cart_id: item.cart_id } });
    } else {
      await prisma.oc_cart.update({
        where: { cart_id: item.cart_id },
        data: {
          customer_id: customerId,
          session_id: sessionId,
        },
      });
    }
  }
};