import { Router } from "express";
import { allManufacturerController } from "./manufacturer.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";


const manufacturerRouter = Router();

manufacturerRouter.get('/',asyncHandler(allManufacturerController))

export default manufacturerRouter ;