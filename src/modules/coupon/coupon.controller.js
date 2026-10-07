import { successResponse } from "../../utils/apiResponse.js";
import { couponServices, getActiveCouponsService } from "./coupon.service.js";


 export const coupon_Controller =  async(req,res)=>{
  
     
    const {code, cartTotal,customerId} = req?.body ;
    const result = await couponServices(code,cartTotal,customerId);
    return res.json(result)
} 




export const getCouponsController = async (req, res) => {
  try {
    const result = await getActiveCouponsService();
    return res.json(result);
  } catch (error) {
    console.error("Get coupons error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};