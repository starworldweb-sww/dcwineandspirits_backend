import { prisma } from "../../../lib/prisma.js";

const allbrandData = async () => {
    const brandData = await prisma.oc_manufacturer.findMany({
        select: {
            manufacturer_id: true,
            name: true,
            image: true,
            sort_order: true
        },
    });

    return brandData;
};


const allParentCategoryData = async () => {
    const parentid = await prisma.oc_category.findMany({
        where: {
            parent_id: 0,
            status: true
        },
        select: {
            category_id: true,
            image: true,
        }
    });

    const categoryData = await prisma.oc_category_description.findMany({
        where: {
            category_id: {
                in: parentid?.map((p) => p.category_id) ?? []
            },
            language_id: 1
        },
        select: {
            name: true,
            category_id: true,
        }
    });

    const data = categoryData.map((i) => {
        const matched = parentid.find((p) => p.category_id === i.category_id);
        return {
            category_id: i.category_id,
            name: i.name,
            image: matched?.image ?? null,
        };
    });

    return data;
};

const allProductsData = async () => {
    const now = new Date();

    const products = await prisma.oc_product.findMany({
        where: { status: true },
        select: {
            product_id: true,
            image: true,
            price: true,
            quantity: true,
            date_added: true,
        },
    });

    const productIds = products.map((p) => p.product_id);

    const [descriptions, seoUrls, specials] = await Promise.all([
        prisma.oc_product_description.findMany({
            where: {
                product_id: { in: productIds },
                language_id: 1,
            },
            select: {
                product_id: true,
                name: true,
            },
        }),
        prisma.oc_seo_url.findMany({
            where: {
                query: { in: productIds.map((id) => `product_id=${id}`) },
                store_id: 0,
                language_id: 1,
            },
            select: {
                query: true,
                keyword: true,
            },
        }),
        prisma.oc_product_special.findMany({
            where: {
                product_id: { in: productIds },
                customer_group_id: 1,
            },
            select: {
                product_id: true,
                price: true,
                date_start: true,
                date_end: true,
                priority: true,
            },
        }),
    ]);


    const descMap = new Map(descriptions.map((d) => [d.product_id, d.name]));
    const seoMap = new Map(seoUrls.map((s) => [s.query, s.keyword]));

    const specialsMap = new Map();
    for (const s of specials) {
        if (!specialsMap.has(s.product_id)) specialsMap.set(s.product_id, []);
        specialsMap.get(s.product_id).push(s);
    }

    const isDateActive = (start, end) => {
        const startYear = start ? start.getFullYear() : null;
        const endYear = end ? end.getFullYear() : null;
        const startOk = !start || Number.isNaN(startYear) || startYear <= 1970 || start <= now;
        const endOk = !end || Number.isNaN(endYear) || endYear <= 1970 || end >= now;

        return startOk && endOk;
    };

    const data = products.map((p) => {
        const productSpecials = specialsMap.get(p.product_id) ?? [];

        const activeSpecial = productSpecials
            .filter((s) => isDateActive(s.date_start, s.date_end))
            .sort((a, b) => a.priority - b.priority)[0]; // lowest priority number wins

        return {
            product_id: p.product_id,
            name: descMap.get(p.product_id) ?? null,
            image: p.image,
            price: p.price,
            special_price: activeSpecial?.price ?? null,
            seo_url: seoMap.get(`product_id=${p.product_id}`) ?? null,
        };
    });

    return data;
};

export const getAllProductsServices = async () => {
    const [allbrand, allparentCategory, allproducts] = await Promise.all([
        allbrandData(),
        allParentCategoryData(),
        allProductsData(),
    ]);

    return {
        allbrand,
        allparentCategory,
        allproducts,
    };
};


const LANGUAGE_ID = 1;
const STORE_ID = 0;
const CUSTOMER_GROUP_ID = 1; // default customer group ke liye special price

// ---------- Helper: check karo ki special price abhi active hai ya nahi ----------
const isDateActive = (start, end, now) => {
    const startYear = start ? start.getFullYear() : null;
    const endYear = end ? end.getFullYear() : null;

    // '0000-00-00' -> Invalid Date -> getFullYear() NaN aata hai, usko "no restriction" treat karo
    const startOk = !start || Number.isNaN(startYear) || startYear <= 1970 || start <= now;
    const endOk = !end || Number.isNaN(endYear) || endYear <= 1970 || end >= now;

    return startOk && endOk;
};

