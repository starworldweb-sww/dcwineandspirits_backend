import { createReviewService } from "./review.service.js";

export const createReview = async (req, res) => {
  try {
    const imageFilename = req.file ? req.file.filename : null;
    const review = await createReviewService(req.body, imageFilename);
    return res.status(201).json({
      success: true,
      message: "Review submitted",
      data: review,
    });
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};