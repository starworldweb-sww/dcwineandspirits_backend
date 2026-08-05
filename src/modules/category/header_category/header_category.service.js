import { prisma } from "../../../../lib/prisma.js"



const DEFAULT_STORE_ID = 0
const DEFAULT_LANGUAGE_ID = 1
const DEFAULT_CUSTOMER_GROUP_ID = 1
const typeToQueryKey = {
    category: "category_id",
    product: "product_id",
    manufacturer: "manufacturer_id",
    information: "information_id",
}
export const headerTopCategoryService = async () => {

    const data = await prisma.oc_journal3_module.findFirst({
        where: { module_id: 3, module_type: "main_menu" },
        select: {
            module_data: true
        }
    })

    const parsed = JSON.parse(data?.module_data);
    const item = parsed.items?.filter((i) => i?.status?.status === true || i?.status?.status === "true").map((item) => ({
        title: item?.title?.lang_1,
    }))

    return item
}
export const giftdropDownService = async () => {

    const data = await prisma.oc_journal3_module.findFirst({
        where: { module_id: 7, module_type: "flyout_menu" },
        select: {
            module_data: true
        }
    })

    const parsed = JSON.parse(data?.module_data);
    const item = parsed.items?.filter((i) => i?.status?.status === true || i?.status?.status === "true").map((item) => ({
        title: item?.title?.lang_1,
    }))

    return item
}
const getModuleData = async (module_id, module_type) => {
    const record = await prisma.oc_journal3_module.findFirst({
        where: { module_id, module_type },
        select: { module_data: true },
    })

    if (!record?.module_data) return { heading: null, items: [] }

    let parsed
    try {
        parsed = JSON.parse(record.module_data)
    } catch (err) {
        console.error(`Failed to parse module_data for module_id=${module_id}:`, err)
        return { heading: null, items: [] }
    }

    const heading = parsed?.general?.title?.lang_1 ?? null

    const items = Array.isArray(parsed?.items)
        ? parsed.items.filter(
            (i) => i?.status?.status === true || i?.status?.status === "true"
        )
        : []

    const general = parsed?.general?.status?.status === "true" ? parsed?.general : null;

    return { heading, items, general }
}
 export const getSeoUrl = async (type, id) => {
    if (!id || !type) return null

    const queryKey = typeToQueryKey[type]
    if (!queryKey) return null

    const exactQuery = `${queryKey}=${id}`

    const seo = await prisma.oc_seo_url.findFirst({
        where: {
            store_id: DEFAULT_STORE_ID,
            language_id: DEFAULT_LANGUAGE_ID,
            OR: [
                { query: exactQuery },
                { query: { startsWith: `${exactQuery}&` } },
            ],
        },
        select: { keyword: true },
    })

    return seo?.keyword ?? null
}
const formatItemsWithSeoUrl = async (items) => {
    return Promise.all(
        items.map(async (item) => {
            const seo_url = await getSeoUrl(item?.link?.type, item?.link?.id)
            return {
                title: item?.title?.lang_1,
                type: item?.link?.type,
                id: item?.link?.id,
                seo_url,
            }
        })
    )
}
const formatLinkItems = async (items) => {
    return Promise.all(
        items.map(async (item) => {
            const seo_url = await getSeoUrl(item?.link?.type, item?.link?.id)
            return {
                title: item?.title?.lang_1,
                type: item?.link?.type || "",
                id: item?.link?.id || "",
                seo_url,
            }
        })
    )
}
const formatBannerItems = async (items) => {
    return Promise.all(
        items.map(async (item) => {
            const seo_url = await getSeoUrl(item?.link?.type, item?.link?.id)
            return {
                title: item?.title?.lang_1,
                type: item?.link?.type || "",
                id: item?.link?.id || "",
                custom_url: item?.link?.url,
                image: item?.image?.lang_1,
                alt: item?.alt?.lang_1,
                seo_url
            }
        })
    )
}
const formatInfoBlockItems = async (items) => {
    return Promise.all(
        items.map(async (item) => {
            const seo_url = await getSeoUrl(item?.link?.type, item?.link?.id)
            return {
                title: item?.title?.lang_1,
                type: item?.link?.type || "",
                id: item?.link?.id || "",
                custom_url: item?.link?.url,
                image: item?.image?.lang_1,
                alt: item?.alt?.lang_1,
                seo_url
            }
        })
    )
}

