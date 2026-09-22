import { prisma } from "../../../lib/prisma.js";

// ---- naya review submit karna ----
// status = true rakha hai, submit hote hi review live ho jayega (admin approval nahi chahiye)
// imageFilename: multer se aayi hui uploaded image ka filename (ek hi image allowed)
export const createReviewService = async (data, imageFilename = null) => {
  const {
    product_id,
    customer_id = 0,
    order_id = 0,
    author,
    text,
    rating,
  } = data;

  // Step 1: required fields check
  if (!product_id || !author || !text || rating == null) {
    const error = new Error(
      "product_id, author, text aur rating zaroori hain",
    );
    error.statusCode = 400;
    throw error;
  }

  // Step 2: product exist karta hai ya nahi — warna FK constraint error aayega
  const product = await prisma.oc_product.findUnique({
    where: { product_id: Number(product_id) },
    select: { product_id: true },
  });

  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }
  
  const clampedRating = Math.min(5, Math.max(1, Number(rating) || 0));

  const review = await prisma.oc_review.create({
    data: {
      product_id: Number(product_id),
      customer_id: Number(customer_id),
      order_id: Number(order_id),
      author: String(author).trim().slice(0, 64),
      text: String(text).trim(),
      rating: clampedRating,
      image: imageFilename || "",
      status: false,
      date_added: new Date(),
      date_modified: new Date(),
    },
  });

  return review;
}; 