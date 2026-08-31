
import { successResponse, errorResponse } from "../../utils/apiResponse.js";
import { redirectService } from "./redirectService.service.js";

export const redirectController = async (req, res) => {
    const { slug, fullUrl } = req.query;
    

    if (!slug) return res.json({ data: null });

    try {
        const result = await redirectService(slug, fullUrl);
        return successResponse(res, 200, "Data fetched successfully", result);
    } catch (err) {
        console.error('Redirect controller error:', err);
        return res.json({ data: null });
    }
};