// ---------- Helper: slug se pata karo type (product/category/manufacturer) + id ----------
const resolveSlugOrId = async (slugOrId) => {
    // Pehle seo_url table me keyword se dhoondo (slug ke liye)
    const seo = await prisma.oc_seo_url.findFirst({
        where: {
            keyword: String(slugOrId),
            language_id: LANGUAGE_ID,
        },
        select: { query: true },
    });

    if (seo?.query) {
        const [key, value] = seo.query.split("=");
        const id = Number(value);

        if (key === "product_id") return { type: "product", id };
        if (key === "category_id") return { type: "category", id };
        if (key === "manufacturer_id") return { type: "manufacturer", id };
    }

    // Agar seo_url me nahi mila aur slugOrId numeric id hai, to raw id maan lo
    if (!isNaN(slugOrId)) {
        const id = Number(slugOrId);
        // Priority: product -> category -> manufacturer
        const product = await prisma.oc_product.findUnique({ where: { product_id: id } });
        if (product) return { type: "product", id };

        const category = await prisma.oc_category.findUnique({ where: { category_id: id } });
        if (category) return { type: "category", id };

        const manufacturer = await prisma.oc_manufacturer.findUnique({ where: { manufacturer_id: id } });
        if (manufacturer) return { type: "manufacturer", id };
    }

    return null;
};

// ---------- Helper: multiple product ids se pura summary data (price sorted, brand, special) ----------
const getProductsSummary = async (productIds) => {
    if (!productIds.length) return [];

    const now = new Date();

    const [products, descriptions, seoUrls, specials, manufacturers] = await Promise.all([
        prisma.oc_product.findMany({
            where: { product_id: { in: productIds }, status: true },
            select: {
                product_id: true,
                image: true,
                price: true,
                manufacturer_id: true,
                quantity: true,
            },
        }),
        prisma.oc_product_description.findMany({
            where: { product_id: { in: productIds }, language_id: LANGUAGE_ID },
            select: { product_id: true, name: true },
        }),
        prisma.oc_seo_url.findMany({
            where: {
                query: { in: productIds.map((id) => `product_id=${id}`) },
                store_id: STORE_ID,
                language_id: LANGUAGE_ID,
            },
            select: { query: true, keyword: true },
        }),
        prisma.oc_product_special.findMany({
            where: { product_id: { in: productIds }, customer_group_id: CUSTOMER_GROUP_ID },
            select: { product_id: true, price: true, date_start: true, date_end: true, priority: true },
        }),
        prisma.oc_manufacturer.findMany({
            select: { manufacturer_id: true, name: true, image: true },
        }),
    ]);

    const descMap = new Map(descriptions.map((d) => [d.product_id, d.name]));
    const seoMap = new Map(seoUrls.map((s) => [s.query, s.keyword]));
    const manufacturerMap = new Map(manufacturers.map((m) => [m.manufacturer_id, m]));

    const specialsMap = new Map();
    for (const s of specials) {
        if (!specialsMap.has(s.product_id)) specialsMap.set(s.product_id, []);
        specialsMap.get(s.product_id).push(s);
    }

    const data = products.map((p) => {
        const productSpecials = specialsMap.get(p.product_id) ?? [];
        const activeSpecial = productSpecials
            .filter((s) => isDateActive(s.date_start, s.date_end, now))
            .sort((a, b) => a.priority - b.priority)[0];

        const finalPrice = activeSpecial?.price ?? p.price;
        const brand = manufacturerMap.get(p.manufacturer_id);

        return {
            product_id: p.product_id,
            name: descMap.get(p.product_id) ?? null,
            image: p.image,
            price: p.price,
            special_price: activeSpecial?.price ?? null,
            final_price: finalPrice, // sorting ke liye
            in_stock: p.quantity > 0,
            manufacturer: brand
                ? { manufacturer_id: brand.manufacturer_id, name: brand.name, image: brand.image }
                : null,
            seo_url: seoMap.get(`product_id=${p.product_id}`) ?? null,
        };
    });

    // Price: max to min ke bajaye normally low to high behtar hota hai,
    // agar aapko high to low chahiye to (a,b)=>b - a kar dena
    data.sort((a, b) => Number(a.final_price) - Number(b.final_price));

    return data;
};

