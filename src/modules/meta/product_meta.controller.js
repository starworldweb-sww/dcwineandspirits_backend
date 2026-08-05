import { prisma } from "../../../lib/prisma.js";


export const getProductMeta = async (req, res) => {
  try {
    const { identifier } = req.params;
    const languageId = 1;

    let productId = null;
    const isNumeric = /^\d+$/.test(identifier);

    if (isNumeric) {
      productId = parseInt(identifier);
    } else {
      const seoUrl = await prisma.oc_seo_url.findFirst({
        where: {
          keyword: identifier,
          store_id: 0,
          language_id: languageId,
        }
      });

      if (seoUrl?.query?.startsWith('product_id=')) {
        productId = parseInt(seoUrl.query.split('product_id=')[1]);
      }
    }

    if (!productId) return res.status(404).json({ message: 'Product not found' });

    const meta = await prisma.oc_product_description.findFirst({
      where: {
        product_id: productId,
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