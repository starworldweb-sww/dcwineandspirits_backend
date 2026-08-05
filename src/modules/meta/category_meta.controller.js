import { prisma } from "../../../lib/prisma.js";



export const getCategoriMeta = async (req, res) => {
  try {
    const { identifier } = req.params;
    const languageId = 1;

    let categoryId = null;
    const isNumeric = /^\d+$/.test(identifier);

    if (isNumeric) {
      categoryId = parseInt(identifier);
    } else {
      const seoUrl = await prisma.oc_seo_url.findFirst({
        where: {
          keyword: identifier,
          store_id: 0,
          language_id: languageId,
        }
      });

      if (seoUrl?.query?.startsWith('category_id=')) {
        categoryId = parseInt(seoUrl.query.split('category_id=')[1]);
      }
    }

    if (!categoryId) return res.status(404).json({ message: 'Category not found' });

    const meta = await prisma.oc_category_description.findFirst({
      where: {
        category_id: categoryId,
        language_id: languageId,
      },
      select: {
        meta_title: true,
        meta_description: true,
        meta_keyword: true,
      },
    });

    if (!meta) return res.status(404).json({ message: 'Meta not found' });

    res.json(meta);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};