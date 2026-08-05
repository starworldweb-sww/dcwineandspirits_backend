import { successResponse } from "../../utils/apiResponse.js";
import { getAllProductsServices, getProductBySlugOrIdService, getSearchResultsService, getSingleProductDetailsService, mostviewdproductservice, searchAllProductService } from "./products.service.js";


export const getAllProducts = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 24, 100);
    const result = await getAllProductsServices(page, limit);
    return successResponse(res, 200, "Products fetch successfully !", result)
};


export const getProductBySlugOrId = async (req, res) => {
    const result = await getProductBySlugOrIdService(req.params.slug);
    return successResponse(res, 200, "Products fetch scuessfully !", result)

}

export const getSingleProductDetails = async (req, res) => {
    const result = await getSingleProductDetailsService(req.params.slug);
    return successResponse(res, 200, "product fetch scuessfull !", result)
}

export const searchAllProduct = async (req, res) => {
    const result = await searchAllProductService(req.query);
    return successResponse(res, 200, "", result)
};

export const getSearchResults = async (req, res) => {
    const result = await getSearchResultsService(req.query);
    return successResponse(res, 200, "Search results fetched successfully", result);
};
export const mostViewProduct = async (req, res) => {
    const result = await mostviewdproductservice();
    return successResponse(res, 200, " Data fetched successfully", result);
};
