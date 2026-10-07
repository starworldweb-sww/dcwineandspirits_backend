import { Router } from "express";
import { coupon_Controller, getCouponsController } from "./coupon.controller.js";

const coupon_router =  Router();

coupon_router.post('/',coupon_Controller);
coupon_router.get('/active',getCouponsController);


export default coupon_router ;