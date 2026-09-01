
export const LANGUAGE_ID = 1;
export const STORE_ID = 0;
export const CUSTOMER_GROUP_ID = 1;

export const getEffectivePrice = (price, specialPrice) =>
    specialPrice != null ? specialPrice : price;

export const fetchSeoMap = async (queries) => {
    if (!queries.length) return new Map();

    const rows = await prisma.oc_seo_url.findMany({
        where: {
            query: { in: queries },
            language_id: LANGUAGE_ID,
            store_id: STORE_ID,
        },
        select: { query: true, keyword: true },
    });

    return new Map(rows.map((r) => [r.query, r.keyword]));
};

export const getValidSpecialPrice = (specials, productId, now = new Date()) => {
    const productSpecials = specials.filter((s) => s.product_id === productId);

    for (const special of productSpecials) {
        const start = special.date_start;
        const end = special.date_end;

        const isStartValid = start && !isNaN(start.getTime()) && start.getFullYear() > 1970;
        const isEndValid = end && !isNaN(end.getTime()) && end.getFullYear() > 1970;
        const isStarted = !isStartValid || start <= now;
        const isNotEnded = !isEndValid || end >= now;

        if (isStarted && isNotEnded) {
            return Number(special.price);
        }
    }

    return null;
};