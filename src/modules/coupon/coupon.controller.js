import { successResponse } from "../../utils/apiResponse.js";
import { couponServices } from "./coupon.service.js";


 export const coupon_Controller =  async(req,res)=>{
  
     
    const {code, cartTotal,customerId} = req?.body ;
    const result = await couponServices(code,cartTotal,customerId);
    return res.json(result)
} 