const getProductsByIds = async (ids = []) => {
    const numericIds = [...new Set(ids.map(Number).filter(Boolean))]
    if (!numericIds.length) return []

    const products = await prisma.oc_product.findMany({
        where: {
            product_id: { in: numericIds },
            status: true,
        },
        select: {
            product_id: true,
            model: true,
            image: true,
            price: true,
            quantity: true,
        },
    })

    if (!products.length) return []

    const productIds = products.map((p) => p.product_id)

    const descriptions = await prisma.oc_product_description.findMany({
        where: {
            product_id: { in: productIds },
            language_id: DEFAULT_LANGUAGE_ID,
        },
        select: { product_id: true, name: true },
    })
    const nameMap = new Map(descriptions.map((d) => [d.product_id, d.name]))

    // special price — date filter query se hataya, JS me handle kiya (zero-date issue ki wajah se)
    const specials = await prisma.oc_product_special.findMany({
        where: {
            product_id: { in: productIds },
            customer_group_id: DEFAULT_CUSTOMER_GROUP_ID,
        },
        orderBy: { priority: "asc" },
        select: {
            product_id: true,
            price: true,
            date_start: true,
            date_end: true,
        },
    })

    const today = new Date()
    const isZeroDate = (d) => {
        if (!d) return true
        const year = new Date(d).getFullYear()
        return isNaN(year) || year <= 1971
    }

    const activeSpecials = specials.filter((s) => {
        const startOk = isZeroDate(s.date_start) || new Date(s.date_start) <= today
        const endOk = isZeroDate(s.date_end) || new Date(s.date_end) >= today
        return startOk && endOk
    })

    const specialMap = new Map()
    for (const s of activeSpecials) {
        if (!specialMap.has(s.product_id)) {
            specialMap.set(s.product_id, s.price)
        }
    }

    const seoUrls = await prisma.oc_seo_url.findMany({
        where: {
            store_id: DEFAULT_STORE_ID,
            language_id: DEFAULT_LANGUAGE_ID,
            OR: productIds.map((id) => ({ query: `product_id=${id}` })),
        },
        select: { query: true, keyword: true },
    })
    const seoMap = new Map(seoUrls.map((s) => [s.query, s.keyword]))

    const productMap = new Map(products.map((p) => [p.product_id, p]))

    return numericIds
        .filter((id) => productMap.has(id))
        .map((id) => {
            const p = productMap.get(id)
            const specialPrice = specialMap.get(id) ?? null

            return {
                id: p.product_id,
                name: nameMap.get(id) ?? null,
                image: p.image ?? null,
                price: p.price,
                special_price: specialPrice,
                seo_url: seoMap.get(`product_id=${id}`) ?? null,
            }
        })
}
const getLatestProductIds = async (limit) => {
    const products = await prisma.oc_product.findMany({
        where: { status: true },
        orderBy: { date_added: "desc" },
        take: limit,
        select: { product_id: true },
    })
    return products.map((p) => p.product_id)
}


const getSpecialProductIds = async (limit) => {
    const specials = await prisma.oc_product_special.findMany({
        where: { customer_group_id: DEFAULT_CUSTOMER_GROUP_ID },
        orderBy: { priority: "asc" },
        select: { product_id: true, date_start: true, date_end: true },
    })

    const today = new Date()
    const isZeroDate = (d) => {
        if (!d) return true
        const year = new Date(d).getFullYear()
        return isNaN(year) || year <= 1971
    }

    const activeProductIds = [
        ...new Set(
            specials
                .filter((s) => {
                    const startOk = isZeroDate(s.date_start) || new Date(s.date_start) <= today
                    const endOk = isZeroDate(s.date_end) || new Date(s.date_end) >= today
                    return startOk && endOk
                })
                .map((s) => s.product_id)
        ),
    ]

    if (!activeProductIds.length) return []

    const validProducts = await prisma.oc_product.findMany({
        where: {
            product_id: { in: activeProductIds },
            status: true,
        },
        orderBy: { date_added: "desc" },
        take: limit,
        select: { product_id: true },
    })

    return validProducts.map((p) => p.product_id)
}

