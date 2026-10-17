import { bulkOrderrService } from "./bulkorderr.service.js";


export const bulkOrderrController = async (req, res) => {
  try {
    const result = await bulkOrderrService(req.body);

    if (!result.success) {
      const { status, ...body } = result;
      return res.status(status || 400).json(body);
    }

    return res.json(result);
  } catch (error) {
    console.error("Bulk order controller error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};