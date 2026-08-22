import { successResponse } from "../../utils/apiResponse.js";
import {
  getAllSitemapData,
  getAllCategoriesForSitemap,
  getAllProductsForSitemap,
  getAllBrandsForSitemap,
  getAllBlogsForSitemap,
  getAllBlogCategoriesForSitemap,
  getAllInformationPagesForSitemap,
} from "./sitemap.service.js";

export const getSitemapDataController = async (req, res) => {
  const data = await getAllSitemapData();
  return successResponse(res, 200, "Sitemap data fetched successfully", data);
};

export const getCategoriesForSitemapController = async (req, res) => {
  const data = await getAllCategoriesForSitemap();
  return successResponse(res, 200, "Categories fetched successfully", data);
};

export const getProductsForSitemapController = async (req, res) => {
  const data = await getAllProductsForSitemap();
  return successResponse(res, 200, "Products fetched successfully", data);
};

export const getBrandsForSitemapController = async (req, res) => {
  const data = await getAllBrandsForSitemap();
  return successResponse(res, 200, "Brands fetched successfully", data);
};

export const getBlogsForSitemapController = async (req, res) => {
  const data = await getAllBlogsForSitemap();
  return successResponse(res, 200, "Blogs fetched successfully", data);
};

export const getBlogCategoriesForSitemapController = async (req, res) => {
  const data = await getAllBlogCategoriesForSitemap();
  return successResponse(res, 200, "Blog categories fetched successfully", data);
};

export const getInformationPagesForSitemapController = async (req, res) => {
  const data = await getAllInformationPagesForSitemap();
  return successResponse(res, 200, "Information pages fetched successfully", data);
};
