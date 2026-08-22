import { prisma } from "../../../lib/prisma.js";

const DEFAULT_STORE_ID = 0;
const DEFAULT_LANGUAGE_ID = 1;

const buildCategoryTree = (flatCategories) => {
  const byId = new Map();
  flatCategories.forEach((c) => byId.set(c.id, { ...c, children: [] }));
  const roots = [];

  byId.forEach((cat) => {
    if (cat.parent_id && byId.has(cat.parent_id)) {
      byId.get(cat.parent_id).children.push(cat);
    } else {
      roots.push(cat);
    }
  });

  return roots;
};

export const getAllCategoriesForSitemap = async () => {
  const categories = await prisma.oc_category.findMany({
    where: { status: true },
    select: {
      category_id: true,
      parent_id: true,
      image: true,
      date_added: true,
      date_modified: true,
      oc_category_description: {
        where: { language_id: DEFAULT_LANGUAGE_ID },
        select: {
          name: true,
          meta_title: true,
          meta_description: true,
          meta_keyword: true,
        },
      },
    },
  });

  const categoryIds = categories.map((c) => c.category_id);
  const seoUrls = await prisma.oc_seo_url.findMany({
    where: {
      query: { in: categoryIds.map((id) => `category_id=${id}`) },
      language_id: DEFAULT_LANGUAGE_ID,
      store_id: DEFAULT_STORE_ID,
    },
    select: { query: true, keyword: true },
  });

  const flatList = categories
    .map((cat) => {
      const seo = seoUrls.find((s) => s.query === `category_id=${cat.category_id}`);
      const desc = cat.oc_category_description?.[0];
      if (!seo?.keyword) return null;

      return {
        type: "category",
        id: cat.category_id,
        parent_id: cat.parent_id || 0,
        name: desc?.name || null,
        slug: seo.keyword,
        image: cat.image || null,
        meta_title: desc?.meta_title || null,
        meta_description: desc?.meta_description || null,
        date_added: cat.date_added,
        date_modified: cat.date_modified,
      };
    })
    .filter(Boolean);

  return {
    flat: flatList,
    tree: buildCategoryTree(flatList),
  };
};

export const getAllProductsForSitemap = async () => {
  const products = await prisma.oc_product.findMany({
    where: { status: true },
    select: {
      product_id: true,
      image: true,
      price: true,
      date_added: true,
      date_modified: true,
      oc_product_description: {
        where: { language_id: 1 },
        select: {
          name: true,
          meta_title: true,
          meta_description: true,
          meta_keyword: true,
          description: true,
        },
      },
    },
  });

  const productIds = products.map((p) => p.product_id);
  const seoUrls = await prisma.oc_seo_url.findMany({
    where: {
      query: { in: productIds.map((id) => `product_id=${id}`) },
      language_id: 1,
      store_id: 0,
    },
    select: { query: true, keyword: true },
  });

  return products
    .map((prod) => {
      const seo = seoUrls.find((s) => s.query === `product_id=${prod.product_id}`);
      const desc = prod.oc_product_description?.[0];
      if (!seo?.keyword) return null;

      return {
        type: "product",
        id: prod.product_id,
        name: desc?.name || null,
        slug: seo.keyword,
        image: prod.image || null,
        price: prod.price,
        meta_title: desc?.meta_title || null,
        meta_description: desc?.meta_description || null,
        date_added: prod.date_added,
        date_modified: prod.date_modified,
      };
    })
    .filter(Boolean);
};

export const getAllBrandsForSitemap = async () => {
  const manufacturers = await prisma.oc_manufacturer.findMany({
    select: {
      manufacturer_id: true,
      name: true,
      image: true,
      oc_manufacturer_description: {
        where: { language_id: DEFAULT_LANGUAGE_ID },
        select: {
          custom_title: true,
          meta_description: true,
          meta_keyword: true,
        },
      },
    },
  });

  const manufacturerStoreLink = await prisma.oc_manufacturer_to_store.findMany({
    where: {
      store_id: DEFAULT_STORE_ID,
      manufacturer_id: { in: manufacturers.map((m) => m.manufacturer_id) },
    },
    select: {
      manufacturer_id: true,
      store_id: true,
    },
  });

  if (!manufacturerStoreLink.length) {
    return [];
  }

  const manufacturerIds = manufacturerStoreLink.map((m) => m.manufacturer_id);
  const seoUrls = await prisma.oc_seo_url.findMany({
    where: {
      query: { in: manufacturerIds.map((id) => `manufacturer_id=${id}`) },
      language_id: 1,
      store_id: 0,
    },
    select: { query: true, keyword: true },
  });

  return manufacturers
    .map((manu) => {
      const seo = seoUrls.find((s) => s.query === `manufacturer_id=${manu.manufacturer_id}`);
      const desc = manu.oc_manufacturer_description?.[0];
      if (!seo?.keyword) return null;

      return {
        type: "brand",
        id: manu.manufacturer_id,
        name: manu.name,
        slug: seo.keyword,
        image: manu.image || null,
        meta_title: desc?.custom_title || null,
        meta_description: desc?.meta_description || null,
      };
    })
    .filter(Boolean);
};

