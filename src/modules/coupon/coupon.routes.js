import { Router } from "express";
import { coupon_Controller } from "./coupon.controller.js";

const coupon_router =  Router();

coupon_router.post('/',coupon_Controller)

export default coupon_router ;