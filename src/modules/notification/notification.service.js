
import { prisma } from "../../../lib/prisma.js";


const allClients = () => Object.values(clients);


const STORE = "";

const normalize = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (
    digits.length < 8 ||
    digits.length > 15 ||
    digits.startsWith("0") ||
    digits.length === 10
  ) {
    const err = new Error("Enter a valid number with country code, e.g. +918809994466.");
    err.status = 400;
    throw err;
  }
  return `+${digits}`;
};

const httpError = (message, status) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const toDto = (r) => ({ id: r.id, phone: r.phone });

const upsertPhone = (client, phone) =>
  client.notification_numbers.upsert({
    where: { phone_store: { phone, store: STORE } },
    update: {},
    create: { phone, store: STORE },
  });




export const listNumbers = async () => {
  const rows = await prisma.notification_numbers.findMany({
    orderBy: { created_at: "desc" },
  });
  return rows.map(toDto);
};


export const addNumber = async (phone) => {
  const p = normalize(phone);

  const exists = await prisma.notification_numbers.findFirst({ where: { phone: p } });
  if (exists) throw httpError("This number is already added.", 409);

  await Promise.all(allClients().map((c) => upsertPhone(c, p)));

  const row = await prisma.notification_numbers.findFirst({ where: { phone: p } });
  return toDto(row);
};

export const updateNumber = async (id, phone) => {
  const current = await prisma.notification_numbers.findUnique({
    where: { id: Number(id) },
  });
  if (!current) throw httpError("Number not found.", 404);

  const newPhone = normalize(phone);
  if (newPhone === current.phone) return toDto(current);

  const dup = await prisma.notification_numbers.findFirst({ where: { phone: newPhone } });
  if (dup) throw httpError("This number is already added.", 409);

  for (const c of allClients()) {
    const r = await c.notification_numbers.updateMany({
      where: { phone: current.phone },
      data: { phone: newPhone },
    });
    if (r.count === 0) await upsertPhone(c, newPhone);
  }

  const row = await prisma.notification_numbers.findFirst({ where: { phone: newPhone } });
  return toDto(row);
};

export const removeNumber = async (id) => {
  const current = await prisma.notification_numbers.findUnique({
    where: { id: Number(id) },
  });
  if (!current) return;

  await Promise.all(
    allClients().map((c) =>
      c.notification_numbers.deleteMany({ where: { phone: current.phone } })
    )
  );
};



const toWhatsApp = (p) => {
  if (p.startsWith("+")) return `whatsapp:${p}`;
  return p.length === 10 ? `whatsapp:+91${p}` : `whatsapp:+${p}`;
};

export const getActiveRecipients = async () => {
  const rows = await prisma.notification_numbers.findMany();
  return rows.map((r) => toWhatsApp(r.phone));
};