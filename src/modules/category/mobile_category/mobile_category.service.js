import { prisma } from "../../../../lib/prisma.js"
import { getSeoUrl } from "../header_category/header_category.service.js"

const MAX_DEPTH = 6
const DEFAULT_LANGUAGE_ID = 1
const getModuleData = async (module_id, module_type) => {
  const record = await prisma.oc_journal3_module.findFirst({
    where: { module_id, module_type },
    select: { module_data: true },
  })
  if (!record?.module_data) return { heading: null, items: [] }
  let parsed
  try {
    parsed = JSON.parse(record.module_data)
  } catch (err) {
    console.error(`Failed to parse module_data for module_id=${module_id}:`, err)
    return { heading: null, items: [] }
  }
  const heading = parsed?.general?.name ?? parsed?.general?.title?.lang_1 ?? null
  const items = Array.isArray(parsed?.items)
    ? parsed.items.filter(
        (i) => i?.status?.status === true || i?.status?.status === "true"
      )
    : []
  return { heading, items }
}
const getCategoryChildren = async (parentId, depth) => {
  const numericParentId = Number(parentId)
  if (!numericParentId) return []
  const categories = await prisma.oc_category.findMany({
    where: {
      parent_id: numericParentId,
      status: true, 
    },
    select: { category_id: true },
  })
  if (!categories.length) return []
  const categoryIds = categories.map((c) => c.category_id)
  const descriptions = await prisma.oc_category_description.findMany({
    where: {
      category_id: { in: categoryIds },
      language_id: DEFAULT_LANGUAGE_ID,
    },
    select: { category_id: true, name: true },
  })
  const nameMap = new Map(descriptions.map((d) => [d.category_id, d.name]))
  return Promise.all(
    categoryIds.map(async (id) => {
      const seo_url = await getSeoUrl("category", id)
      const children =
        depth < MAX_DEPTH ? await getCategoryChildren(id, depth + 1) : []
      return {
        title: nameMap.get(id) ?? null,
        type: "category",
        id: String(id),
        seo_url,
        children,
      }
    })
  )
}
const resolveMenuItem = async (item, depth = 0) => {
  const type = item?.link?.type || ""
  const id = item?.link?.id || ""
  const seo_url = id ? await getSeoUrl(type, id) : null
  const custom_url = item?.link?.url || ""
  let children = []
  if (Array.isArray(item?.items) && item.items.length) {
    children = await Promise.all(
      item.items.map((child) => resolveMenuItem(child, depth + 1))
    )
  }
  else if (item?.flyout && depth < MAX_DEPTH) {
    const flyoutModuleId = Number(item.flyout)
    if (flyoutModuleId) {
      const { items: flyoutItems } = await getModuleData(flyoutModuleId, "flyout_menu")
      children = await Promise.all(
        flyoutItems.map((child) => resolveMenuItem(child, depth + 1))
      )
    }
  }
  else if (
    type === "category" &&
    id &&
    item?.subcategories === "true" &&
    depth < MAX_DEPTH
  ) {
    children = await getCategoryChildren(id, depth + 1)
  }
  return {
    title: item?.title?.lang_1 || item?.name || null,
    type,
    id,
    seo_url,
    custom_url,
    children,
  }
}
export const mobileMainMenuService = async () => {
  const { heading, items } = await getModuleData(219, "main_menu")
  const menu = await Promise.all(items.map((item) => resolveMenuItem(item)))
  return { heading, menu }
}