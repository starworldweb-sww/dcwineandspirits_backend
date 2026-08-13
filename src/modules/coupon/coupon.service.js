import { prisma } from "../../../lib/prisma.js";

export const couponServices = async (code,cartTotal) => {
  
  const coupon = await prisma.oc_coupon.findFirst({
    where: {
      code: code,
    },
  });

  if (!coupon) {
    return {
      success: false,
      message: "Invalid coupon code",
    };
  }

  const today = new Date();
  const startDate = new Date(coupon.date_start);
  const endDate = new Date(coupon.date_end);

  if (today < startDate || today > endDate) {
    return {
      success: false,
      message: "Coupon has expired or not started yet",
    };
  }

  
  if (cartTotal < coupon.total) {
    return {
      success: false,
      message: `Add products worth $${(coupon.total - cartTotal).toFixed(
        2
      )} more to use this coupon`,
    };
  }

 
  let discountAmount = 0;

  if (coupon.type === "F") {
    discountAmount = parseFloat(coupon.discount);
  } else if (coupon.type === "P") {
    discountAmount = (cartTotal * parseFloat(coupon.discount)) / 100;
  }

  
  const finalTotal = cartTotal - discountAmount;
  
  return {
    success:true,
    message:"coupon applied successfully",
    coupon: {
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      discount: coupon.discount,
      minimumTotal: coupon.total,
      coupon_id:coupon.coupon_id
    },
    discountAmount: discountAmount.toFixed(2),
    finalTotal: finalTotal.toFixed(2),

  };
};