const formatProductsItems = async (items) => {
    return Promise.all(
        items.map(async (item) => {
            const limit = Number(item?.filter?.limit) || 12
            const preset = item?.filter?.preset
            let productIds = item?.filter?.products ?? []

            if (!productIds.length) {
                if (preset === "latest") {
                    productIds = await getLatestProductIds(limit)
                } else if (preset === "special") {
                    productIds = await getSpecialProductIds(limit)
                }
            }

            const products = await getProductsByIds(productIds)

            return {
                title: item?.title?.lang_1,
                name: item?.name,
                tabType: item?.tabType,
                type: item?.link?.type || "",
                id: item?.link?.id || "",
                custom_url: item?.link?.url,
                limit: item?.filter?.limit,
                preset: item?.filter?.preset,
                products,
            }
        })
    )
}
const formatTitleItems = async (general) => {
    return general?.subtitle?.lang_1 ?? null
}
const formatblocksItems = async (items) => {
    return Promise.all(
        items.map(async (item) => {

            return {
                content: item?.content?.lang_1 ?? "",

            }
        })
    )
}
const formatManufacturerItems = async (items) => {
    const allIds = [
        ...new Set(
            items.flatMap((i) => (Array.isArray(i?.manufacturers) ? i.manufacturers : []))
                .map(Number)
                .filter(Boolean)
        ),
    ]

    if (!allIds.length) return []

    const manufacturers = await prisma.oc_manufacturer.findMany({
        where: { manufacturer_id: { in: allIds } },
        select: { manufacturer_id: true, name: true, image: true },
    })

    const seoUrls = await prisma.oc_seo_url.findMany({
        where: {
            store_id: DEFAULT_STORE_ID,
            language_id: DEFAULT_LANGUAGE_ID,
            OR: allIds.map((id) => ({ query: `manufacturer_id=${id}` })),
        },
        select: { query: true, keyword: true },
    })

    const seoMap = new Map(seoUrls.map((s) => [s.query, s.keyword]))
    const manuMap = new Map(manufacturers.map((m) => [m.manufacturer_id, m]))

    return allIds
        .map((id) => manuMap.get(id))
        .filter(Boolean)
        .map((m) => ({
            title: m.name,
            id: m.manufacturer_id,
            image: m.image ?? null,
            seo_url: seoMap.get(`manufacturer_id=${m.manufacturer_id}`) ?? null,
        }))
}
const buildSection = async (module_id, module_type) => {
    const { heading, items, general } = await getModuleData(module_id, module_type)
    let formattedItems;

    if (module_type === "manufacturers") {
        formattedItems = await formatManufacturerItems(items);
    } else if (module_type === "banners") {
        formattedItems = await formatBannerItems(items);
    } else if (module_type === "title") {
        formattedItems = await formatTitleItems(general)
    } else if (module_type === "info_blocks") {
        formattedItems = await formatInfoBlockItems(items)
    } else if (module_type === "blocks") {
        formattedItems = await formatblocksItems(items)
    } else if (module_type === "products") {
        formattedItems = await formatProductsItems(items)
    } else {
        formattedItems = await formatLinkItems(items);
    }

    return { heading, items: formattedItems, }
}
export const giftdropDown_Shop_by_CategoryService = async () => {
    const [flyoutMenu, linksMenu376, linksMenu377, linksMenu367] = await Promise.all([
        buildSection(7, "flyout_menu"),
        buildSection(376, "links_menu"),
        buildSection(377, "links_menu"),
        buildSection(367, "links_menu"),
    ])

    const labelItem = flyoutMenu.items.find((i) => !i.type && !i.id)



    return {
        heading: labelItem?.title || flyoutMenu.heading || "Shop by Category",
        sections: [
            linksMenu376,
            linksMenu377,
            linksMenu367,
        ],
    }
}
export const giftdropDownGifts_By_OriginService = async () => {
    const [flyoutMenu, linksMenu356, linksMenu370, linksMenu205] = await Promise.all([
        buildSection(7, "flyout_menu"),
        buildSection(356, "links_menu"),
        buildSection(370, "manufacturers"),
        buildSection(205, "links_menu"),
    ])

    const labelItem = flyoutMenu.items.find((i) => !i.type && !i.id)

    return {
        heading: labelItem?.title || flyoutMenu.heading || "Gifts By Origin",
        sections: [linksMenu356, linksMenu370, linksMenu205],
    }
}
export const giftdropDownShopByPriceService = async () => {
    const data = await prisma.oc_journal3_module.findFirst({
        where: { module_id: 7, module_type: "flyout_menu" },
        select: { module_data: true },
    })

    if (!data?.module_data) return { heading: "Shop By Price", items: [] }

    let parsed
    try {
        parsed = JSON.parse(data.module_data)
    } catch (err) {
        console.error("Failed to parse module_data for shop by price:", err)
        return { heading: "Shop By Price", items: [] }
    }

    const items = Array.isArray(parsed?.items)
        ? parsed.items
            .filter(
                (i) => i?.status?.status === true || i?.status?.status === "true"
            )
            .map((e) => ({
                type: e?.link?.type,
                id: e?.link?.id,
                title: e?.title?.lang_1,
            }))
        : []

    const filterItems = items.filter((i) => i?.title === "Shop By Price")

    if (!filterItems.length) return { heading: "Shop By Price", items: [] }

    const parentId = Number(filterItems[0]?.id)
    if (!parentId) return { heading: "Shop By Price", items: [] }

    // parent_id se subcategories nikalo
    const subcategories = await prisma.oc_category.findMany({
        where: {
            parent_id: parentId,
            status: true, // agar status boolean nahi, int hai to 1 kar dena
        },
        select: {
            category_id: true,
        },
    })

    if (!subcategories.length) return { heading: "Shop By Price", items: [] }

    const categoryIds = subcategories.map((c) => c.category_id)

    // names fetch karo (multilingual table se)
    const descriptions = await prisma.oc_category_description.findMany({
        where: {
            category_id: { in: categoryIds },
            language_id: DEFAULT_LANGUAGE_ID,
        },
        select: {
            category_id: true,
            name: true,
        },
    })

    const nameMap = new Map(descriptions.map((d) => [d.category_id, d.name]))

    // seo urls batch me fetch karo
    const seoUrls = await prisma.oc_seo_url.findMany({
        where: {
            store_id: DEFAULT_STORE_ID,
            language_id: DEFAULT_LANGUAGE_ID,
            OR: categoryIds.map((id) => ({ query: `category_id=${id}` })),
        },
        select: { query: true, keyword: true },
    })

    const seoMap = new Map(seoUrls.map((s) => [s.query, s.keyword]))

    const result = categoryIds.map((id) => ({
        id,
        name: nameMap.get(id) ?? null,
        slug: seoMap.get(`category_id=${id}`) ?? null,
    }))

    return { heading: "Shop By Price", items: result }
}
export const shopByBrandeService = async () => {
    const data = await prisma.oc_journal3_module.findFirst({
        where: {
            module_id: 264,
            module_type: "catalog",
        },
        select: { module_data: true },
    })

    if (!data?.module_data) return { heading: null, items: [] }

    let parsed
    try {
        parsed = JSON.parse(data.module_data)
    } catch (err) {
        console.error("Failed to parse module_data for shop by brand:", err)
        return { heading: null, items: [] }
    }

    const heading = parsed?.general?.name ?? parsed?.general?.title?.lang_1 ?? null

    const manufacturerIds = [
        ...new Set(
            (parsed.items ?? [])
                .filter(
                    (i) => i?.status?.status === true || i?.status?.status === "true"
                )
                .map((i) => Number(i?.manufacturer))
                .filter(Boolean)
        ),
    ]

    if (!manufacturerIds.length) return { heading, items: [] }


    const storeLinks = await prisma.oc_manufacturer_to_store.findMany({
        where: {
            manufacturer_id: { in: manufacturerIds },
            store_id: 0,
        },
        select: { manufacturer_id: true },
    })

    const validIds = storeLinks.map((s) => s.manufacturer_id)
    if (!validIds.length) return { heading, items: [] }


    const manufacturers = await prisma.oc_manufacturer.findMany({
        where: { manufacturer_id: { in: validIds } },
        select: { manufacturer_id: true, name: true, image: true },
    })


    const seoUrls = await prisma.oc_seo_url.findMany({
        where: {
            store_id: DEFAULT_STORE_ID,
            language_id: DEFAULT_LANGUAGE_ID,
            OR: validIds.map((id) => ({ query: `manufacturer_id=${id}` })),
        },
        select: { query: true, keyword: true },
    })

    const seoMap = new Map(seoUrls.map((s) => [s.query, s.keyword]))
    const manuMap = new Map(manufacturers.map((m) => [m.manufacturer_id, m]))


    const items = manufacturerIds
        .filter((id) => manuMap.has(id))
        .map((id) => {
            const m = manuMap.get(id)
            return {
                id: m.manufacturer_id,
                name: m.name,
                image: m.image ?? null,
                slug: seoMap.get(`manufacturer_id=${m.manufacturer_id}`) ?? null,
            }
        })

    return { heading, items }
}
export const personalizationService = async () => {

    const [linksMenu353, linksMenu354, linksMenu308, linksMenu205] = await Promise.all([
        buildSection(353, "links_menu"),
        buildSection(354, "links_menu"),
        buildSection(308, "banners"),
        buildSection(205, "links_menu"),
    ])


    return {
        sections: [
            linksMenu353,
            linksMenu354,
            linksMenu308,
            linksMenu205,
        ],
    }


}
export const wineGiftService = async () => {

    const [linksMenu358, linksMenu360, linksMenu359, linksMenu361, linksMenu362, linksMenu378, links205] = await Promise.all([
        buildSection(358, "links_menu"),
        buildSection(360, "links_menu"),
        buildSection(359, "links_menu"),
        buildSection(361, "links_menu"),
        buildSection(362, "links_menu"),
        buildSection(378, "links_menu"),
        buildSection(205, "links_menu"),
    ])


    return {
        sections: [
            linksMenu358, linksMenu360, linksMenu359, linksMenu361, linksMenu362, linksMenu378, links205
        ],
    }

}
export const occasionTreasuresService = async () => {

    const [linksMenu347, linksMenu348, linksMenu394, linksMenu98, links205] = await Promise.all([
        buildSection(347, "links_menu"),
        buildSection(348, "links_menu"),
        buildSection(349, "links_menu"),
        buildSection(98, "banners"),
        buildSection(205, "links_menu"),
    ])


    return {
        sections: [
            linksMenu347, linksMenu348, linksMenu394, linksMenu98, links205
        ],
    }

}
export const OccasionsMenuService = async () => {
    const [linksMenu368] = await Promise.all([
        buildSection(368, "links_menu"),
    ])
    return {
        sections: [
            linksMenu368
        ],
    }
}
export const homeTopBannerService = async () => {

    const [linksMenu379] = await Promise.all([
        buildSection(379, "banners"),
    ])
    return {
        sections: [
            linksMenu379
        ],
    }

}
export const topcategoriesService = async () => {

    const [linksMenu338, linksMenu339] = await Promise.all([
        buildSection(338, "banners"),
        buildSection(339, "title"),

    ])

    return {
        sections: [
            linksMenu338, linksMenu339
        ],
    }
}
export const loveBannersService = async () => {

    const [linksMenu309] = await Promise.all([
        buildSection(309, "banners"),
    ])
    return {
        sections: [
            linksMenu309
        ],
    }
}
export const giftbyOccasionService = async () => {

    const [linksMenu331, linksMenu330] = await Promise.all([
        buildSection(331, "title"),
        buildSection(330, "info_blocks"),
    ])
    return {
        sections: [
            linksMenu331,
            linksMenu330,

        ],
    }
}
export const homePageProductsService = async () => {

    const [linksMenu27] = await Promise.all([
        buildSection(27, "products"),
    ])
    return {
        sections: [
            linksMenu27
        ],
    }
}
export const shopByBrandTitleService = async () => {

    const [linksMenu374, linksMenu373] = await Promise.all([
        buildSection(374, "title"),
        buildSection(373, "info_blocks"),
    ])
    return {
        sections: [
            linksMenu374,
            linksMenu373
        ],
    }
}
export const homePageTextService = async () => {

    const [linksMenu328] = await Promise.all([
        buildSection(328, "blocks"),

    ])
    return {
        sections: [
            linksMenu328
        ],
    }
}