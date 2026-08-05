import { successResponse } from "../../utils/apiResponse.js";
import { newsletterService } from "./newsletter.service.js";


 export const newsletterController = async (req, res) => {

    const { email } = req.body;
    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket?.remoteAddress || "";
    const result = await newsletterService(email,ip);

    return res.json(result)
    

}