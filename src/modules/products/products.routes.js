import { Router } from "express";
import { getAllProducts, getProductBySlugOrId, getSearchResults, getSingleProductDetails, mostViewProduct, searchAllProduct } from "./products.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";


const allProductRouter = Router();

allProductRouter.get('/', asyncHandler(getAllProducts))
allProductRouter.get("/search", asyncHandler(searchAllProduct));
allProductRouter.get("/search-results", asyncHandler(getSearchResults));
allProductRouter.get("/most-viewed-product",asyncHandler(mostViewProduct) );
allProductRouter.get('/:slug', asyncHandler(getProductBySlugOrId))
allProductRouter.get('/single-product/:slug',asyncHandler(getSingleProductDetails))

export default allProductRouter ;