import { prisma } from "../../../lib/prisma.js";
import pkg from "@prisma/client";
const { Prisma } = pkg
const toSlug = (str) =>
    str
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

export const getAllPostsService = async ({ page = 1, limit = 10, categoryId, categorySlug } = {}) => {
    const skip = (page - 1) * limit;

    const where = { status: true };

    if (categoryId || categorySlug) {
        let finalCategoryId = categoryId;

        if (categorySlug && !finalCategoryId) {
            const cat = await prisma.oc_journal3_blog_category_description.findFirst({
                where: { keyword: categorySlug, language_id: 1 },
                select: { category_id: true }
            });
            if (cat) finalCategoryId = cat.category_id;
        }

        if (finalCategoryId) {
            where.post_id = {
                in: (await prisma.oc_journal3_blog_post_to_category.findMany({
                    where: { category_id: Number(finalCategoryId) },
                    select: { post_id: true }
                })).map(c => c.post_id)
            };
        } else if (categorySlug) {
            // If categorySlug was provided but no category found, return empty results
            return { posts: [], pagination: { total: 0, page, limit, totalPages: 0 } };
        }
    }

    const [posts, total] = await Promise.all([
        prisma.oc_journal3_blog_post.findMany({
            where,
            skip,
            take: limit,
            orderBy: [{ sort_order: "asc" }, { date_created: "desc" }],
            include: {
                oc_journal3_blog_post_description: {
                    where: { language_id: 1 },
                    select: {
                        name: true,
                        tags: true,
                        keyword: true,
                        description: true
                    },
                },
                oc_user: {
                    select: {
                        firstname: true,
                        lastname: true,
                    },
                },
            },
        }),

        prisma.oc_journal3_blog_post.count({ where }),
    ]);

    const formatted = posts.map((post) => {
        const desc = post.oc_journal3_blog_post_description?.[0] ?? {};

        return {
            post_id: post.post_id,
            author_id: post.author_id,
            author_firstname: post.oc_user?.firstname,
            author_lastname: post.oc_user?.lastname,
            image: post.image,
            status: post.status,
            sort_order: post.sort_order,
            date_created: post.date_created,
            date_updated: post.date_updated,
            title: desc.name ?? null,
            slug: desc.keyword ?? null,
            views: post.views,
            comments: post.comments,
            description: desc.description,
        };
    });

    return {
        posts: formatted,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

export const getAllBlogCategoriesService = async () => {
    const categories = await prisma.oc_journal3_blog_category.findMany({
        where: { status: true },
        orderBy: { sort_order: "asc" },
    });

    const categoryIds = categories.map(c => c.category_id);

    const descriptions = await prisma.oc_journal3_blog_category_description.findMany({
        where: {
            category_id: { in: categoryIds },
            language_id: 1
        }
    });

    return categories.map(cat => {
        const desc = descriptions.find(d => d.category_id === cat.category_id) || {};
        return {
            category_id: cat.category_id,
            parent_id: cat.parent_id,
            image: cat.image,
            name: desc.name,
            slug: desc.keyword,
            description: desc.description
        };
    });
};

export const getCategoryBySlugService = async (slug) => {
    const desc = await prisma.oc_journal3_blog_category_description.findFirst({
        where: { keyword: slug, language_id: 1 },
    });

    if (!desc) return null;

    const category = await prisma.oc_journal3_blog_category.findFirst({
        where: { category_id: desc.category_id, status: true }
    });

    if (!category) return null;

    return {
        category_id: category.category_id,
        name: desc.name,
        slug: desc.keyword,
        description: desc.description,
        image: category.image
    };
};

export const getPostBySlugService = async (slug) => {
    const desc = await prisma.oc_journal3_blog_post_description.findFirst({
        where: {
            language_id: 1,
            keyword: slug,
        },
        select: {
            post_id: true,
            name: true,
            description: true,
            tags: true,
            keyword: true,
        },
    });

    if (!desc) return null;


    const post = await prisma.oc_journal3_blog_post.findFirst({
        where: {
            post_id: desc.post_id,
            status: true,
        },
    });

    if (!post) return null;

    const author = post.author_id
        ? await prisma.oc_user.findUnique({
            where: {
                user_id: post.author_id,
            },
            select: {
                firstname: true,
                lastname: true,
            },
        })
        : null;

    return {
        post_id: post.post_id,
        author_id: post.author_id,
        author_firstname: author?.firstname ?? null,
        author_lastname: author?.lastname ?? null,
        image: post.image,
        comments: post.comments,
        status: post.status,
        sort_order: post.sort_order,
        date_created: post.date_created,
        date_updated: post.date_updated,
        title: desc.name,
        content: desc.description,
        slug: desc.keyword,
        views: post?.views
    };
};


export const getPostByIdService = async (postId) => {
    const post = await prisma.oc_journal3_blog_post.findUnique({
        where: { post_id: postId },
        include: {
            oc_journal3_blog_post_description: {
                where: { language_id: 1 },
                select: {
                    name: true,
                    description: true,
                    tags: true,
                    keyword: true,
                    meta_title: true,
                    meta_keywords: true,
                    meta_description: true,
                },
            },
        },
    });

    if (!post) return null;

    const author = post.author_id
        ? await prisma.oc_user.findUnique({
            where: {
                user_id: post.author_id,
            },
            select: {
                firstname: true,
                lastname: true,
            },
        })
        : null;

    const desc = post.oc_journal3_blog_post_description?.[0] ?? {};

    return {
        post_id: post.post_id,
        author_id: post.author_id,
        author_firstname: author?.firstname ?? null,
        author_lastname: author?.lastname ?? null,
        image: post.image,
        comments: post.comments,
        status: post.status,
        sort_order: post.sort_order,
        date_created: post.date_created,
        date_updated: post.date_updated,
        title: desc.name ?? null,
        content: desc.description ?? null,
        slug: desc.keyword ?? null,
        meta_title: desc.meta_title ?? null,
        meta_keywords: desc.meta_keywords ?? null,
        meta_description: desc.meta_description ?? null,
    };
};


// export const searchPostsByKeywordService = async (keyword, { page = 1, limit = 10 } = {}) => {

//     const skip = (page - 1) * limit;

//     const whereCondition = {
//         language_id: 1,
//         OR: [
//             { name: { contains: keyword } },
//             { tags: { contains: keyword } },
//             { keyword: { contains: keyword } },
//             { meta_keywords: { contains: keyword } },
//             { meta_description: { contains: keyword } },
//         ],
//     };

//     const [descResults, total] = await Promise.all([
//         prisma.oc_journal3_blog_post_description.findMany({
//             where: whereCondition,
//             skip,
//             take: limit,
//             select: {
//                 post_id: true,
//                 name: true,
//                 description: true,
//                 tags: true,
//                 keyword: true,
//                 meta_title: true,
//                 meta_keywords: true,
//                 meta_description: true,
//             },
//         }),
//         prisma.oc_journal3_blog_post_description.count({ where: whereCondition }),
//     ]);

//     const postIds = descResults.map((d) => d.post_id);

//     const posts = await prisma.oc_journal3_blog_post.findMany({
//         where: {
//             post_id: { in: postIds },
//             status: true,
//         },
//     });

//     const postMap = Object.fromEntries(posts.map((p) => [p.post_id, p]));

//     const formatted = descResults
//         .filter((desc) => postMap[desc.post_id])
//         .map((desc) => {
//             const post = postMap[desc.post_id];
//             const slug = desc.tags || (desc.name ? toSlug(desc.name) : `post-${post.post_id}`);

//             return {
//                 post_id: post.post_id,
//                 author_id: post.author_id,
//                 image: post.image,
//                 comments: post.comments,
//                 status: post.status,
//                 sort_order: post.sort_order,
//                 date_created: post.date_created,
//                 date_updated: post.date_updated,
//                 title: desc.name,
//                 content: desc.description,
//                 slug,
//                 keyword: desc.keyword,
//                 meta_title: desc.meta_title,
//                 meta_keywords: desc.meta_keywords,
//                 meta_description: desc.meta_description,
//                 keywords: desc.meta_keywords
//                     ? desc.meta_keywords.split(",").map((k) => k.trim()).filter(Boolean)
//                     : [],
//             };
//         });

//     return {
//         keyword,
//         posts: formatted,
//         pagination: {
//             total,
//             page,
//             limit,
//             totalPages: Math.ceil(total / limit),
//         },
//     };
// };


export const searchPostsByKeywordService = async (keyword, { page = 1, limit = 10 } = {}) => {
    const skip = (page - 1) * limit;
    const likeKeyword = `%${keyword}%`;

    const descResults = await prisma.$queryRaw`
        SELECT post_id, name, description, tags, keyword, meta_title, meta_keywords, meta_description
        FROM oc_journal3_blog_post_description
        WHERE language_id = 1
        AND (
            name LIKE ${likeKeyword}
            OR tags LIKE ${likeKeyword}
            OR keyword LIKE ${likeKeyword}
            OR meta_keywords LIKE ${likeKeyword}
            OR meta_description LIKE ${likeKeyword}
        )
        LIMIT ${limit} OFFSET ${skip}
    `;

    // 2. Total count (raw SQL)
    const countResult = await prisma.$queryRaw`
        SELECT COUNT(*) AS total
        FROM oc_journal3_blog_post_description
        WHERE language_id = 1
        AND (
            name LIKE ${likeKeyword}
            OR tags LIKE ${likeKeyword}
            OR keyword LIKE ${likeKeyword}
            OR meta_keywords LIKE ${likeKeyword}
            OR meta_description LIKE ${likeKeyword}
        )
    `;

    const total = Number(countResult[0]?.total || 0);

    const postIds = descResults.map((d) => d.post_id);

    if (postIds.length === 0) {
        return {
            keyword,
            posts: [],
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // 3. Posts table se matching post_ids fetch (Prisma.join se safe IN clause)
    const posts = await prisma.$queryRaw`
        SELECT post_id, author_id, image, comments, status, sort_order, date_created, date_updated
        FROM oc_journal3_blog_post
        WHERE post_id IN (${Prisma.join(postIds)})
        AND status = 1
    `;

    const postMap = Object.fromEntries(posts.map((p) => [p.post_id, p]));

    const formatted = descResults
        .filter((desc) => postMap[desc.post_id])
        .map((desc) => {
            const post = postMap[desc.post_id];
            const slug = desc.tags || (desc.name ? toSlug(desc.name) : `post-${post.post_id}`);

            return {
                post_id: post.post_id,
                author_id: post.author_id,
                image: post.image,
                comments: post.comments,
                status: post.status,
                sort_order: post.sort_order,
                date_created: post.date_created,
                date_updated: post.date_updated,
                title: desc.name,
                content: desc.description,
                // slug,
                slug: desc.keyword,
                meta_title: desc.meta_title,
                meta_keywords: desc.meta_keywords,
                meta_description: desc.meta_description,
                keywords: desc.meta_keywords
                    ? desc.meta_keywords.split(",").map((k) => k.trim()).filter(Boolean)
                    : [],
            };
        });

    return {
        keyword,
        posts: formatted,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

export const CountViewsServices = async (post_id) => {
   
    const post =  await prisma.oc_journal3_blog_post.findFirst({
        where:{
            post_id:Number(post_id)
        },
        select:{
            views:true
        }
    })
    if(!post) return 
    const data = await prisma.oc_journal3_blog_post.update({
        where: { post_id: post_id },
        data: {
            
            views: post.views == null ? 1 : { increment: 1 },
        },
        select: { views: true },
    });

    return data ;
}