// ---------- CATEGORY page data ----------
const getCategoryData = async (categoryId) => {
    const [category, categoryDesc, subCategories, productLinks] = await Promise.all([
        prisma.oc_category.findUnique({ where: { category_id: categoryId } }),
        prisma.oc_category_description.findFirst({
            where: { category_id: categoryId, language_id: LANGUAGE_ID },
        }),
        prisma.oc_category.findMany({
            where: { parent_id: categoryId, status: true },
            select: { category_id: true, image: true },
            orderBy: { sort_order: "asc" },
        }),
        prisma.oc_product_to_category.findMany({
            where: { category_id: categoryId },
            select: { product_id: true },
        }),
    ]);

    // subcategory names fetch karo
    const subCategoryIds = subCategories.map((s) => s.category_id);
    const subCategoryDescs = subCategoryIds.length
        ? await prisma.oc_category_description.findMany({
            where: { category_id: { in: subCategoryIds }, language_id: LANGUAGE_ID },
            orderBy: { name: "asc" },
            select: { category_id: true, name: true },
        })
        : [];
    const subCategoryDescMap = new Map(subCategoryDescs.map((d) => [d.category_id, d.name]));

    const subCategoriesData = subCategories.map((s) => ({
        category_id: s.category_id,
        name: subCategoryDescMap.get(s.category_id) ?? null,
        image: s.image,
    }));

    // products of this category
    const productIds = productLinks.map((p) => p.product_id);
    const products = await getProductsSummary(productIds);

    // in products ke unique brands
    const brandMap = new Map();
    products.forEach((p) => {
        if (p.manufacturer && !brandMap.has(p.manufacturer.manufacturer_id)) {
            brandMap.set(p.manufacturer.manufacturer_id, p.manufacturer);
        }
    });

    // price range (jaise screenshot me $79 - $3399 dikh raha hai)
    const prices = products.map((p) => Number(p.final_price));
    const priceRange = prices.length
        ? { min: Math.min(...prices), max: Math.max(...prices) }
        : { min: 0, max: 0 };

    return {
        type: "category",
        category_id: categoryId,
        name: categoryDesc?.name ?? null,
        description: categoryDesc?.description ?? null,
        smalldesc: categoryDesc?.smalldesc ?? null,
        meta_title: categoryDesc?.meta_title ?? null,
        meta_description: categoryDesc?.meta_description ?? null,
        image: category?.image ?? null,
        subCategories: subCategoriesData,
        brands: [...brandMap.values()],
        priceRange,
        products,
    };
};

// ---------- MANUFACTURER / BRAND page data ----------
const getManufacturerData = async (manufacturerId) => {
    const [manufacturer, manufacturerDesc, productRows] = await Promise.all([
        prisma.oc_manufacturer.findUnique({ where: { manufacturer_id: manufacturerId } }),
        prisma.oc_manufacturer_description.findFirst({
            where: { manufacturer_id: manufacturerId, language_id: LANGUAGE_ID },
        }),
        prisma.oc_product.findMany({
            where: { manufacturer_id: manufacturerId, status: true },
            select: { product_id: true },
        }),
    ]);

    const productIds = productRows.map((p) => p.product_id);
    const products = await getProductsSummary(productIds);

    const prices = products.map((p) => Number(p.final_price));
    const priceRange = prices.length
        ? { min: Math.min(...prices), max: Math.max(...prices) }
        : { min: 0, max: 0 };

    return {
        type: "manufacturer",
        manufacturer_id: manufacturerId,
        name: manufacturer?.name ?? null,
        image: manufacturer?.image ?? null,
        description: manufacturerDesc?.description ?? null,
        meta_title: manufacturerDesc?.meta_title ?? null,
        meta_h1: manufacturerDesc?.meta_h1 ?? null,
        priceRange,
        products,
    };
};



export const getProductBySlugOrIdService = async (slugOrId) => {
    const resolved = await resolveSlugOrId(slugOrId);
    console.log("resolved", resolved.type)
    if (!resolved) {
        return { type: "not_found" };
    }

    if (resolved.type === "category") {
        return await getCategoryData(resolved.id);
    }

    if (resolved.type === "manufacturer") {
        return await getManufacturerData(resolved.id);
    }

    // if (resolved.type === "product") {
    //     return await getProductData(resolved.id);
    // }

    return { type: "not_found" };
};



