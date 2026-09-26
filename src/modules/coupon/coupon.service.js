import { prisma } from "../../../lib/prisma.js";

export const couponServices = async (code, cartTotal, customerId) => {
  const coupon = await prisma.oc_coupon.findFirst({
    where: { code: code },
  });

  if (!coupon) {
    return {
      success: false,
      message: "Invalid coupon code",
    };
  }

  
  if (coupon.status !== true) {
    return {
      success: false,
      message: "This coupon is not active",
    };
  }

  const today = new Date();
  const startDate = coupon.date_start ? new Date(coupon.date_start) : null;
  const endDate = coupon.date_end ? new Date(coupon.date_end) : null;

  if (startDate && !isNaN(startDate) && today < startDate) {
    return {
      success: false,
      message: "This coupon is not active yet",
    };
  }

  if (endDate && !isNaN(endDate) && today > endDate) {
    return {
      success: false,
      message: "This coupon has expired",
    };
  }

 
  if (cartTotal < parseFloat(coupon.total)) {
    return {
      success: false,
      message: `Add products worth $${(coupon.total - cartTotal).toFixed(
        2
      )} more to use this coupon`,
    };
  }

 
  if (coupon.uses_total > 0) {
    const totalUsesCount = await prisma.oc_coupon_history.count({
      where: { coupon_id: coupon.coupon_id },
    });
    console.log("totalUsesCount",totalUsesCount)
    if (totalUsesCount >= coupon.uses_total) {
      return {
        success: false,
        message: "This coupon has reached its usage limit",
      };
    }
  }

  
  if (coupon.uses_customer > 0) {
    if (!customerId) {
      return {
        success: false,
        message: "You must be logged in to use this coupon",
      };
    }

    const customerUsesCount = await prisma.oc_coupon_history.count({
      where: {
        coupon_id: coupon.coupon_id,
        customer_id: customerId,
      },
    });

    if (customerUsesCount >= coupon.uses_customer) {
      return {
        success: false,
        message: "You have already used this coupon the maximum number of times",
      };
    }
  }

  if (coupon.logged === true && !customerId) {
    return {
      success: false,
      message: "You must be logged in to use this coupon",
    };
  }

  let discountAmount = 0;

  if (coupon.type === "F") {
    discountAmount = parseFloat(coupon.discount);
  } else if (coupon.type === "P") {
    discountAmount = (cartTotal * parseFloat(coupon.discount)) / 100;
  }

  if (discountAmount > cartTotal) {
    discountAmount = cartTotal;
  }

  const finalTotal = cartTotal - discountAmount;

  return {
    success: true,
    message: "Coupon applied successfully",
    coupon: {
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      discount: coupon.discount,
      minimumTotal: coupon.total,
      coupon_id: coupon.coupon_id,
    },
    discountAmount: discountAmount.toFixed(2),
    finalTotal: finalTotal.toFixed(2),
  };
};