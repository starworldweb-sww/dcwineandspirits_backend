// redirectService.js
import { prisma } from "../../../lib/prisma.js";

const BASE_URL = process.env.FRONTEND_URL;


export const redirectService = async (slug, fullUrl) => {
    if (!slug) return null;
 
    const baseUrl = process.env.FRONTEND_URL;

    const record = await prisma.oc_redirect_url_manager_redirect.findFirst({
        where: {
            status: true,
            OR: [
                { from: slug },
                { from: `${baseUrl}/${slug}` },
                { from: `${baseUrl}/${slug}/` },


                ...(fullUrl ? [
                    { from: fullUrl },
                    { from: fullUrl.endsWith('/') ? fullUrl.slice(0, -1) : `${fullUrl}/` }
                ] : [])
            ]
        },
        select: { type: true, to: true }
    });

    if (!record) return null;
    const { type, to } = record;
    if (to.startsWith('http')) return to;
    return `${baseUrl}/${to}`;
};