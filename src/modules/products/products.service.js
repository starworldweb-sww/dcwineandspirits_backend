import pkg from "@prisma/client";
const { Prisma } = pkg
import { prisma } from "../../../lib/prisma.js";
import { fetchSeoMap, getEffectivePrice, getValidSpecialPrice } from "../../utils/producthalper.js";

const LANGUAGE_ID = 1;
const STORE_ID = 0;
const CUSTOMER_GROUP_ID = 1;


const buildBreadcrumbs = async (categoryId) => {
    const pathRows = await prisma.oc_category_path.findMany({
        where: { category_id: categoryId },
        orderBy: { level: "asc" },
        select: { path_id: true, level: true },
    });

    if (!pathRows.length) return [];

    const pathIds = pathRows.map((r) => r.path_id);
    const [descriptions, seoMap] = await Promise.all([
        prisma.oc_category_description.findMany({
            where: { category_id: { in: pathIds }, language_id: LANGUAGE_ID },
            select: { category_id: true, name: true },
        }),
        fetchSeoMap(pathIds.map((id) => `category_id=${id}`)),
    ]);

    return pathRows.map((row) => {
        const desc = descriptions.find((d) => d.category_id === row.path_id);
        return {
            category_id: row.path_id,
            name: desc?.name ?? null,
            slug: seoMap.get(`category_id=${row.path_id}`) ?? null,
            level: row.level,
        };
    });
};

