import { prisma } from "../../../lib/prisma.js";

export const getManufactureMeta = async (req, res) => {
  try {
    const { identifier } = req.params;
    const languageId = 1;
    const storeId = 0;

    let manufacturerId = null;
    const isNumeric = /^\d+$/.test(identifier);

    if (isNumeric) {
      manufacturerId = parseInt(identifier);
    } else {
      const seoUrl = await prisma.oc_seo_url.findFirst({
        where: {
          keyword: identifier,
          store_id: storeId,
          language_id: languageId,
        }
      });

      if (seoUrl?.query?.startsWith('manufacturer_id=')) {
        manufacturerId = parseInt(seoUrl.query.split('manufacturer_id=')[1]);
      }
    }

    if (!manufacturerId) {
      return res.status(404).json({ message: 'Manufacturer not found' });
    }

    const manufacturerStoreLink = await prisma.oc_manufacturer_to_store.findFirst({
      where: {
        store_id: storeId,
        manufacturer_id: manufacturerId,
      },
      select: { manufacturer_id: true },
    });

    if (!manufacturerStoreLink) {
      return res.status(404).json({ message: 'Manufacturer not found' });
    }

    const meta = await prisma.oc_manufacturer_description.findFirst({
      where: {
        manufacturer_id: manufacturerId,
        language_id: languageId,
      },
      select: {
        meta_description: true,
        meta_keyword: true,
        custom_title: true,
      },
    });

    if (!meta) return res.status(404).json({ message: 'Meta not found' });

    res.json(meta);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};