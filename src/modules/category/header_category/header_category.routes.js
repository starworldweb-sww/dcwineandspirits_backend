import { Router } from "express";
import { giftbyOccasionController, giftdropDown_Shop_by_CategoryController, giftDropDownCategoryGiftByOriginController, giftDropDownController, giftDropDownShopByPriceController, headerTopCategoryController, homePageAllDataController, homePageProductsController, homePageTextController, homeTopBannerController, loveBannersController, OccasionsMenuController, occasionTreasuresController, personalizationController, shopByBrandController, shopByBrandTitleController, TopCategoriesController, wineGiftsController } from "./header_category.controller.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";


const header_category = Router();

header_category.get('/top-category',asyncHandler(headerTopCategoryController))
header_category.get('/giftDropDown',asyncHandler(giftDropDownController))
header_category.get('/giftDropDown-shop-by-category',asyncHandler(giftdropDown_Shop_by_CategoryController))
header_category.get('/giftDropDown-gift-by-origin',asyncHandler(giftDropDownCategoryGiftByOriginController))
header_category.get('/giftDropDown-shop-by-price',asyncHandler(giftDropDownShopByPriceController))
header_category.get('/shop-by-brand',asyncHandler(shopByBrandController))
header_category.get('/personalization',asyncHandler(personalizationController))
header_category.get('/winegifts',asyncHandler(wineGiftsController))
header_category.get('/occasion-treasures',asyncHandler(occasionTreasuresController))
header_category.get('/occasion-menu',asyncHandler(OccasionsMenuController))
header_category.get('/home-page-top-banner',asyncHandler(homeTopBannerController))
header_category.get('/top-categories',asyncHandler(TopCategoriesController))
header_category.get('/love-banners',asyncHandler(loveBannersController))
header_category.get('/gift-by-occasion',asyncHandler(giftbyOccasionController))
header_category.get('/home-page-products',asyncHandler(homePageProductsController))
header_category.get('/shopByBrand-title',asyncHandler(shopByBrandTitleController))
header_category.get('/home-page-text',asyncHandler(homePageTextController))


// all home page api call

header_category.get('/home-page-all-data', asyncHandler(homePageAllDataController))

export default header_category;