const parseIdList = (value) => {
    if (value == null || value === "") return [];

    const raw = Array.isArray(value) ? value.join(",") : String(value);
    return [
        ...new Set(
            raw
                .split(",")
                .map((part) => parseInt(part.trim(), 10))
                .filter((id) => Number.isInteger(id) && id > 0)
        ),
    ];
};
const parseOptionalNumber = (value) => {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};
const parseCategoryFilters = (query) => {
    const manufacturerIds = parseIdList(
        query.fm ?? query.manufacturer_id ?? query.brand ?? query.manufacturers
    );
    const subcategoryIds = parseIdList(query.fc ?? query.subcategory ?? query.category_id);
    const filterIds = parseIdList(query.filter ?? query.filters);
    const optionIds = parseIdList(query.option ?? query.options);

    const minPrice = parseOptionalNumber(query.min_price ?? query.price_min);
    const maxPrice = parseOptionalNumber(query.max_price ?? query.price_max);

    const inStock =
        query.in_stock === "true" || query.in_stock === "1"
            ? true
            : query.in_stock === "false" || query.in_stock === "0"
                ? false
                : null;

    return {
        manufacturerIds,
        subcategoryIds,
        filterIds,
        optionIds,
        minPrice,
        maxPrice,
        inStock,
        hasFilters:
            manufacturerIds.length > 0 ||
            subcategoryIds.length > 0 ||
            filterIds.length > 0 ||
            optionIds.length > 0 ||
            minPrice != null ||
            maxPrice != null ||
            inStock != null,
    };
};
const parsePositiveInt = (value, fallback) => {
    const n = parseInt(value, 10);
    return Number.isInteger(n) && n > 0 ? n : fallback;
};
const getProductCategoryMap = async (productIds) => {
    if (!productIds.length) return new Map();

    const links = await prisma.oc_product_to_category.findMany({
        where: { product_id: { in: productIds } },
        select: { product_id: true, category_id: true },
    });

    const map = new Map();
    for (const link of links) {
        if (!map.has(link.product_id)) map.set(link.product_id, []);
        map.get(link.product_id).push(link.category_id);
    }
    return map;
};
const getProductFilterMap = async (productIds) => {
    if (!productIds.length) return new Map();

    const rows = await prisma.oc_product_filter.findMany({
        where: { product_id: { in: productIds } },
        select: { product_id: true, filter_id: true },
    });

    const map = new Map();
    for (const row of rows) {
        if (!map.has(row.product_id)) map.set(row.product_id, []);
        map.get(row.product_id).push(row.filter_id);
    }
    return map;
};
const getProductOptionMap = async (productIds) => {
    if (!productIds.length) return new Map();

    const rows = await prisma.oc_product_option_value.findMany({
        where: { product_id: { in: productIds } },
        select: { product_id: true, option_value_id: true },
    });

    const map = new Map();
    for (const row of rows) {
        if (!map.has(row.product_id)) map.set(row.product_id, []);
        map.get(row.product_id).push(row.option_value_id);
    }
    return map;
};
const mapProducts = async (productIds, { sort = "default", categoryMap } = {}) => {
    if (!productIds.length) {
        return { items: [], total: 0 };
    }

    const uniqueIds = [...new Set(productIds)];
    const now = new Date();

    const orderBy =
        sort === "price_asc"
            ? { price: "asc" }
            : sort === "price_desc"
                ? { price: "desc" }
                : sort === "name_asc"
                    ? undefined
                    : [{ sort_order: "asc" }, { date_added: "desc" }];

    const products = await prisma.oc_product.findMany({
        where: {
            product_id: { in: uniqueIds },
            status: true,
        },
        select: {
            product_id: true,
            image: true,
            price: true,
            quantity: true,
            manufacturer_id: true,
            sort_order: true,
            date_added: true,
        },
        ...(orderBy ? { orderBy } : {}),
    });

    const ids = products.map((p) => p.product_id);

    const [descriptions, seoMap, specials] = await Promise.all([
        prisma.oc_product_description.findMany({
            where: { product_id: { in: ids }, language_id: LANGUAGE_ID },
            select: { product_id: true, name: true },
        }),
        fetchSeoMap(ids.map((id) => `product_id=${id}`)),
        prisma.oc_product_special.findMany({
            where: { product_id: { in: ids }, customer_group_id: 1 },
            orderBy: { priority: "asc" },
        }),
    ]);

    let items = products.map((product) => {
        const desc = descriptions.find((d) => d.product_id === product.product_id);
        return {
            id: product.product_id,
            name: desc?.name ?? null,
            image: product.image ?? null,
            price: Number(product.price),
            special_price: getValidSpecialPrice(specials, product.product_id, now),
            quantity: product.quantity,
            in_stock: product.quantity > 0,
            manufacturer_id: product.manufacturer_id || null,
            category_ids: categoryMap?.get(product.product_id) ?? [],
            slug: seoMap.get(`product_id=${product.product_id}`) ?? null,
        };
    });

    if (sort === "name_asc") {
        items.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    }

    return { items, total: items.length };
};
const buildFilterList = async (productIds, selectedIds) => {
    if (!productIds.length) return [];

    const productFilters = await prisma.oc_product_filter.findMany({
        where: { product_id: { in: productIds } },
        select: { filter_id: true },
    });

    const filterIds = [...new Set(productFilters.map((pf) => pf.filter_id))];
    if (!filterIds.length) return [];

    const [filters, filterDescriptions] = await Promise.all([
        prisma.oc_filter.findMany({
            where: { filter_id: { in: filterIds } },
        }),
        prisma.oc_filter_description.findMany({
            where: { filter_id: { in: filterIds }, language_id: LANGUAGE_ID },
            select: { filter_id: true, name: true },
        }),
    ]);

    const groupIds = [...new Set(filters.map((f) => f.filter_group_id))];
    const [groups, groupDescriptions] = await Promise.all([
        prisma.oc_filter_group.findMany({
            where: { filter_group_id: { in: groupIds } },
            orderBy: { sort_order: "asc" },
        }),
        prisma.oc_filter_group_description.findMany({
            where: { filter_group_id: { in: groupIds }, language_id: LANGUAGE_ID },
            select: { filter_group_id: true, name: true },
        }),
    ]);

    const selectedSet = new Set(selectedIds);

    const excludedNames = [
        "greeting card",
        "no. of colours in logo",
        "message on greeting card",
        "choose a greeting card",
    ];

    return groups
        .map((g) => {
            const groupDesc = groupDescriptions.find((gd) => gd.filter_group_id === g.filter_group_id);
            const name = groupDesc?.name || "Filter";
            return {
                id: g.filter_group_id,
                name,
                type: "filter",
                filters: filters
                    .filter((f) => f.filter_group_id === g.filter_group_id)
                    .map((f) => {
                        const desc = filterDescriptions.find((fd) => fd.filter_id === f.filter_id);
                        return {
                            id: f.filter_id,
                            name: desc?.name || "",
                            selected: selectedSet.has(f.filter_id),
                        };
                    }),
            };
        })
        .filter((group) => {
            const lowerName = group.name.toLowerCase();
            return !excludedNames.some((excluded) => lowerName.includes(excluded));
        });
};
const paginateItems = (items, page, limit) => {
    const total = items.length;
    const start = (page - 1) * limit;
    return {
        items: items.slice(start, start + limit),
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit) || 0,
    };
};
const buildBrandList = (allProducts, manufacturers, seoMap, selectedIds) => {
    const selectedSet = new Set(selectedIds);

    return manufacturers.map((m) => {
        const count = allProducts.filter((p) => p.manufacturer_id === m.manufacturer_id).length;
        return {
            id: m.manufacturer_id,
            name: m.name,
            image: m.image ?? null,
            slug: seoMap.get(`manufacturer_id=${m.manufacturer_id}`) ?? null,
            product_count: count,
            selected: selectedSet.has(m.manufacturer_id),
        };
    });
};
const buildOptionList = async (productIds, selectedIds) => {
    if (!productIds.length) return [];

    const productOptions = await prisma.oc_product_option_value.findMany({
        where: { product_id: { in: productIds } },
        select: { option_id: true, option_value_id: true },
    });

    const optionIds = [...new Set(productOptions.map((po) => po.option_id))];
    const optionValueIds = [...new Set(productOptions.map((po) => po.option_value_id))];

    if (!optionIds.length) return [];

    const [options, optionDescriptions, optionValues, optionValueDescriptions] = await Promise.all([
        prisma.oc_option.findMany({
            where: { option_id: { in: optionIds } },
            orderBy: { sort_order: "asc" },
        }),
        prisma.oc_option_description.findMany({
            where: { option_id: { in: optionIds }, language_id: LANGUAGE_ID },
            select: { option_id: true, name: true },
        }),
        prisma.oc_option_value.findMany({
            where: { option_value_id: { in: optionValueIds } },
            orderBy: { sort_order: "asc" },
        }),
        prisma.oc_option_value_description.findMany({
            where: { option_value_id: { in: optionValueIds }, language_id: LANGUAGE_ID },
            select: { option_value_id: true, name: true },
        }),
    ]);
    const selectedSet = new Set(selectedIds);

    const excludedNames = [
        "greeting card",
        "no. of colours in logo",
        "message on greeting card",
        "choose a greeting card",
        "engrave the bottle",
        "engraving message"
    ];

    return options
        .map((o) => {
            const optionDesc = optionDescriptions.find((od) => od.option_id === o.option_id);
            const name = optionDesc?.name || "Option";
            return {
                id: o.option_id,
                name,
                type: "option",
                filters: optionValues
                    .filter((ov) => ov.option_id === o.option_id)
                    .map((ov) => {
                        const desc = optionValueDescriptions.find((ovd) => ovd.option_value_id === ov.option_value_id);
                        return {
                            id: ov.option_value_id,
                            name: desc?.name || "",
                            image: ov.image || null,
                            selected: selectedSet.has(ov.option_value_id),
                        };
                    }),
            };
        })
        .filter((option) => {
            const lowerName = option.name.toLowerCase();
            return !excludedNames.some((excluded) => lowerName.includes(excluded.toLowerCase()));
        });
};
const filterProducts = (items, filters) => {
    const {
        manufacturerIds = [],
        subcategoryIds = [],
        filterIds = [],
        optionIds = [],
        minPrice,
        maxPrice,
        inStock,
        productFilterMap,
        productOptionMap,
    } = filters;

    let filtered = items;

    if (manufacturerIds.length > 0) {
        const allowed = new Set(manufacturerIds);
        filtered = filtered.filter(
            (p) => p.manufacturer_id && allowed.has(p.manufacturer_id)
        );
    }

    if (subcategoryIds.length > 0) {
        const allowed = new Set(subcategoryIds);
        filtered = filtered.filter((p) =>
            p.category_ids?.some((id) => allowed.has(id))
        );
    }

    if (filterIds.length > 0 && productFilterMap) {
        filtered = filtered.filter((p) => {
            const productFilters = productFilterMap.get(p.id) ?? [];
            return filterIds.every((fid) => productFilters.includes(fid));
        });
    }

    if (optionIds.length > 0 && productOptionMap) {
        filtered = filtered.filter((p) => {
            const productOptions = productOptionMap.get(p.id) ?? [];
            return optionIds.every((oid) => productOptions.includes(oid));
        });
    }

    if (minPrice != null) {
        filtered = filtered.filter((p) => getEffectivePrice(p) >= minPrice);
    }

    if (maxPrice != null) {
        filtered = filtered.filter((p) => getEffectivePrice(p) <= maxPrice);
    }

    if (inStock === true) {
        filtered = filtered.filter((p) => p.in_stock);
    } else if (inStock === false) {
        filtered = filtered.filter((p) => !p.in_stock);
    }

    return filtered;
};

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

