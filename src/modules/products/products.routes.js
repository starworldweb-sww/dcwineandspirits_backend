import { Router } from "express";
import { getAllProducts, getProductBySlugOrId, getSingleProductDetails } from "./products.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";


const allProductRouter = Router();

allProductRouter.get('/', asyncHandler(getAllProducts))
// allProductRouter.get("/search", searchAllProduct);
allProductRouter.get('/:slug', asyncHandler(getProductBySlugOrId))
allProductRouter.get('/single-product/:slug',asyncHandler(getSingleProductDetails))

export default allProductRouter ;