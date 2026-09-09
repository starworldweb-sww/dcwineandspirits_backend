import { Router } from "express"
import { contactController } from "./contact.controller.js";



const contactRouter = Router();

contactRouter.post("/",contactController)

export default contactRouter ;