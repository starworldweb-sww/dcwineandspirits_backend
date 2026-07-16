import { successResponse } from "../../utils/apiResponse.js";
import { getAllProductsServices, getProductBySlugOrIdService, getSingleProductDetailsService } from "./products.service.js";


export const getAllProducts = async (req, res) => {
    const result = await getAllProductsServices();
    return successResponse(res, 200, "Products fetch scuessfully !", result)
}

export const getProductBySlugOrId = async (req, res) => {

    const result = await getProductBySlugOrIdService(req.params.slug);

    return successResponse(res, 200, "Products fetch scuessfully !", result)

}

export const getSingleProductDetails = async (req,res) => {

    const result = await getSingleProductDetailsService(req.params.slug);

    return successResponse(res,200,"product fetch scuessfull !",result)
}