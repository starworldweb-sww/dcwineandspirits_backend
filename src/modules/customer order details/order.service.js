import { prisma } from "../../../lib/prisma.js";
import { parsePositiveInt } from "../../utils/parsePositiveInt.js";



const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;



export const orderhistoryservice = async (data) => {
    const page = parsePositiveInt(data.query?.page, 1);
    const requestedLimit = parsePositiveInt(data.query?.limit, DEFAULT_LIMIT);
    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const currentCustomer = data.customer;
    const where = { customer_id: currentCustomer.customer_id };

    const [customerOrderHistory, total] = await Promise.all([
        prisma.oc_order.findMany({
            where,
            skip,
            take: limit,
            orderBy: { date_added: 'desc' },
            select: {
                order_id: true,
                firstname: true,
                lastname: true,
                total: true,
                date_added: true,
                oc_order_history: {
                    select: { order_status_id: true },
                    orderBy: { date_added: 'asc' },
                    take: 1
                },
                oc_order_tracking: {
                    select: {
                        tracking_number: true,
                        shipingcompany: true
                    }
                },
                _count: {
                    select: { oc_order_product: true }
                }
            }
        }),
        prisma.oc_order.count({ where })
    ]);

    const statusIds = customerOrderHistory
        .map(o => o.oc_order_history[0]?.order_status_id)
        .filter(Boolean);

    const statuses = await prisma.oc_order_status.findMany({
        where: { order_status_id: { in: statusIds }, language_id: 1 },
        select: { order_status_id: true, name: true }
    });

    const statusMap = Object.fromEntries(statuses.map(s => [s.order_status_id, s.name]));

    const COH = customerOrderHistory.map(order => ({
        order_id: order.order_id,
        firstname: order.firstname,
        lastname: order.lastname,
        total: order.total,
        date_added: order.date_added,
        status: statusMap[order.oc_order_history[0]?.order_status_id] || 'Unknown',
        tracking: order.oc_order_tracking,
        total_products: order._count.oc_order_product
    }));

    return {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        data: COH
    };
};


export const CustomerOrderDetailsByOrderIdServices = async (orderid) => {

    const [order, productDetails, orderOptions] = await Promise.all([
        prisma.oc_order.findFirst({
            where: { order_id: Number(orderid) },
            select: {
                order_id: true,
                payment_method: true,
                shipping_method: true,
                date_added: true,
                comment: true,

                payment_firstname: true,
                payment_lastname: true,
                payment_address_1: true,
                payment_address_2: true,
                payment_city: true,
                payment_zone: true,
                payment_country_id: true,
                payment_postcode: true,
                payment_country: true,

                shipping_firstname: true,
                shipping_lastname: true,
                shipping_address_1: true,
                shipping_address_2: true,
                shipping_city: true,
                shipping_zone: true,
                shipping_country_id: true,
                shipping_postcode: true,
                shipping_country: true,

                oc_order_total: {
                    select: { code: true, title: true, value: true },
                    orderBy: { sort_order: 'asc' }
                },


                oc_order_history: {
                    select: {
                        order_status_id: true,
                        date_added: true,
                        comment: true,
                        notify:true
                    },
                    orderBy: { date_added: 'asc' }
                }
            }
        }),

        prisma.oc_order_product.findMany({
            where: { order_id: Number(orderid) },
            select: {
                order_product_id: true,
                name: true,
                model: true,
                quantity: true,
                price: true,
                total: true,
                product_id: true
            }
        }),

        prisma.oc_order_option.findMany({
            where: { order_id: Number(orderid) },
            select: {
                order_product_id: true,
                name: true,
                value: true,
                type: true,
            }
        })
    ]);


    if (!order) throw new Error('Order not found');


    const statusIds = [...new Set(
        order.oc_order_history.map(h => h.order_status_id)
    )];


    const statuses = await prisma.oc_order_status.findMany({
        where: { order_status_id: { in: statusIds }, language_id: 1 },
        select: { order_status_id: true, name: true },
    });

    const statusMap = Object.fromEntries(statuses.map(s => [s.order_status_id, s.name]));

    const productID = productDetails.map((p) => parseInt(p?.product_id))
    const slug = await prisma.oc_seo_url.findFirst({
        where: {
            query: `product_id=${productID}`
        },
        select: {
            keyword: true
        }
    })
    const productsWithOpts = productDetails.map(product => ({
        ...product,
        options: orderOptions.filter(opt => opt.order_product_id === product.order_product_id),
        slug:slug?.keyword
    }));

    return {
        order_details: {
            order_id: order.order_id,
            payment_method: order.payment_method,
            shipping_method: order.shipping_method,
            date_added: order.date_added,
            comment: order.comment,
        },
        payment_address: {
            firstname: order.payment_firstname,
            lastname: order.payment_lastname,
            address_1: order.payment_address_1,
            address_2: order.payment_address_2,
            city: order.payment_city,
            zone: order.payment_zone,
            postcode: order.payment_postcode,
            country: order.payment_country,
        },
        shipping_address: {
            firstname: order.shipping_firstname,
            lastname: order.shipping_lastname,
            address_1: order.shipping_address_1,
            address_2: order.shipping_address_2,
            city: order.shipping_city,
            zone: order.shipping_zone,
            postcode: order.shipping_postcode,
            country: order.shipping_country,
        },
        products: productsWithOpts,
        totals: order.oc_order_total,


        order_history: order.oc_order_history.filter((o)=> o?.notify === true || o?.notify === "true").map(h => ({
            status: statusMap[h.order_status_id] || 'Unknown',
            comment: h.comment,
            date_added: h.date_added,
        }))
    };
};

