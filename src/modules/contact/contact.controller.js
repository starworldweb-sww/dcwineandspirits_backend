import { successResponse } from "../../utils/apiResponse.js";
import { bulkOrderServices, contactServices } from "./contact.service.js"


export const contactController = async (req, res) => {

    const result = await contactServices(req.body)
    
    return successResponse(res,200,"Your message has been sent successfully. We'll get back to you shortly.",result)
}





export const bulkOrderController = async (req, res) => {
  const { name, email, mobile_no } = req.body;
  const file = req.file; // comes from multer middleware

  const result = await bulkOrderServices({ name, email, mobile_no, file });

  return successResponse(
    res,
    200,
    "Your bulk order has been submitted successfully. We'll be in touch shortly.",
    result
  );
};