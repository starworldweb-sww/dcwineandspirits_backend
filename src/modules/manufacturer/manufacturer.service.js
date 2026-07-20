import { query } from "express-validator"
import { prisma } from "../../../lib/prisma.js"


export const allManufacturerService = async () => {


    const filterManufacturerIds = await prisma.oc_manufacturer_to_store.findMany({
        where:{
            store_id:0
        },
        select:{
            manufacturer_id:true,
            store_id:true,
        }
    })

    const data = await prisma.oc_manufacturer.findMany({
        orderBy: { name: "asc" },
        where:{
          manufacturer_id: { in: filterManufacturerIds.map((m) => m?.manufacturer_id ) }
        },
        select: {
            manufacturer_id: true,
            name: true,
            image: true

        }
    })
   
    const manufacturerIds = data.map((id) => id?.manufacturer_id)

    const seoUrl = await prisma.oc_seo_url.findMany({
        where: {
            query: { in: manufacturerIds.map((id) => `manufacturer_id=${id}`) }
        },
        select: {
            keyword: true,
            query: true
        }
    })

    const items = data.map((m) => ({
        ...m,
        slug: seoUrl.find((s) => s?.query === `manufacturer_id=${m?.manufacturer_id}`)?.keyword ?? null

    }))

    return items;
}