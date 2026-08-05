import { successResponse } from "../../../utils/apiResponse.js";
import {  mobileMainMenuService } from "./mobile_category.service.js";


export const mobile_category = async(req, res) => {
    const result = await mobileMainMenuService();
    return successResponse(res, 200, "Data Fetch successful !", result)
}