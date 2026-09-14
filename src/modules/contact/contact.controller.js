import { successResponse } from "../../utils/apiResponse.js";
import { contactServices } from "./contact.service.js"


export const contactController = async (req, res) => {

    const result = await contactServices(req.body)
    
    return successResponse(res,200,"Your message has been sent successfully. We'll get back to you shortly.",result)
}