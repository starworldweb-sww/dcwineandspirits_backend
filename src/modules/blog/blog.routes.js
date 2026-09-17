import { Router } from "express";
import {
  getAllPosts,
  getPostBySlug,
  getPostById,
  searchByKeyword,
  getAllBlogCategories,
  getCategoryBySlug,
  countViews,
  getPostsByAuthorNameController,
  getRecommendedPosts,
  
} from "./blog.controller.js";

const blogRoute = Router();

blogRoute.get("/posts", getAllPosts);
blogRoute.get("/categories", getAllBlogCategories);
blogRoute.get("/categories/:slug", getCategoryBySlug);
blogRoute.get("/search", searchByKeyword);
blogRoute.get("/posts/author", getPostsByAuthorNameController);
blogRoute.get("/posts/:slug", getPostBySlug);
blogRoute.post("/view-count", countViews);
blogRoute.get("/posts/:postId/recommended", getRecommendedPosts);


export default blogRoute;