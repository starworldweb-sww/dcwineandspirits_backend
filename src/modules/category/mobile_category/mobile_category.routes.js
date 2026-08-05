import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { mobile_category } from "./mobile_category.controller.js";

const mobile_router = Router();

mobile_router.get('/',asyncHandler(mobile_category))


export default mobile_router ;