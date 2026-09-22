import { Router } from "express";
import { createReview } from "./review.controller.js";
import { reviewImageUpload } from "./review.middleware.js";


const reviewRouter = Router()

reviewRouter.post("/", reviewImageUpload, createReview);

export default reviewRouter;