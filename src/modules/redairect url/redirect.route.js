import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { redirectController } from "./redirect.controller.js";



const redirectRouter = Router()

redirectRouter.get('/check', redirectController);

export default redirectRouter ;