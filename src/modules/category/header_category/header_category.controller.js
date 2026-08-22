import { successResponse } from "../../../utils/apiResponse.js";
import { giftbyOccasionService, giftdropDown_Shop_by_CategoryService, giftdropDownGifts_By_OriginService, giftdropDownService, giftdropDownShopByPriceService, headerTopCategoryService, homePageAllDataService, homePageProductsService, homePageTextService, homeTopBannerService, loveBannersService, OccasionsMenuService, occasionTreasuresService, personalizationService, shopByBrandeService, shopByBrandTitleService, topcategoriesService, wineGiftService } from "./header_category.service.js";



export const headerTopCategoryController = async (req, res) => {
    const result = await headerTopCategoryService();
    return successResponse(res, 200, "data fetched successful !", result)
}
export const giftDropDownController = async (req, res) => {
    const result = await giftdropDownService();
    return successResponse(res, 200, "data fetched successful !", result)
}
export const giftdropDown_Shop_by_CategoryController = async (req, res) => {
    const result = await giftdropDown_Shop_by_CategoryService();
    return successResponse(res, 200, "data fetched successful !", result)
}
export const giftDropDownCategoryGiftByOriginController = async (req, res) => {
    const result = await giftdropDownGifts_By_OriginService();
    return successResponse(res, 200, "data fetched successful !", result)
}
export const giftDropDownShopByPriceController = async (req, res) => {
    const result = await giftdropDownShopByPriceService();
    return successResponse(res, 200, "data fetched successful !", result)
}
export const shopByBrandController = async (req, res) => {
    const result = await shopByBrandeService();
    return successResponse(res, 200, "data fetched successful !", result)
}
export const personalizationController = async (req, res) => {
    const result = await personalizationService();
    return successResponse(res, 200, "data fetched successful !", result)
}
export const wineGiftsController = async (req, res) => {
    const result = await wineGiftService();
    return successResponse(res, 200, "data fetched successful !", result)
}
export const occasionTreasuresController = async (req, res) => {
    const result = await occasionTreasuresService();
    return successResponse(res, 200, "data fetched successful !", result)
}
export const OccasionsMenuController = async (req, res) => {
    const result = await OccasionsMenuService();
    return successResponse(res, 200, "data fetched successful !", result)
}
export const homeTopBannerController = async (req, res) => {
    const result = await homeTopBannerService();
    return successResponse(res, 200, "data fetched successful !", result)
}
export const TopCategoriesController = async (req, res) => {
    const result = await topcategoriesService();
    return successResponse(res, 200, "data fetched successful !", result)
}
export const loveBannersController = async (req, res) => {
    const result = await loveBannersService();
    return successResponse(res, 200, "data fetched successful !", result)
}

export const giftbyOccasionController = async (req,res) => {
    const result = await giftbyOccasionService();
    return successResponse(res, 200, "data fetched sucessful !", result);
}
export const homePageProductsController = async (req,res) => {
    const result = await homePageProductsService();
    return successResponse(res, 200, "data fetched sucessful !", result);
}
export const shopByBrandTitleController = async (req,res) => {
    const result = await shopByBrandTitleService();
    return successResponse(res, 200, "data fetched sucessful !", result);
}
export const homePageTextController = async (req,res) => {
    const result = await homePageTextService();
    return successResponse(res, 200, "data fetched sucessful !", result);
}

export const homePageAllDataController = async (req, res) => {
    const result = await homePageAllDataService();
    return successResponse(res, 200, "data fetched successful !", result)
}