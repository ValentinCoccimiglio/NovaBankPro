export const DEMO_REFERENCE_DATE = "2026-10-13";
export const OPENING_BALANCE_CENTS = 250_000_000;

const referenceParts = DEMO_REFERENCE_DATE.split("-").map(Number);
const demoMonthDate = (daysBefore: number) => {
  const [year, month, day] = referenceParts;
  const date = new Date(
    Date.UTC(year, month - 1, Math.max(1, day - daysBefore)),
  );
  return date.toISOString().slice(0, 10);
};
const previousMonthDate = () => {
  const [year, month, day] = referenceParts;
  const date = new Date(Date.UTC(year, month - 2, Math.min(day, 28)));
  return date.toISOString().slice(0, 10);
};
const dateOffsetFromReference = (days: number) => {
  const [year, month, day] = referenceParts;
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

export type MovementType = "income" | "expense";
export type MovementStatus = "completed" | "pending" | "rejected";

export type Movement = {
  id: string;
  date: string;
  concept: string;
  type: MovementType;
  amountCents: number;
  status: MovementStatus;
  category: string;
  serviceId?: string;
};

export const movements: Movement[] = [
  {
    id: "mov-20261012-salary",
    date: demoMonthDate(1),
    concept: "Acreditación de sueldo",
    type: "income",
    amountCents: 18_500_000,
    status: "completed",
    category: "Sueldo",
  },
  {
    id: "mov-20261011-groceries",
    date: demoMonthDate(2),
    concept: "Compra en supermercado",
    type: "expense",
    amountCents: 2_845_090,
    status: "completed",
    category: "Compras",
  },
  {
    id: "mov-20261010-transfer",
    date: demoMonthDate(3),
    concept: "Transferencia enviada",
    type: "expense",
    amountCents: 4_800_000,
    status: "completed",
    category: "Transferencia",
  },
  {
    id: "mov-20261009-freelance",
    date: demoMonthDate(4),
    concept: "Trabajo independiente",
    type: "income",
    amountCents: 2_500_000,
    status: "pending",
    category: "Otros ingresos",
  },
  {
    id: "mov-20261008-pharmacy",
    date: demoMonthDate(5),
    concept: "Farmacia",
    type: "expense",
    amountCents: 825_000,
    status: "completed",
    category: "Salud",
  },
  {
    id: "mov-20261008-water",
    date: demoMonthDate(5),
    concept: "Pago de agua",
    type: "expense",
    amountCents: 1_240_000,
    status: "completed",
    category: "Servicios",
    serviceId: "service-water",
  },
  {
    id: "mov-20261006-refund",
    date: demoMonthDate(7),
    concept: "Reintegro de compra",
    type: "income",
    amountCents: 125_000,
    status: "completed",
    category: "Reintegro",
  },
  {
    id: "mov-20261004-internet",
    date: demoMonthDate(9),
    concept: "Pago de internet",
    type: "expense",
    amountCents: 689_000,
    status: "rejected",
    category: "Servicios",
  },
  {
    id: "mov-20260929-groceries",
    date: previousMonthDate(),
    concept: "Compra en supermercado",
    type: "expense",
    amountCents: 420_000,
    status: "completed",
    category: "Compras",
  },
];

export type ServiceStatus = "pending" | "paid" | "rejected";

export type Service = {
  id: string;
  provider: string;
  category: string;
  period: string;
  dueDate: string;
  amountCents: number;
  status: ServiceStatus;
};

export const services: Service[] = [
  {
    id: "service-electricity",
    provider: "Energía del Hogar · Ejemplo",
    category: "Electricidad",
    period: "Septiembre de 2026",
    dueDate: dateOffsetFromReference(-3),
    amountCents: 820_000,
    status: "pending",
  },
  {
    id: "service-gas",
    provider: "Gas del Barrio · Ejemplo",
    category: "Gas",
    period: "Septiembre de 2026",
    dueDate: dateOffsetFromReference(3),
    amountCents: 645_000,
    status: "pending",
  },
  {
    id: "service-internet",
    provider: "Conexión Familiar · Ejemplo",
    category: "Internet",
    period: "Septiembre de 2026",
    dueDate: dateOffsetFromReference(12),
    amountCents: 490_000,
    status: "pending",
  },
  {
    id: "service-water",
    provider: "Agua Clara · Ejemplo",
    category: "Agua",
    period: "Septiembre de 2026",
    dueDate: dateOffsetFromReference(-5),
    amountCents: 1_240_000,
    status: "paid",
  },
];
