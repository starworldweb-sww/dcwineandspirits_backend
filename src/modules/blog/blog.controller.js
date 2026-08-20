import { successResponse } from "../../utils/apiResponse.js";
import {
  getAllPostsService,
  getPostBySlugService,
  getPostByIdService,
  searchPostsByKeywordService,
  getAllBlogCategoriesService,
  getCategoryBySlugService,
  CountViewsServices,
} from "./blog.service.js";


export const getAllPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10, categoryId, categorySlug } = req.query;

    const data = await getAllPostsService({
      page: Number(page),
      limit: Number(limit),
      categoryId: categoryId ? Number(categoryId) : undefined,
      categorySlug: categorySlug,
    });

    return res.status(200).json({
      success: true,
      message: "Posts fetched successfully",
      data,
    });
  } catch (error) {
    console.error("[getAllPosts]", error.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await getCategoryBySlugService(slug);

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Category fetched successfully",
      data: category,
    });
  } catch (error) {
    console.error("[getCategoryBySlug]", error.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAllBlogCategories = async (req, res) => {
  try {
    const categories = await getAllBlogCategoriesService();

    return res.status(200).json({
      success: true,
      message: "Blog categories fetched successfully",
      data: categories,
    });
  } catch (error) {
    console.error("[getAllBlogCategories]", error.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const post = await getPostBySlugService(slug);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: `Post not found for slug: "${slug}"`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Post fetched successfully",
      data: post,
    });
  } catch (error) {
    console.error("[getPostBySlug]", error.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!postId || isNaN(postId)) {
      return res.status(400).json({ success: false, message: "Valid post ID required" });
    }

    const post = await getPostByIdService(Number(postId));

    if (!post) {
      return res.status(404).json({
        success: false,
        message: `Post not found with ID: ${postId}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Post fetched successfully",
      data: post,
    });
  } catch (error) {
    console.error("[getPostById]", error.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const searchByKeyword = async (req, res) => {
  try {
    const { keyword, page = 1, limit = 10 } = req.query;

    if (!keyword?.trim()) {
      return res.status(400).json({
        success: false,
        message: "keyword query parameter is required",
      });
    }

    const data = await searchPostsByKeywordService(keyword.trim(), {
      page: Number(page),
      limit: Number(limit),
    });

    return res.status(200).json({
      success: true,
      message: `Search results for "${keyword}"`,
      data,
    });
  } catch (error) {
    console.error("[searchByKeyword]", error.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const countViews = async(req,res)=>{

  const {post_id} =  req.body ;
  const result = await CountViewsServices(post_id)

  return successResponse(res,200,"",result)
}