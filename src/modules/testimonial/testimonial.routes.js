import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js"; 
import { testimonialListController } from "./testimonial.controller.js";

const testimonial = Router();

testimonial.get('/', asyncHandler(testimonialListController))

export default testimonial;