const getRelatedProductsSummary = async (productIds) => {
    if (!productIds.length) return [];
    console.log("productIds",productIds)
    const now = new Date();

    const [products, descriptions, seoUrls, specials] = await Promise.all([
        prisma.oc_product.findMany({
            where: { product_id: { in: productIds }, status: true },
            select: { product_id: true, image: true, price: true, quantity: true },
        }),
        prisma.oc_product_description.findMany({
            where: { product_id: { in: productIds }, language_id: LANGUAGE_ID },
            select: { product_id: true, name: true },
        }),
        prisma.oc_seo_url.findMany({
            where: {
                query: { in: productIds.map((id) => `product_id=${id}`) },
                store_id: STORE_ID,
                language_id: LANGUAGE_ID,
            },
            select: { query: true, keyword: true },
        }),
        prisma.oc_product_special.findMany({
            where: { product_id: { in: productIds }, customer_group_id: CUSTOMER_GROUP_ID },
        }),
    ]);

    const descMap = new Map(descriptions.map((d) => [d.product_id, d.name]));
    const seoMap = new Map(seoUrls.map((s) => [s.query, s.keyword]));

    const specialsMap = new Map();
    for (const s of specials) {
        if (!specialsMap.has(s.product_id)) specialsMap.set(s.product_id, []);
        specialsMap.get(s.product_id).push(s);
    }

    return products.map((p) => {
        const activeSpecial = (specialsMap.get(p.product_id) ?? [])
            .filter((s) => isDateActive(s.date_start, s.date_end, now))
            .sort((a, b) => a.priority - b.priority)[0];

        return {
            product_id: p.product_id,
            name: descMap.get(p.product_id) ?? null,
            image: p.image,
            price: p.price,
            special_price: activeSpecial?.price ?? null,
            in_stock: p.quantity > 0,
            seo_url: seoMap.get(`product_id=${p.product_id}`) ?? null,
        };
    });
};

