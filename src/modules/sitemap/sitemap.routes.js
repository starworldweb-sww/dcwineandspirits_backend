
import { Router } from "express";
import {
  getSitemapDataController,
  getCategoriesForSitemapController,
  getProductsForSitemapController,
  getBrandsForSitemapController,
  getBlogsForSitemapController,
  getBlogCategoriesForSitemapController,
  getInformationPagesForSitemapController,
} from "./sitemap.controller.js";

const sitemapRouter = Router()

sitemapRouter.get("/all", getSitemapDataController);
sitemapRouter.get("/categories", getCategoriesForSitemapController);
sitemapRouter.get("/products", getProductsForSitemapController);
sitemapRouter.get("/brands", getBrandsForSitemapController);
sitemapRouter.get("/blogs", getBlogsForSitemapController);
sitemapRouter.get("/blog-categories", getBlogCategoriesForSitemapController);
sitemapRouter.get("/information", getInformationPagesForSitemapController);

export default sitemapRouter;
