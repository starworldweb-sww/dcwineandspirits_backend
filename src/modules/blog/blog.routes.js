import { Router } from "express";
import {
  getAllPosts,
  getPostBySlug,
  getPostById,
  searchByKeyword,
  getAllBlogCategories,
  getCategoryBySlug,
  countViews,
} from "./blog.controller.js";

const blogRoute = Router();

blogRoute.get("/posts", getAllPosts);
blogRoute.get("/categories", getAllBlogCategories);
blogRoute.get("/categories/:slug", getCategoryBySlug);
blogRoute.get("/search", searchByKeyword);
blogRoute.get("/posts/:slug", getPostBySlug);
blogRoute.post("/view-count", countViews);

export default blogRoute;