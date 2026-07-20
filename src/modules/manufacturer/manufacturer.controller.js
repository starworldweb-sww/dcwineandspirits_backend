import { successResponse } from "../../utils/apiResponse.js";
import { allManufacturerService } from "./manufacturer.service.js";


export const allManufacturerController = async (req, res) => {

    const result = await allManufacturerService();
    return successResponse(res, 200, "data fetch Successful", result)

}