import { Router } from "express";
import { bulkOrderrController } from "./bulkorderr.controller.js";


const bulkrouter = Router();


// const bulkOrderLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 5,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: {
//     success: false,
//     message: "Too many bulk orders from this device. Please try again later.",
//   },
// });


bulkrouter.post("/",  bulkOrderrController);

export default bulkrouter;