export const getAllProductsServices = async (page = 1, limit = 24) => {
    const [allbrand, allparentCategory, allproducts] = await Promise.all([
        allbrandData(),
        allParentCategoryData(),
        allProductsData(),
    ]);

    // Paginate products
    const start = (page - 1) * limit;
    const paginatedProducts = allproducts.slice(start, start + limit);
    const total = allproducts.length;
    const totalPages = Math.ceil(total / limit);

    return {
        allbrand,
        allparentCategory,
        allproducts: paginatedProducts,
        total,
        page,
        limit,
        totalPages,
    };
};

const isDateActive = (start, end, now) => {

    const startYear = start ? start.getFullYear() : null;
    const endYear = end ? end.getFullYear() : null;
    const startOk = !start || Number.isNaN(startYear) || startYear <= 1970 || start <= now;
    const endOk = !end || Number.isNaN(endYear) || endYear <= 1970 || end >= now;

    return startOk && endOk;
};

const resolveSlugOrId = async (slugOrId) => {

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


    if (!isNaN(slugOrId)) {
        const id = Number(slugOrId);

        const product = await prisma.oc_product.findUnique({ where: { product_id: id } });
        if (product) return { type: "product", id };

        const category = await prisma.oc_category.findUnique({ where: { category_id: id } });
        if (category) return { type: "category", id };

        const manufacturer = await prisma.oc_manufacturer.findUnique({ where: { manufacturer_id: id } });
        if (manufacturer) return { type: "manufacturer", id };
    }

    return null;
};

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

