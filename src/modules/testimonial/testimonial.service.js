import { prisma } from "../../../lib/prisma.js";

const DEFAULT_STORE_ID = 0
const DEFAULT_LANGUAGE_ID = 1

// Ek page mein kitne reviews dikhane hain (default aur maximum)
const DEFAULT_PAGE_LIMIT = 12
const MAX_PAGE_LIMIT = 50

export const testimonialListService = async ({ page = 1, limit = DEFAULT_PAGE_LIMIT } = {}) => {
    // STEP 1: page aur limit ko safe numbers mein convert karo
    const safePage = Math.max(Number(page) || 1, 1)
    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT)
    const skipCount = (safePage - 1) * safeLimit

    // STEP 2: sirf approved reviews (status = true) hi dikhane hain
    const approvedReviewsFilter = { status: true }

    // STEP 3: total count aur average rating nikalo (pagination + header ke liye)
    const [totalReviews, ratingSummary] = await Promise.all([
        prisma.oc_review.count({ where: approvedReviewsFilter }),
        prisma.oc_review.aggregate({
            where: approvedReviewsFilter,
            _avg: { rating: true },
        }),
    ])

    const reviews = await prisma.oc_review.findMany({
        where: approvedReviewsFilter,
        orderBy: { date_added: "desc" },
        skip: skipCount,
        take: safeLimit,
        select: {
            review_id: true,
            author: true,
            text: true,
            rating: true,
            image: true,
            date_added: true,
            product_id: true,
        },
    })

    if (!reviews.length) {
        return {
            reviews: [],
            averageRating: 0,
            pagination: { page: safePage, limit: safeLimit, totalReviews, totalPages: 0 },
        }
    }

    const productIds = [...new Set(reviews.map((review) => review.product_id))]

    const productDescriptions = await prisma.oc_product_description.findMany({
        where: {
            product_id: { in: productIds },
            language_id: DEFAULT_LANGUAGE_ID,
        },
        select: { product_id: true, name: true },
    })
    const productNameMap = new Map(productDescriptions.map((d) => [d.product_id, d.name]))

    const productSeoUrls = await prisma.oc_seo_url.findMany({
        where: {
            store_id: DEFAULT_STORE_ID,
            language_id: DEFAULT_LANGUAGE_ID,
            OR: productIds.map((id) => ({ query: `product_id=${id}` })),
        },
        select: { query: true, keyword: true },
    })
    const productSeoMap = new Map(productSeoUrls.map((s) => [s.query, s.keyword]))

    const formattedReviews = reviews.map((review) => ({
        id: review.review_id,
        author: review.author,
        text: review.text,
        rating: review.rating,
        image: review.image ?? null,
        date: review.date_added,
        product_name: productNameMap.get(review.product_id) ?? null,
        product_seo_url: productSeoMap.get(`product_id=${review.product_id}`) ?? null,
    }))

    return {
        reviews: formattedReviews,
        averageRating: Number((ratingSummary._avg.rating ?? 0).toFixed(1)),
        pagination: {
            page: safePage,
            limit: safeLimit,
            totalReviews,
            totalPages: Math.ceil(totalReviews / safeLimit),
        },
    }
}