export const getAllBlogsForSitemap = async () => {
  const posts = await prisma.oc_journal3_blog_post.findMany({
    where: { status: true },
    select: {
      post_id: true,
      image: true,
      date_created: true,
      date_updated: true,
      oc_journal3_blog_post_description: {
        where: { language_id: 1 },
        select: {
          name: true,
          keyword: true,
          meta_title: true,
          meta_description: true,
          meta_keywords: true,
        },
      },
    },
  });

  return posts
    .map((post) => {
      const desc = post.oc_journal3_blog_post_description?.[0];
      if (!desc?.keyword) return null;

      return {
        type: "blog",
        id: post.post_id,
        name: desc.name || null,
        slug: desc.keyword,
        image: post.image || null,
        meta_title: desc.meta_title || null,
        meta_description: desc.meta_description || null,
        date_added: post.date_created,
        date_modified: post.date_updated,
      };
    })
    .filter(Boolean);
};

export const getAllBlogCategoriesForSitemap = async () => {
  const categories = await prisma.oc_journal3_blog_category.findMany({
    where: { status: true },
    select: {
      category_id: true,
      image: true,
    },
  });

  const categoryIds = categories.map((c) => c.category_id);
  const descriptions = await prisma.oc_journal3_blog_category_description.findMany({
    where: {
      category_id: { in: categoryIds },
      language_id: 1,
    },
  });

  const descriptionMap = new Map(
    descriptions.map((d) => [d.category_id, d])
  );

  return categories
    .map((cat) => {
      const desc = descriptionMap.get(cat.category_id);
      if (!desc?.keyword) return null;

      return {
        type: "blog-category",
        id: cat.category_id,
        name: desc.name || null,
        slug: desc.keyword,
        image: cat.image || null,
        meta_title: desc.meta_title || null,
        meta_description: desc.meta_description || null,
      };
    })
    .filter(Boolean);
};

export const getAllInformationPagesForSitemap = async () => {
  const infoPages = await prisma.oc_information.findMany({
    where: { status: true },
    select: {
      information_id: true,
    },
  });

  const infoIds = infoPages.map((i) => i.information_id);
  const descriptions = await prisma.oc_information_description.findMany({
    where: {
      information_id: { in: infoIds },
      language_id: 1,
    },
  });

  const seoUrls = await prisma.oc_seo_url.findMany({
    where: {
      query: { in: infoIds.map((id) => `information_id=${id}`) },
      language_id: 1,
      store_id: 0,
    },
    select: { query: true, keyword: true },
  });

  const descriptionMap = new Map(
    descriptions.map((d) => [d.information_id, d])
  );

  const seoMap = new Map(
    seoUrls.map((s) => {
      const infoId = parseInt(s.query.replace('information_id=', ''));
      return [infoId, s];
    })
  );

  return infoPages
    .map((info) => {
      const desc = descriptionMap.get(info.information_id);
      const seo = seoMap.get(info.information_id);
      if (!seo?.keyword) return null;

      return {
        type: "information",
        id: info.information_id,
        name: desc?.title || null,
        slug: seo.keyword,
        meta_title: desc?.meta_title || null,
        meta_description: desc?.meta_description || null,
      };
    })
    .filter(Boolean);
};

export const getAllSitemapData = async () => {
  const [categories, products, brands, blogs, blogCategories, infoPages] = await Promise.all([
    getAllCategoriesForSitemap(),
    getAllProductsForSitemap(),
    getAllBrandsForSitemap(),
    getAllBlogsForSitemap(),
    getAllBlogCategoriesForSitemap(),
    getAllInformationPagesForSitemap(),
  ]);

  return {
    categories,
    products,
    brands,
    blogs,
    blogCategories,
    infoPages,
  };
};
