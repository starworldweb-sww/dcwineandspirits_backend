import { successResponse } from "../../utils/apiResponse.js";
import { testimonialListService } from "./testimonial.service.js";

export const testimonialListController = async (req, res) => {
    const { page, limit } = req.query;

    const result = await testimonialListService({ page, limit });
    return successResponse(res, 200, "data fetched successful !", result)
}