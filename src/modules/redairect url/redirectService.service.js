// redirectService.js
import { prisma } from "../../../lib/prisma.js";

const BASE_URL = process.env.FRONTEND_URL;


export const redirectService = async (slug, fullUrl) => {
  
    if (!slug) return null;
 
    const baseUrl = process.env.FRONTEND_URL;

    const record = await prisma.oc_redirect_manager.findFirst({
        where: {
            active: true,
            OR: [
                { from_url: slug },
                { from_url: `${baseUrl}/${slug}` },
                { from_url: `${baseUrl}/${slug}/` },


                ...(fullUrl ? [
                    { from_url: fullUrl },
                    { from_url: fullUrl.endsWith('/') ? fullUrl.slice(0, -1) : `${fullUrl}/` }
                ] : [])
            ]
        },
        select: {to_url: true }
    });

    if (!record) return null;
    const { to_url } = record;
   
    if (to_url.startsWith('http')) return to_url;
    return `${baseUrl}/${to_url}`;
};