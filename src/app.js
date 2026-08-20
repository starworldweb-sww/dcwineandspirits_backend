import express from 'express'
import cors from "cors";
import allProductRouter from './modules/products/products.routes.js';
import { notFoundMiddleware } from './middleware/notFoundMiddleware.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';
import helmet from 'helmet';
import customerRouter from './modules/customer/customer.routes.js';
import cookieParser from 'cookie-parser';
import manufacturerRouter from './modules/manufacturer/manufacturer.routes.js';
import header_category from './modules/category/header_category/header_category.routes.js';
import mobile_router from './modules/category/mobile_category/mobile_category.routes.js';
import cartRouter from './modules/cart/cart.routes.js';
import wishlistRouter from './modules/wishlish/wishlist.routes.js';
import newsletterRoter from './modules/newsletter/newsletter.routes.js';
import { getProductMeta } from './modules/meta/product_meta.controller.js';
import { getCategoriMeta } from './modules/meta/category_meta.controller.js';
import { getManufactureMeta } from './modules/meta/manufacture_meta.controller.js';
import { getBlogMeta } from './modules/meta/blog_meta.controller.js';
import customerAddressRoutes from './modules/customer Address/customerAddress.routes.js';
import checkoutRouter, { webhookRouter } from './modules/checkout/checkout.routes.js';
import shippingRouter from './modules/shipping rate/shipping_rates.routes.js';
import coupon_router from './modules/coupon/coupon.routes.js';
import orderRouter from './modules/customer order details/order.routes.js';
import blogRoute from './modules/blog/blog.routes.js';
export const createApp = () => {

    const app = express();


    const allowedOrigins = [
        "http://localhost:3000",
        // "https://www.wineandchampagnegifts.com/",
        // "https://wineandchampagnegifts.com/",
        // "https://admin.wineandchampagnegifts.com/",
        // "https://www.weddingwinegifts.com",
        // "https://weddingwinegifts.com",
        process.env.FRONTEND_URL,
    ].filter(Boolean);

    app.use(
        cors({
            origin: allowedOrigins,
            credentials: true,
        })
    );
    app.use(cookieParser())
    app.use('/stripe', webhookRouter)
    app.use(express.json());
    app.use(helmet());

    //-------------- testing url ------------------//
    app.use('/health', (_req, res) => {
        res.json({ sucess: true, message: "welcome to my server....!" })
    })


    ///--------------- route api -------------------///

    app.use('/api/v1/products', allProductRouter)
    app.use('/api/v1/customer', customerRouter)
    app.use('/api/v1/manufacturer', manufacturerRouter)
    app.use('/api/v1/header-category', header_category)
    app.use('/api/v1/mobile-category', mobile_router)
    app.use('/api/v1/cart', cartRouter)
    app.use('/api/v1/wishlist', wishlistRouter)
    app.use('/api/v1/newsletter', newsletterRoter)
    app.use('/api/v1/customer-address', customerAddressRoutes)
    app.use('/api/v1/checkout', checkoutRouter)
    app.use('/api/v1/shipping-rate',shippingRouter)
    app.use('/api/v1/coupon',coupon_router)
    app.use('/api/v1/order-details',orderRouter)
    app.use('/api/v1/blog',blogRoute)
    

    // ------------- meta api ----------------- //

    app.get("/api/v1/meta/product/:identifier", getProductMeta)
    app.get("/api/v1/meta/category/:identifier", getCategoriMeta)
    app.get("/api/v1/meta/manufacturer/:identifier", getManufactureMeta)
    app.get("/api/v1/meta/blog/:identifier", getBlogMeta)



    app.use(notFoundMiddleware);
    app.use(errorMiddleware);

    return app;
}