const getCategoryData = async (categoryId) => {
    const [category, categoryDesc, subCategories, productLinks, breadcrumbs] = await Promise.all([
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
        buildBreadcrumbs(categoryId),
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
        breadcrumbs
    };
};

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
        .filter((s) => isDateActive(s?.date_start, s?.date_end, now))
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


    const manufacturer_seo = await prisma.oc_seo_url.findFirst({
        where: { query: `manufacturer_id=${manufacturer?.manufacturer_id}`, store_id: STORE_ID, language_id: LANGUAGE_ID },
        select: { keyword: true },
    })
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
            ? { manufacturer_id: manufacturer.manufacturer_id, name: manufacturer.name, image: manufacturer.image, manufacturer_seo_url: manufacturer_seo?.keyword ?? null }
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

export const getSingleProductDetailsService = async (slugOrId) => {
    const resolved = await resolveSlugOrId(slugOrId);

    if (!resolved || resolved.type !== "product") {
        return { type: "not_found" };
    }

    const data = await getFullProductData(resolved.id);

    return data ?? { type: "not_found" };
};

export const searchAllProductService = async (query) => {
    const searchText = query.data?.toString().trim() || "";
    const searchInt = parseInt(searchText);
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;
    const now = new Date();
    const zeroDate = new Date("0000-01-01");
    const searchPattern = `%${searchText}%`;

    if (!searchText) {
        return { data: [], total: 0, page, limit, total_pages: 0 };
    }

    const productIdCondition = !isNaN(searchInt)
        ? Prisma.sql`OR p.product_id = ${searchInt}`
        : Prisma.empty;

    // COUNT query
    const countResult = await prisma.$queryRaw`
    SELECT COUNT(*) as total
    FROM oc_product p
    WHERE p.status = 1 AND (
      p.model LIKE ${searchPattern}
      OR p.sku LIKE ${searchPattern}
      OR p.upc LIKE ${searchPattern}
      ${productIdCondition}
      OR EXISTS (
        SELECT 1 FROM oc_product_description pd
        WHERE pd.product_id = p.product_id
          AND pd.language_id = ${LANGUAGE_ID}
          AND (
            pd.name LIKE ${searchPattern}
            OR pd.description LIKE ${searchPattern}
            OR pd.tag LIKE ${searchPattern}
            OR pd.meta_keyword LIKE ${searchPattern}
          )
      )
    )
  `;
    const totalItems = Number(countResult[0].total);

    // MAIN search query
    const searchData = await prisma.$queryRaw`
    SELECT 
      p.product_id,
      p.model,
      p.sku,
      p.price,
      p.image,
      pd.name,
      ps.price AS special_price
    FROM oc_product p
    LEFT JOIN oc_product_description pd
      ON pd.product_id = p.product_id AND pd.language_id = ${LANGUAGE_ID}
    LEFT JOIN oc_product_special ps
      ON ps.product_id = p.product_id
      AND (ps.date_start <= ${now} OR ps.date_start = ${zeroDate})
      AND (ps.date_end >= ${now} OR ps.date_end = ${zeroDate})
      AND ps.price = (
        SELECT MIN(ps2.price) FROM oc_product_special ps2
        WHERE ps2.product_id = p.product_id
          AND (ps2.date_start <= ${now} OR ps2.date_start = ${zeroDate})
          AND (ps2.date_end >= ${now} OR ps2.date_end = ${zeroDate})
      )
    WHERE p.status = 1 AND (
      p.model LIKE ${searchPattern}
      OR p.sku LIKE ${searchPattern}
      OR p.upc LIKE ${searchPattern}
      ${productIdCondition}
      OR EXISTS (
        SELECT 1 FROM oc_product_description pd2
        WHERE pd2.product_id = p.product_id
          AND pd2.language_id = ${LANGUAGE_ID}
          AND (
            pd2.name LIKE ${searchPattern}
            OR pd2.description LIKE ${searchPattern}
            OR pd2.tag LIKE ${searchPattern}
            OR pd2.meta_keyword LIKE ${searchPattern}
          )
      )
    )
    LIMIT ${limit} OFFSET ${skip}
  `;

    // SEO slugs
    const productIds = searchData.map((p) => `product_id=${p.product_id}`);
    const seoUrls = productIds.length > 0
        ? await prisma.oc_seo_url.findMany({
            where: { query: { in: productIds }, store_id: 0, language_id: LANGUAGE_ID },
            select: { query: true, keyword: true },
        })
        : [];
    const slugMap = Object.fromEntries(
        seoUrls.map((s) => [s.query.split("product_id=")[1], s.keyword])
    );

    return {
        data: searchData.map((s) => ({
            product_id: s.product_id,
            name: s.name,
            image: s.image,
            price: Number(s.price),
            special_price: s.special_price ? Number(s.special_price) : null,
            slug: slugMap[s.product_id] || null,
            model: s.model,
            sku: s.sku,
        })),
        total: totalItems,
        page,
        limit,
        total_pages: Math.ceil(totalItems / limit)
    };
};

export const getSearchResultsService = async (query) => {
    const searchText = query.search?.toString().trim() || "";
    const page = parsePositiveInt(query.page, 1);
    const limit = Math.min(parsePositiveInt(query.limit, 24), 100);
    const sort = query.sort || "default";
    const filters = parseCategoryFilters(query);

    if (!searchText) {
        return {
            type: "search",
            search_query: "",
            breadcrumbs: [],
            dynamic_filters: [],
            brands: [],
            filters: {
                price: { min: null, max: null },
                filtered_price: { min: null, max: null },
                availability: { in_stock: 0, out_of_stock: 0 },
                applied: {},
                has_active_filters: false,
            },
            products: { items: [], total: 0, page, limit, total_pages: 0 },
        };
    }

    const searchInt = parseInt(searchText);
    const now = new Date();
    const zeroDate = new Date("0000-01-01");
    const searchPattern = `%${searchText}%`;

    const productIdCondition = !isNaN(searchInt)
        ? Prisma.sql`OR p.product_id = ${searchInt}`
        : Prisma.empty;

    // Get all matching product IDs
    const productIdRows = await prisma.$queryRaw`
        SELECT DISTINCT p.product_id
        FROM oc_product p
        WHERE p.status = 1 AND (
            p.model LIKE ${searchPattern}
            OR p.sku LIKE ${searchPattern}
            OR p.upc LIKE ${searchPattern}
            ${productIdCondition}
            OR EXISTS (
                SELECT 1 FROM oc_product_description pd
                WHERE pd.product_id = p.product_id
                  AND pd.language_id = ${LANGUAGE_ID}
            
                   AND (
            pd.name LIKE ${searchPattern}
            OR pd.description LIKE ${searchPattern}
            OR pd.tag LIKE ${searchPattern}
            OR pd.meta_keyword LIKE ${searchPattern}
          )
            )
        )
    `;

    const productIds = productIdRows.map(row => Number(row.product_id));

    const [categoryMap, productFilterMap, productOptionMap] = await Promise.all([
        getProductCategoryMap(productIds),
        filters.filterIds.length > 0
            ? getProductFilterMap(productIds)
            : Promise.resolve(new Map()),
        filters.optionIds.length > 0
            ? getProductOptionMap(productIds)
            : Promise.resolve(new Map()),
    ]);

    const { items: catalogProducts } = await mapProducts(productIds, {
        sort,
        categoryMap,
    });

    const allPrices = catalogProducts
        .map((itme) => getEffectivePrice(itme?.price, itme?.special_price))
        .filter(Number.isFinite);

    const allManufacturerIds = [
        ...new Set(catalogProducts.map((p) => p.manufacturer_id).filter((id) => id > 0)),
    ];

    const allManufacturers =
        allManufacturerIds.length > 0
            ? await prisma.oc_manufacturer.findMany({
                where: { manufacturer_id: { in: allManufacturerIds } },
                orderBy: [{ sort_order: "asc" }, { name: "asc" }],
                select: { manufacturer_id: true, name: true, image: true },
            })
            : [];

    const brandSeo = await fetchSeoMap(
        allManufacturers.map((m) => `manufacturer_id=${m.manufacturer_id}`)
    );

    const [dynamicFilters, optionFilters] = await Promise.all([
        buildFilterList(productIds, filters.filterIds),
        buildOptionList(productIds, filters.optionIds),
    ]);

    const filtered = filterProducts(catalogProducts, {
        ...filters,
        productFilterMap,
        productOptionMap,
    });

    const filteredPrices = filtered.map(item =>
        getEffectivePrice(item?.price, item?.special_price)
    ).filter(Number.isFinite);


    const selectedManufacturers = allManufacturers.filter((m) =>
        filters.manufacturerIds.includes(m.manufacturer_id)
    );

    const paginated = paginateItems(filtered, page, limit);

    return {
        type: "search",
        search_query: searchText,
        breadcrumbs: [],
        dynamic_filters: [...dynamicFilters, ...optionFilters],
        brands: buildBrandList(
            catalogProducts,
            allManufacturers,
            brandSeo,
            filters.manufacturerIds
        ),
        filters: {
            price: {
                min: allPrices.length ? Math.min(...allPrices) : null,
                max: allPrices.length ? Math.max(...allPrices) : null,
            },
            filtered_price: {
                min: filteredPrices.length ? Math.min(...filteredPrices) : null,
                max: filteredPrices.length ? Math.max(...filteredPrices) : null,
            },
            availability: {
                in_stock: catalogProducts.filter((p) => p.in_stock).length,
                out_of_stock: catalogProducts.filter((p) => !p.in_stock).length,
            },
            applied: {
                manufacturers: selectedManufacturers.map((m) => ({
                    id: m.manufacturer_id,
                    name: m.name,
                    slug: brandSeo.get(`manufacturer_id=${m.manufacturer_id}`) ?? null,
                })),
                subcategories: filters.subcategoryIds,
                filter_ids: filters.filterIds,
                option_ids: filters.optionIds,
                min_price: filters.minPrice,
                max_price: filters.maxPrice,
                in_stock: filters.inStock,
            },
            has_active_filters: filters.hasFilters,
        },
        products: {
            ...paginated,
            items: paginated.items.map(({ category_ids, ...product }) => product),
        },
    };
};

export const mostviewdproductservice = async () => {

    const result = await prisma.oc_product.findMany({
        where: { status: true },
        orderBy: { viewed: "desc" },
        take: 4,
        select: {
            product_id: true,
            model: true,
            sku: true,
            price: true,
            status: true,
            image: true,
            quantity: true,
            viewed: true,
            oc_product_description: {
                where: { language_id: 1 },
                select: {
                    name: true,
                },
            },
            oc_product_special: {
                where: {
                    customer_group_id: 1,
                },
                orderBy: { priority: "asc" },
                select: {
                    price: true,
                    date_start: true,
                    date_end: true,
                }
            }
        },
    });

    const productIds = result.map(p => `product_id=${p.product_id}`);
    const seoUrls = await prisma.oc_seo_url.findMany({
        where: {
            query: { in: productIds },
            store_id: 0,
            language_id: 1,
        },
        select: { query: true, keyword: true }
    });
    const slugMap = {};
    seoUrls.forEach(s => {
        const id = s.query.split('product_id=')[1];
        slugMap[id] = s.keyword;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isValidSpecial = (special) => {
        const start = new Date(special.date_start);
        const end = new Date(special.date_end);
        const startOk = isNaN(start.getTime()) || start <= today;
        const endOk = isNaN(end.getTime()) || end >= today;
        return startOk && endOk;
    };

    const flatItems = result.map(({ oc_product_description, oc_product_special, ...product }) => {
        const validSpecial = oc_product_special.find(isValidSpecial);

        return {
            ...product,
            name: oc_product_description[0]?.name ?? null,
            original_price: product.price,
            special_price: validSpecial?.price ?? null,
            slug: slugMap[product.product_id] ?? null,
        };
    });

    return flatItems;
}