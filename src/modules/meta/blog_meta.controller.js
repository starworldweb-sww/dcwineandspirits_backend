export const getBlogMeta = async (req, res) => {
  try {
    const { identifier } = req.params;
    const languageId = 1;

    const [blogMeta, categoryMeta] = await Promise.all([
      prisma.oc_journal3_blog_post_description.findFirst({
        where: {
          keyword: identifier,
          language_id: languageId,
        },
        select: {
          meta_title: true,
          meta_description: true,
          meta_keywords: true,
        },
      }),

      prisma.oc_journal3_blog_category_description.findFirst({
        where: {
          keyword: identifier,
          language_id: languageId,
        },
        select: {
          meta_title: true,
          meta_description: true,
          meta_keywords: true,
        },
      }),
    ]);

    const meta = blogMeta || categoryMeta;

    if (!meta) {
      return res.status(404).json({
        message: "Meta not found",
      });
    }

    return res.json(meta);
  } catch (err) {
    return res.status(500).json({
      message: err.message,
    });
  }
};