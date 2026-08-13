import { DateTime } from "luxon";
import { prisma } from "../../../lib/prisma.js";

export const getAddressesByCustomer = async (customerId) => {

    const customer = await prisma.oc_customer.findUnique({
        where: { customer_id: parseInt(customerId) },
        select: { address_id: true },
    });
    const addresses = await prisma.oc_address.findMany({
        where: { customer_id: parseInt(customerId) },
        orderBy: { address_id: "asc" },
        select: {
            firstname: true,
            lastname: true,
            company: true,
            address_1: true,
            address_2: true,
            postcode: true,
            city: true,
            address_id: true,
            country_id: true,
            zone_id: true,
            oc_country: {
                select: {
                    name: true,
                }
            },
            oc_zone: {
                select: {
                    name: true
                }
            }

        }
    });



    return addresses.map((addr) => ({
        firstname: addr.firstname,
        lastname: addr.lastname,
        company: addr.company,
        address_1: addr.address_1,
        address_2: addr.address_2,
        postcode: addr.postcode,
        country_name: addr.oc_country.name,
        country_id: addr.country_id,
        city: addr.city,
        zone_name: addr.oc_zone.name,
        zone_id: addr.zone_id,
        address_id: addr.address_id,
        is_default: addr.address_id === customer.address_id,
    }));
};

export const getAddressById = async (addressId, customerId) => {
    const address = await prisma.oc_address.findFirst({
        where: {
            address_id: parseInt(addressId),
            customer_id: parseInt(customerId),
        },
        include: {
            oc_country: {
                select: { country_id: true, name: true, iso_code_2: true },
            },
            oc_zone: {
                select: { zone_id: true, name: true, code: true },
            },
        },
    });

    if (!address) {
        const err = new Error("Address not found");
        err.statusCode = 404;
        throw err;
    }

    return address;
};

export const createAddressServices = async (customerId, data, ip) => {

    const newYorkTime = DateTime.now()
        .setZone("America/New_York")
        .toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
    const customer = await prisma.oc_customer.findUnique({
        where: { customer_id: parseInt(customerId) },
    });
    if (!customer) {
        const err = new Error("Customer not found");
        err.statusCode = 404;
        throw err;
    }

    const country = await prisma.oc_country.findUnique({
        where: { country_id: parseInt(data.country_id) },
    });
    if (!country) {
        const err = new Error("Country not found");
        err.statusCode = 400;
        throw err;
    }

    const zone = await prisma.oc_zone.findFirst({
        where: {
            zone_id: parseInt(data.zone_id),
            country_id: parseInt(data.country_id),
        },
    });
    if (!zone) {
        const err = new Error("Zone does not belong to the selected country");
        err.statusCode = 400;
        throw err;
    }

    const address = await prisma.oc_address.create({
        data: {
            customer_id: parseInt(customerId),
            firstname: data.firstname,
            lastname: data.lastname,
            company: data.company || "",
            address_1: data.address_1,
            address_2: data.address_2 || "",
            city: data.city,
            postcode: data.postcode,
            country_id: parseInt(data.country_id),
            zone_id: parseInt(data.zone_id),
            custom_field: data.custom_field || "",
        },

    });

    await prisma.oc_customer_activity.create({
        data: {
            customer_id: customer.customer_id || 0,
            key: "address_add",
            data: JSON.stringify({
                "customer_id": customer?.customer_id,
                "name": `${customer?.firstname} ${customer?.lastname}`,
            }),
            ip: ip,
            date_added: newYorkTime
        }
    })


    if (data.default === true || data.default === "1") {
        await prisma.oc_customer.update({
            where: { customer_id: parseInt(customerId) },
            data: { address_id: address.address_id },
        });
    }

    return {
        ...address,
        is_default: data.default === true || data.default === "1",
    };
};

export const updateAddressServices = async (addressId, customerId, data, ip) => {

    const newYorkTime = DateTime.now()
        .setZone("America/New_York")
        .toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
    const existing = await prisma.oc_address.findFirst({
        where: {
            address_id: parseInt(addressId),
            customer_id: parseInt(customerId),
        },
    });

    const customer = await prisma.oc_customer.findUnique({
        where:{customer_id:customerId}
    })
     
    

    if (!existing) {
        const err = new Error("Address not found");
        err.statusCode = 404;
        throw err;
    }

    if (data.country_id && data.zone_id) {
        const zone = await prisma.oc_zone.findFirst({
            where: {
                zone_id: parseInt(data.zone_id),
                country_id: parseInt(data.country_id),
            },
        });
        if (!zone) {
            const err = new Error("Zone does not belong to the selected country");
            err.statusCode = 400;
            throw err;
        }
    }

    const updateData = {};
    const fields = [
        "firstname", "lastname", "company",
        "address_1", "address_2", "city", "postcode", "custom_field",
    ];
    fields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });
    if (data.country_id) updateData.country_id = parseInt(data.country_id);
    if (data.zone_id) updateData.zone_id = parseInt(data.zone_id);

    const updated = await prisma.oc_address.update({
        where: { address_id: parseInt(addressId) },
        data: updateData,
        include: {
            oc_country: { select: { country_id: true, name: true, iso_code_2: true } },
            oc_zone: { select: { zone_id: true, name: true, code: true } },
        },
    });

    

    await prisma.oc_customer_activity.create({
        data: {
            customer_id: customer.customer_id || 0,
            key: "address_edit",
            data: JSON.stringify({
                "customer_id": customer?.customer_id,
                "name": `${customer?.firstname} ${customer?.lastname}`,
            }),
            ip: ip,
            date_added: newYorkTime
        }
    })

    if (data.default === true || data.default === "1") {
        await prisma.oc_customer.update({
            where: { customer_id: parseInt(customerId) },
            data: { address_id: parseInt(addressId) },
        });
    }


    return {
        ...updated,
        is_default: data.default === true || data.default === "1",
    };
};

export const deleteAddressServices = async (addressId, customerId) => {
    const existing = await prisma.oc_address.findFirst({
        where: {
            address_id: parseInt(addressId),
            customer_id: parseInt(customerId),
        },
    });
    if (!existing) {
        const err = new Error("Address not found");
        err.statusCode = 404;
        throw err;
    }

    await prisma.oc_address.delete({
        where: { address_id: parseInt(addressId) },
    });

    return { deleted: true };
};



export const getCountriesService = async () => {

    const countries = await prisma.oc_country.findMany({
        where: { status: true },
        orderBy: { name: 'asc' },
        select: {
            country_id: true,
            name: true,
            iso_code_2: true,
            iso_code_3: true
        }
    })

    return countries;
}

export const getZonesByCountryService = async (countryId) => {

    const zone = await prisma.oc_zone.findMany({
        where: { country_id: parseInt(countryId) },
        select: {
            zone_id: true,
            name: true,
            code: true
        },
        orderBy: { name: 'asc' }
    })
    return zone;
}