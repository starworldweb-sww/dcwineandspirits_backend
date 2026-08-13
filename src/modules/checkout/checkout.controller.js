import { prisma } from "../../../lib/prisma.js";
import { successResponse } from "../../utils/apiResponse.js";
import { createAddressServices } from "../customer Address/customerAddress.service.js";
import { registerCustomer } from "../customer/customer.service.js";
import { clearCartService } from "../cart/cart.service.js";
import { placeOrderService, _sendConfirmationEmails, } from "./checkout.service.js";
import Stripe from 'stripe';
import { DateTime } from "luxon";
import { ORDER_STATUS } from "../../utils/orderStatus.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const placeOrder = async (req, res) => {
    const body = req.body;
    const { customer, billing, shipping, payment, shippingMethod, checkoutType, payment_method } = body;

    if (!body.products || !Array.isArray(body.products) || body.products.length === 0) {
        return res.status(400).json({ success: false, message: "Products Not Found !" });
    }

    const ip =
        req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
        req.socket?.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";
    let customerDetails = null;


    if (checkoutType === 'register' && (!payment_method || payment_method.code === 'cod' || body.payment_code === 'cod')) {
        customerDetails = await prisma.oc_customer.findFirst({
            where: { email: customer?.email }
        });

        if (!customerDetails) {
            await registerCustomer(customer, ip);
            customerDetails = await prisma.oc_customer.findFirst({
                where: { email: customer?.email }
            });
        }

        if (body.payment_country_id && body.payment_zone_id && customerDetails) {
            try {
                const addressData = {
                    firstname: body.payment_firstname,
                    lastname: body.payment_lastname,
                    company: body.payment_company || "",
                    address_1: body.payment_address_1,
                    address_2: body.payment_address_2 || "",
                    city: body.payment_city,
                    postcode: body.payment_postcode || " ",
                    country_id: parseInt(body.payment_country_id),
                    zone_id: parseInt(body.payment_zone_id),
                    custom_field: body.payment_custom_field || "",
                };
                await createAddressServices(customerDetails.customer_id, addressData);
            } catch (addrErr) {
                console.log("Failed to create address for COD register user, continuing order:", addrErr.message);
            }
        }
    }

    const result = await placeOrderService({
        customer_id: customerDetails?.customer_id ?? customer?.id ?? body.customer_id ?? 0,
        customer_group_id: customer?.group_id ?? body.customer_group_id ?? 1,
        firstname: customer?.firstname ?? body.firstname ?? body.payment_firstname,
        lastname: customer?.lastname ?? body.lastname ?? body.payment_lastname,
        email: customer?.email ?? body.email,
        telephone: customer?.telephone ?? body.telephone,
        custom_field: customer?.custom_field ?? body.custom_field ?? {},

        payment_firstname: billing?.firstname ?? body.payment_firstname,
        payment_lastname: billing?.lastname ?? body.payment_lastname,
        payment_company: billing?.company ?? body.payment_company ?? "",
        payment_address_1: billing?.address_1 ?? body.payment_address_1,
        payment_address_2: billing?.address_2 ?? body.payment_address_2 ?? "",
        payment_city: billing?.city ?? body.payment_city,
        payment_postcode: billing?.postcode ?? body.payment_postcode ?? "",
        payment_zone: billing?.zone ?? body.payment_zone,
        payment_zone_id: billing?.zone_id ?? body.payment_zone_id,
        payment_country: billing?.country ?? body.payment_country,
        payment_country_id: billing?.country_id ?? body.payment_country_id,
        payment_address_format: billing?.address_format ?? body.payment_address_format ?? "",
        payment_custom_field: billing?.custom_field ?? body.payment_custom_field ?? {},
        payment_method: payment?.method ?? body.payment_method,
        payment_code: payment?.code ?? body.payment_code,

        shipping_firstname: shipping?.firstname ?? body.shipping_firstname ?? "",
        shipping_lastname: shipping?.lastname ?? body.shipping_lastname ?? "",
        shipping_company: shipping?.company ?? body.shipping_company ?? "",
        shipping_address_1: shipping?.address_1 ?? body.shipping_address_1 ?? "",
        shipping_address_2: shipping?.address_2 ?? body.shipping_address_2 ?? "",
        shipping_city: shipping?.city ?? body.shipping_city ?? "",
        shipping_postcode: shipping?.postcode ?? body.shipping_postcode ?? "",
        shipping_zone: shipping?.zone ?? body.shipping_zone ?? "",
        shipping_zone_id: shipping?.zone_id ?? body.shipping_zone_id ?? 0,
        shipping_country: shipping?.country ?? body.shipping_country ?? "",
        shipping_country_id: shipping?.country_id ?? body.shipping_country_id ?? 0,
        shipping_address_format: shipping?.address_format ?? body.shipping_address_format ?? "",
        shipping_custom_field: shipping?.custom_field ?? body.shipping_custom_field ?? {},
        shipping_method: shippingMethod?.name ?? body.shipping_method ?? "",
        shipping_code: shippingMethod?.code ?? body.shipping_code ?? "",
        shipping_cost: shippingMethod?.cost ?? body.shipping_cost ?? 0,

        products: body.products,
        totals: body.totals ?? null,
        comment: body.comment ?? "",
        language_id: body.language_id ?? 1,
        currency_id: body.currency_id ?? 1,
        currency_code: body.currency_code ?? "USD",
        currency_value: body.currency_value ?? 1.0,
        ip,

        stripe_payment_intent_id: body.stripe_payment_intent_id ?? null,
        stripe_client_secret: body.stripe_client_secret ?? null,
        missing_order_id: body.missing_order_id ?? null,
        checkoutType,
        registerData: customer,
        addressData: {
            firstname: body.payment_firstname,
            lastname: body.payment_lastname,
            company: body.payment_company || "",
            address_1: body.payment_address_1,
            address_2: body.payment_address_2 || "",
            city: body.payment_city,
            postcode: body.payment_postcode || " ",
            country_id: parseInt(body.payment_country_id) || 0,
            zone_id: parseInt(body.payment_zone_id) || 0,
            custom_field: body.payment_custom_field || "",
        },
        coupon_id: body?.coupon_id,
        discountAmount: body?.discountAmount,
        user_agent:userAgent
    });

    const shouldClearCart =
        body.payment_code === 'cod' ||
        !!body.stripe_payment_intent_id;

    if (shouldClearCart) {
        try {
            const clearCustomerId = customerDetails?.customer_id ?? customer?.id ?? body.customer_id ?? req.customer?.customer_id ?? 0;
            const clearSessionId = req.cookies?.guest_session || '';
            await clearCartService({ sessionId: clearSessionId, customerId: clearCustomerId });
        } catch (clearErr) {
            console.error("Failed to clear cart after order:", clearErr.message);
        }
    }

    return res.status(201).json({
        success: true,
        message: "Order placed successfully",
        data: {
            order_id: result.order_id,
            total: result.total,
            stripe_client_secret: result.stripe_client_secret ?? null,
            stripe_payment_intent_id: result.stripe_payment_intent_id ?? null,
            customer: customerDetails ? {
                customer_id: customerDetails.customer_id,
                firstname: customerDetails.firstname,
                lastname: customerDetails.lastname,
                email: customerDetails.email,
                telephone: customerDetails.telephone,
            } : null,
        },
    });
};