export const trackOrderService = async (data) => {
  const { order_id, email } = data;
  
  if (!order_id || !email) {
    throw new Error('Order ID and Email are required');
  }

  const [order, productDetails, orderOptions, orderTracking] = await Promise.all([
    prisma.oc_order.findFirst({
      where: { 
        order_id: Number(order_id),
        email: email.trim().toLowerCase()
      },
      select: {
        order_id: true,
        payment_method: true,
        shipping_method: true,
        date_added: true,
        comment: true,
        order_status_id: true,

        payment_firstname: true,
        payment_lastname: true,
        payment_address_1: true,
        payment_address_2: true,
        payment_city: true,
        payment_zone: true,
        payment_country_id: true,
        payment_postcode: true,
        payment_country: true,

        shipping_firstname: true,
        shipping_lastname: true,
        shipping_address_1: true,
        shipping_address_2: true,
        shipping_city: true,
        shipping_zone: true,
        shipping_country_id: true,
        shipping_postcode: true,
        shipping_country: true,

        oc_order_total: {
          select: { code: true, title: true, value: true },
          orderBy: { sort_order: 'asc' }
        },

        oc_order_history: {
          select: {
            order_status_id: true,
            date_added: true,
            comment: true,
          },
          orderBy: { date_added: 'desc' },
          take: 1
        }
      }
    }),

    prisma.oc_order_product.findMany({
      where: { order_id: Number(order_id) },
      select: {
        order_product_id: true,
        name: true,
        model: true,
        quantity: true,
        price: true,
        total: true,
        product_id: true
      }
    }),

    prisma.oc_order_option.findMany({
      where: { order_id: Number(order_id) },
      select: {
        order_product_id: true,
        name: true,
        value: true,
        type: true,
      }
    }),

    prisma.oc_order_tracking.findMany({
      where: { order_id: Number(order_id) },
      select: {
        tracking_number: true,
        shipingcompany: true
      }
    })
  ]);

  if (!order) {
    throw new Error('No order found with the provided Order ID and Email');
  }

  // Get current status
  const currentStatusId = order.order_status_id;
  const statusResult = await prisma.oc_order_status.findFirst({
    where: { order_status_id: currentStatusId, language_id: 1 },
    select: { name: true }
  });

  const productID = productDetails.map((p) => parseInt(p?.product_id));
  const slug = await prisma.oc_seo_url.findFirst({
    where: {
      query: `product_id=${productID}`
    },
    select: {
      keyword: true
    }
  });
  
  const productsWithOpts = productDetails.map(product => ({
    ...product,
    options: orderOptions.filter(opt => opt.order_product_id === product.order_product_id),
    slug: slug?.keyword
  }));

  // Get tracking link based on shipping company
  const getTrackingLink = (trackingNumber, shippingCompany) => {
    if (!trackingNumber) return null;
    const company = shippingCompany?.toLowerCase() || '';
    if (company.includes('ups')) {
      return `https://www.ups.com/track?loc=en_US&tracknum=${trackingNumber}`;
    } else if (company.includes('fedex')) {
      return `https://www.fedex.com/fedextrack/?tracknumbers=${trackingNumber}`;
    } else if (company.includes('usps')) {
      return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`;
    } else if (company.includes('dhl')) {
      return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${trackingNumber}`;
    }
    return null;
  };

  const currentTracking = orderTracking[0];
  const trackingLink = currentTracking ? getTrackingLink(currentTracking.tracking_number, currentTracking.shipingcompany) : null;

  return {
    order_details: {
      order_id: order.order_id,
      payment_method: order.payment_method,
      shipping_method: order.shipping_method,
      date_added: order.date_added,
      comment: order.comment,
      current_status: statusResult?.name || 'Unknown'
    },
    payment_address: {
      firstname: order.payment_firstname,
      lastname: order.payment_lastname,
      address_1: order.payment_address_1,
      address_2: order.payment_address_2,
      city: order.payment_city,
      zone: order.payment_zone,
      postcode: order.payment_postcode,
      country: order.payment_country,
    },
    shipping_address: {
      firstname: order.shipping_firstname,
      lastname: order.shipping_lastname,
      address_1: order.shipping_address_1,
      address_2: order.shipping_address_2,
      city: order.shipping_city,
      zone: order.shipping_zone,
      postcode: order.shipping_postcode,
      country: order.shipping_country,
    },
    tracking: currentTracking ? {
      tracking_number: currentTracking.tracking_number,
      shipping_company: currentTracking.shipingcompany,
      tracking_link: trackingLink
    } : null,
    products: productsWithOpts,
    totals: order.oc_order_total,
    order_history: order.oc_order_history.map(h => ({
      status: statusResult?.name || 'Unknown',
      comment: h.comment,
      date_added: h.date_added,
    }))
  };
};