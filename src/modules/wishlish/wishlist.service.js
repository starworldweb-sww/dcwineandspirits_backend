import { query } from 'express-validator';
import { prisma } from '../../../lib/prisma.js';
import { parsePositiveInt } from '../../utils/parsePositiveInt.js';


const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;

export const addToWishlistService = async ({ customerId, productId }) => {

  const existing = await prisma.oc_customer_wishlist.findUnique({
    where: {
      customer_id_product_id: {
        customer_id: customerId,
        product_id: productId,
      },
    },
  });

  if (existing) {
    return { already_exists: true, data: existing };
  }

  const item = await prisma.oc_customer_wishlist.create({
    data: {
      customer_id: customerId,
      product_id: productId,
      date_added: new Date(),
    },
  });

  return { already_exists: false, data: item };
};


export const getWishlistService = async (query,{ customerId, LANGUAGE_ID = 1 }) => {

  const page = parsePositiveInt(query.page, 1);
  const requestedLimit = parsePositiveInt(query.limit, DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    await prisma.oc_customer_wishlist.findMany({
      where: { customer_id: customerId },
      orderBy: { date_added: 'desc' },
      skip,
      take: limit,
      include: {    
        oc_product: {
          select: {
            product_id: true,
            price: true,
            image: true,
            status: true,
            quantity: true,
            model:true,
            oc_product_description: {
              where: { language_id: LANGUAGE_ID },
              select: { name: true },
            },
            oc_product_special: {
              select: {
                price: true,
                date_start: true,
                date_end: true,
                priority: true,
              },
              orderBy: { priority: 'asc' },
              take: 1,
            }
          }
        }
      }
    }),
    prisma.oc_customer_wishlist.count({
      where: { customer_id: customerId },
    }),
  ])

  const productIds = items.map(item => `product_id=${item.product_id}`);
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
  
  

  const formattedItems = items.map(item => ({
    product_id: item.product_id,
    model: item.oc_product?.model,
    date_added: item.date_added,
    name: item.oc_product?.oc_product_description?.[0]?.name ?? null,
    price: item.oc_product?.price ?? null,
    spacial_price:item.oc_product?.oc_product_special?.[0]?.price ?? null,
    image: item.oc_product?.image ?? null,
    status: item.oc_product?.status ?? null,
    in_stock: (item.oc_product?.quantity ?? 0) > 0,
    slug: slugMap[item.product_id] ?? null,
  }));


  console.log(formattedItems)

  return {
    total,
    page,
    limit,
    items: formattedItems,
    totalPages: Math.ceil(total / limit),
  };
} 
 


export const removeFromWishlistService = async ({ customerId, productId }) => {

  const deleted = await prisma.oc_customer_wishlist.delete({
    where: {
      customer_id_product_id: {
        customer_id: customerId,
        product_id: productId,
      },
    },
  });
  return deleted;
};


export const isInWishlistService = async ({ customerId, productId }) => {
  if (!customerId || customerId === 0) return false;

  const item = await prisma.oc_customer_wishlist.findUnique({
    where: {
      customer_id_product_id: {
        customer_id: customerId,
        product_id: productId,
      },
    },
  });

  return !!item;
};


export const clearWishlistService = async ({ customerId }) => {
  return await prisma.oc_customer_wishlist.deleteMany({
    where: { customer_id: customerId },
  });
};

export const mergeGuestWishlistService = async ({ customerId, guestProductIds = [] }) => {
  if (!customerId || guestProductIds.length === 0) return;

  for (const productId of guestProductIds) {
    await prisma.oc_customer_wishlist.upsert({
      where: {
        customer_id_product_id: {
          customer_id: customerId,
          product_id: productId,
        },
      },
      update: {},
      create: {
        customer_id: customerId,
        product_id: productId,
        date_added: new Date(),
      },
    });
  }
};