// ---------- Full single product details ----------
const getFullProductData = async (productId) => {
    const now = new Date();

    const product = await prisma.oc_product.findUnique({ where: { product_id: productId } });
    if (!product) return null;

    const [
        description,
        seo,
        images,
        specials,
        discounts,
        manufacturer,
        productOptions,
        relatedRows,
        attributeRows,
        reviews,
        videos,
        downloadRows,
    ] = await Promise.all([
        prisma.oc_product_description.findFirst({
            where: { product_id: productId, language_id: LANGUAGE_ID },
        }),
        prisma.oc_seo_url.findFirst({
            where: { query: `product_id=${productId}`, store_id: STORE_ID, language_id: LANGUAGE_ID },
            select: { keyword: true },
        }),
        prisma.oc_product_image.findMany({
            where: { product_id: productId },
            orderBy: { sort_order: "asc" },
            select: { product_image_id: true, image: true, sort_order: true },
        }),
        prisma.oc_product_special.findMany({
            where: { product_id: productId, customer_group_id: CUSTOMER_GROUP_ID },
        }),
        prisma.oc_product_discount.findMany({
            where: { product_id: productId, customer_group_id: CUSTOMER_GROUP_ID },
            orderBy: { quantity: "asc" },
        }),
        prisma.oc_manufacturer.findUnique({ where: { manufacturer_id: product.manufacturer_id } }),
        prisma.oc_product_option.findMany({
            where: { product_id: productId },
        }),
        prisma.oc_product_related.findMany({
            where: { product_id: productId },
            select: { related_id: true },
        }),
        prisma.oc_product_attribute.findMany({
            where: { product_id: productId, language_id: LANGUAGE_ID },
        }),
        prisma.oc_review.findMany({
            where: { product_id: productId, status: true },
            orderBy: { date_added: "desc" },
        }),
        prisma.oc_me_product_video.findMany({
            where: { product_id: productId },
            orderBy: { sort_order: "asc" },
        }),
        prisma.oc_product_to_download.findMany({
            where: { product_id: productId },
            select: { download_id: true },
        }),
    ]);

    // ---- Active special price nikalo ----
    const activeSpecial = specials
        .filter((s) => isDateActive(s.date_start, s.date_end, now))
        .sort((a, b) => a.priority - b.priority)[0];

    // ---- Product options + option values (color, size, etc.) ----
    const optionIds = productOptions.map((o) => o.option_id);
    const productOptionValueIds = productOptions.map((o) => o.product_option_id);

    const [optionDescs, optionValues, optionValueRows] = await Promise.all([
        optionIds.length
            ? prisma.oc_option_description.findMany({
                  where: { option_id: { in: optionIds }, language_id: LANGUAGE_ID },
              })
            : [],
        productOptionValueIds.length
            ? prisma.oc_product_option_value.findMany({
                  where: { product_option_id: { in: productOptionValueIds } },
              })
            : [],
        [], // placeholder, not used directly
    ]);

    const optionDescMap = new Map(optionDescs.map((d) => [d.option_id, d.name]));

    // option_value_id -> name ke liye oc_option_value_description chahiye
    const allOptionValueIds = optionValues.map((v) => v.option_value_id);
    const optionValueDescs = allOptionValueIds.length
        ? await prisma.oc_option_value_description.findMany({
              where: { option_value_id: { in: allOptionValueIds }, language_id: LANGUAGE_ID },
          })
        : [];
    const optionValueDescMap = new Map(optionValueDescs.map((d) => [d.option_value_id, d.name]));

    const options = productOptions.map((opt) => {
        const values = optionValues
            .filter((v) => v.product_option_id === opt.product_option_id)
            .map((v) => ({
                product_option_value_id: v.product_option_value_id,
                option_value_id: v.option_value_id,
                name: optionValueDescMap.get(v.option_value_id) ?? null,
                price: v.price,
                price_prefix: v.price_prefix,
                quantity: v.quantity,
                weight: v.weight,
                weight_prefix: v.weight_prefix,
            }));

        return {
            product_option_id: opt.product_option_id,
            option_id: opt.option_id,
            name: optionDescMap.get(opt.option_id) ?? null,
            required: opt.required,
            values, // agar type "select"/"radio"/"checkbox" hai
            text_value: opt.value, // agar type "text"/"textarea" hai to yahan direct value hoti h
        };
    });

    // ---- Attributes (jaise "Alcohol %", "Region", "Volume" etc.) ----
    const attributeIds = attributeRows.map((a) => a.attribute_id);
    const attributeDescs = attributeIds.length
        ? await prisma.oc_attribute_description.findMany({
              where: { attribute_id: { in: attributeIds }, language_id: LANGUAGE_ID },
          })
        : [];
    const attributeDescMap = new Map(attributeDescs.map((d) => [d.attribute_id, d.name]));

    const attributes = attributeRows.map((a) => ({
        attribute_id: a.attribute_id,
        name: attributeDescMap.get(a.attribute_id) ?? null,
        text: a.text,
    }));

    // ---- Related products ----
    console.log("relatedRows",relatedRows)
    const relatedIds = relatedRows.map((r) => r.related_id);

    const relatedProducts = await getRelatedProductsSummary(relatedIds);

    // ---- Reviews summary ----
    const avgRating = reviews.length
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    // ---- Downloads (agar digital product hai) ----
    const downloadIds = downloadRows.map((d) => d.download_id);
    const downloads = downloadIds.length
        ? await prisma.oc_download_description.findMany({
              where: { download_id: { in: downloadIds }, language_id: LANGUAGE_ID },
              select: { download_id: true, name: true },
          })
        : [];

    return {
        type: "product",
        product_id: product.product_id,
        name: description?.name ?? null,
        description: description?.description ?? null,
        tag: description?.tag ?? null,
        meta_title: description?.meta_title ?? null,
        meta_description: description?.meta_description ?? null,
        meta_keyword: description?.meta_keyword ?? null,

        model: product.model,
        sku: product.sku,
        upc: product.upc,
        ean: product.ean,
        mpn: product.mpn,

        image: product.image,
        images: images.map((i) => ({ id: i.product_image_id, image: i.image, sort_order: i.sort_order })),

        price: product.price,
        special_price: activeSpecial?.price ?? null,
        discounts: discounts.map((d) => ({
            quantity: d.quantity,
            price: d.price,
            priority: d.priority,
        })),

        quantity: product.quantity,
        in_stock: product.quantity > 0,
        minimum: product.minimum,

        weight: product.weight,
        length: product.length,
        width: product.width,
        height: product.height,

        manufacturer: manufacturer
            ? { manufacturer_id: manufacturer.manufacturer_id, name: manufacturer.name, image: manufacturer.image }
            : null,

        options,
        attributes,
        related_products: relatedProducts,

        reviews: reviews.map((r) => ({
            review_id: r.review_id,
            author: r.author,
            text: r.text,
            rating: r.rating,
            date_added: r.date_added,
        })),
        review_count: reviews.length,
        average_rating: Number(avgRating.toFixed(1)),

        videos: videos.map((v) => ({
            video_id: v.video_id,
            video_link: v.video_link,
            image: v.image,
            video_type: v.video_type,
        })),

        downloads: downloads.map((d) => ({ download_id: d.download_id, name: d.name })),

        date_added: product.date_added,
        seo_url: seo?.keyword ?? null,
    };
};



// ---------- Main export ----------
export const getSingleProductDetailsService = async (slugOrId) => {
    const resolved = await resolveSlugOrId(slugOrId);

    if (!resolved || resolved.type !== "product") {
        return { type: "not_found" };
    }

    const data = await getFullProductData(resolved.id);
    return data ?? { type: "not_found" };
};
