import { successResponse } from "../../utils/apiResponse.js";
import { bulkOrderDetailsService, bulkOrderHistoryService, CustomerOrderDetailsByOrderIdServices, orderhistoryservice, trackOrderService } from "./order.service.js"


 export const CustomerOrderHistory =  async(req,res)=>{
  const orderData = await orderhistoryservice(req) ;
  return successResponse(res,200,"",orderData)
}

 export const CustomerOrderDetailsByOrderId = async(req,res)=>{
    const orderId = Number(req.params.id );
    const orderDetailsByOrder = await CustomerOrderDetailsByOrderIdServices(orderId);
    return successResponse(res,200,"Order Details successfully",orderDetailsByOrder);
 }

 export const trackOrder = async (req, res) => {
  const orderDetails = await trackOrderService(req.body);
  return successResponse(res, 200, "Order tracked successfully", orderDetails);
}



export const CustomerBulkOrderHistory = async (req, res) => {
  const bulkOrderData = await bulkOrderHistoryService(req);
  return successResponse(res, 200, "", bulkOrderData);
};


export const CustomerBulkOrderDetails = async (req, res) => {
  const bulkOrderDetails = await bulkOrderDetailsService(req.params.id, req.customer);
  return successResponse(res, 200, "Bulk order details successfully", bulkOrderDetails);
};