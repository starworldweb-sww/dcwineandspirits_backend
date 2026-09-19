import { Router } from "express"
import { bulkOrderController, contactController } from "./contact.controller.js";
import upload from "../../config/upload.js";



const contactRouter = Router();

contactRouter.post("/",contactController);
contactRouter.post("/bulk-order", upload.single("bulkOrderFile"), bulkOrderController);

export default contactRouter ;