export const createPaymentIntent = async (req, res) => {
    const { amount, currency = 'usd', customer_email, customer_name } = req.body;

    if (!amount) {
        return res.status(400).json({ success: false, message: "Amount is required" });
    }

    let stripeCustomerId;
    if (customer_email) {
        const existing = await stripe.customers.list({ email: customer_email, limit: 1 });
        if (existing.data.length > 0) {
            stripeCustomerId = existing.data[0].id;
        } else {
            const newCustomer = await stripe.customers.create({
                email: customer_email,
                name: customer_name || '',
            });
            stripeCustomerId = newCustomer.id;
        }
    }

    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency,
        customer: stripeCustomerId,
        receipt_email: customer_email,
        description: `Wine & Champagne Gifts: Order (${customer_name || customer_email})`,
        metadata: {
            customer_email: customer_email || "",
            customer_name: customer_name || "",
            website: "Wine & Champagne Gifts",
        },
        automatic_payment_methods: { enabled: true },
    });

    return res.status(200).json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
    });
};

export const handleWebhook = async (req, res) => {

    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object;
            const orderId = paymentIntent.metadata.order_id;

            if (orderId) {
                try {
                    const order = await prisma.oc_order.findUnique({
                        where: { order_id: parseInt(orderId) },
                        include: {
                            oc_order_product: {
                                include: { oc_order_option: true }
                            },
                            oc_order_total: true
                        }
                    });

                    if (!order) break;
                    if (order.order_status_id === ORDER_STATUS.PROCESSED) break;

                    // const newYorkTime = DateTime.now().setZone("America/New_York").toJSDate();
                    const newYorkTime = DateTime.now()
                        .setZone("America/New_York")
                        .toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
                    let checkoutType, registerData, addressData, ip;
                    try {
                        const customFieldData = JSON.parse(order.custom_field || "{}");
                        if (customFieldData.checkoutData) {
                            checkoutType = customFieldData.checkoutData.checkoutType;
                            registerData = customFieldData.checkoutData.registerData;
                            addressData = customFieldData.checkoutData.addressData;
                            ip = customFieldData.checkoutData.ip;
                        }
                    } catch (e) {
                        console.log("Could not parse checkout data from custom field:", e.message);
                    }

                    const customerDetails = await handlePostPaymentRegistration(parseInt(orderId), checkoutType, registerData, addressData, ip);

                    await prisma.oc_order.update({
                        where: { order_id: parseInt(orderId) },
                        data: {
                            order_status_id: ORDER_STATUS.PROCESSED,
                            date_modified: newYorkTime
                        }
                    });

                    await prisma.oc_order_history.create({
                        data: {
                            order_id: parseInt(orderId),
                            order_status_id: ORDER_STATUS.PROCESSED,
                            notify: true,
                            comment: "The card transaction was authorized and subsequently captured (i.e., completed).",
                            date_added: newYorkTime
                        }
                    });

                    const products = order.oc_order_product.map(op => ({
                        product_id: op.product_id,
                        name: op.name,
                        model: op.model,
                        quantity: op.quantity,
                        price: op.price,
                        total: op.total,
                        tax: op.tax,
                        reward: op.reward,
                        options: op.oc_order_option.map(oo => ({
                            option_id: oo.product_option_id,
                            option_value_id: oo.product_option_value_id,
                            option_name: oo.name,
                            value: oo.value,
                            type: oo.type
                        }))
                    }));

                    const builtTotals = order.oc_order_total.map(ot => ({
                        code: ot.code,
                        title: ot.title,
                        value: ot.value,
                        sort_order: ot.sort_order
                    }));

                    await _sendConfirmationEmails({
                        result: { order_id: order.order_id, total: order.total },
                        firstname: order.firstname,
                        lastname: order.lastname,
                        email: order.email,
                        newYorkTime,
                        products,
                        builtTotals,
                        shipping_firstname: order.shipping_firstname,
                        shipping_lastname: order.shipping_lastname,
                        shipping_address_1: order.shipping_address_1,
                        shipping_address_2: order.shipping_address_2,
                        shipping_city: order.shipping_city,
                        shipping_zone: order.shipping_zone,
                        shipping_postcode: order.shipping_postcode,
                        shipping_country: order.shipping_country,
                        shipping_method: order.shipping_method,
                        payment_method: order.payment_method,
                        payment_firstname: order.payment_firstname,
                        payment_lastname: order.payment_lastname,
                        payment_address_1: order.payment_address_1,
                        payment_city: order.payment_city,
                        payment_zone: order.payment_zone,
                        payment_country: order.payment_country,
                        comment: order.comment
                    });

                    if (order.customer_id > 0) {
                        try {
                            await clearCartService({ sessionId: '', customerId: order.customer_id });
                        } catch (clearErr) {
                            console.error("Failed to clear cart in webhook:", clearErr.message);
                        }
                    }
                } catch (err) {
                    console.error("Error processing payment_intent.succeeded webhook:", err);
                }
            }
            break;
        }

        case 'payment_intent.payment_failed': {
            break;
        }

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
};