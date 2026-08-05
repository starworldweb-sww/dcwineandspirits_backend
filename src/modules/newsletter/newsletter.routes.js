import { Router } from "express";
import { newsletterController } from "./newsletter.controller.js";


const newsletterRoter = Router();

newsletterRoter.post("/subscribe",newsletterController)

export default newsletterRoter ;