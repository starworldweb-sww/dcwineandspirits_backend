import express from 'express'
import allProductRouter from './modules/products/products.routes.js';
import { notFoundMiddleware } from './middleware/notFoundMiddleware.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';
import helmet from 'helmet';
import customerRouter from './modules/customer/customer.routes.js';
import cookieParser from 'cookie-parser';
import manufacturerRouter from './modules/manufacturer/manufacturer.routes.js';
import header_category from './modules/category/header_category/header_category.routes.js';
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
    app.use(express.json());
    app.use(helmet());

    //-------------- testing url ------------------//
    app.use('/health', (_req, res) => {
        res.json({ sucess: true, message: "welcome to my websites....!" })
    })


    //--------------- route api -------------------///

    app.use('/api/v1/products', allProductRouter)
    app.use('/api/v1/customer', customerRouter)
    app.use('/api/v1/manufacturer', manufacturerRouter)
    app.use('/api/v1/header-category', header_category)






    app.use(notFoundMiddleware);
    app.use(errorMiddleware);

    return app;
}