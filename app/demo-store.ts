import {
  DEMO_REFERENCE_DATE,
  OPENING_BALANCE_CENTS,
  movements as initialMovements,
  services as initialServices,
  type Movement,
  type Service,
} from "./demo-data";

const STORAGE_KEY = "novabank-demo-state";
const INITIAL_MOVEMENT_COUNT = initialMovements.length;
const initialBalanceCents = initialMovements.reduce(
  (balance, movement) => {
    if (movement.status !== "completed") return balance;
    return (
      balance +
      (movement.type === "income" ? 1 : -1) * movement.amountCents
    );
  },
  OPENING_BALANCE_CENTS,
);

export const demoRecipients = [
  { id: "recipient-sofia", name: "Sofía Martínez · Ejemplo" },
  { id: "recipient-tomas", name: "Tomás Fernández · Ejemplo" },
  { id: "recipient-valeria", name: "Valeria Gómez · Ejemplo" },
] as const;

export type DemoRecipientId = (typeof demoRecipients)[number]["id"];

export type DemoTransfer = {
  id: string;
  date: string;
  concept: string;
  type: "expense";
  amountCents: number;
  status: "completed";
  category: "Transferencia";
};

export type DemoServicePayment = {
  serviceId: string;
  movement: Movement & {
    type: "expense";
    status: "completed";
    serviceId: string;
  };
};

type PersistedDemoState = {
  version: 2;
  transfers: DemoTransfer[];
  servicePayments: DemoServicePayment[];
};

export type DemoState = {
  movements: Movement[];
  services: Service[];
  persistenceAvailable: boolean;
  recoveredInvalidData: boolean;
};

const initialState: DemoState = {
  movements: initialMovements,
  services: initialServices,
  persistenceAvailable: true,
  recoveredInvalidData: false,
};

let demoState = initialState;
let initialized = false;
const subscribers = new Set<() => void>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isDemoTransfer = (value: unknown): value is DemoTransfer =>
  isRecord(value) &&
  typeof value.id === "string" &&
  /^transfer-[a-z0-9-]+$/.test(value.id) &&
  value.date === DEMO_REFERENCE_DATE &&
  typeof value.concept === "string" &&
  value.concept.length > 0 &&
  value.concept.length <= 200 &&
  value.type === "expense" &&
  Number.isSafeInteger(value.amountCents) &&
  Number(value.amountCents) > 0 &&
  value.status === "completed" &&
  value.category === "Transferencia";

const isDemoServicePayment = (value: unknown): value is DemoServicePayment => {
  if (!isRecord(value) || typeof value.serviceId !== "string") return false;
  const service = initialServices.find(
    (candidate) => candidate.id === value.serviceId,
  );
  const movement = value.movement;
  return (
    service !== undefined &&
    service.status === "pending" &&
    isRecord(movement) &&
    movement.id === `service-payment-${service.id}` &&
    movement.serviceId === service.id &&
    movement.date === DEMO_REFERENCE_DATE &&
    movement.concept === `Pago de servicio · ${service.provider}` &&
    movement.type === "expense" &&
    movement.amountCents === service.amountCents &&
    movement.status === "completed" &&
    movement.category === service.category
  );
};

const isUniqueList = <T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
  getId: (item: T) => string,
): value is T[] =>
  Array.isArray(value) &&
  value.every(isItem) &&
  new Set(value.map(getId)).size === value.length;

const isPersistedDemoState = (
  value: unknown,
): value is PersistedDemoState => {
  if (
    !isRecord(value) ||
    value.version !== 2 ||
    !isUniqueList(value.transfers, isDemoTransfer, (transfer) => transfer.id) ||
    !isUniqueList(
      value.servicePayments,
      isDemoServicePayment,
      (payment) => payment.serviceId,
    )
  ) {
    return false;
  }
  const expensesCents =
    value.transfers.reduce(
      (total, transfer) => total + transfer.amountCents,
      0,
    ) +
    value.servicePayments.reduce(
      (total, payment) => total + payment.movement.amountCents,
      0,
    );
  return Number.isSafeInteger(expensesCents) && expensesCents <= initialBalanceCents;
};

const publish = () => subscribers.forEach((subscriber) => subscriber());

const persistState = (state: PersistedDemoState) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
};

const readSavedState = (): {
  state: PersistedDemoState;
  persistenceAvailable: boolean;
  recoveredInvalidData?: boolean;
} => {
  let saved: string | null;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      state: { version: 2, transfers: [], servicePayments: [] },
      persistenceAvailable: false,
    };
  }
  if (saved === null) {
    return {
      state: { version: 2, transfers: [], servicePayments: [] },
      persistenceAvailable: true,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    parsed = null;
  }
  if (Array.isArray(parsed) && isUniqueList(parsed, isDemoTransfer, (item) => item.id)) {
    const migrated = {
      version: 2 as const,
      transfers: parsed,
      servicePayments: [],
    };
    if (isPersistedDemoState(migrated)) {
      const persistenceAvailable = persistState(migrated);
      return { state: migrated, persistenceAvailable };
    }
  }
  if (isPersistedDemoState(parsed)) {
    return { state: parsed, persistenceAvailable: true };
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return {
      recoveredInvalidData: true,
      state: { version: 2, transfers: [], servicePayments: [] },
      persistenceAvailable: true,
    };
  } catch {
    return {
      recoveredInvalidData: true,
      state: { version: 2, transfers: [], servicePayments: [] },
      persistenceAvailable: false,
    };
  }
};

const createSnapshot = (
  saved: PersistedDemoState,
  persistenceAvailable: boolean,
): DemoState => {
  const paidServiceIds = new Set(
    saved.servicePayments.map((payment) => payment.serviceId),
  );
  return {
    movements: [
      ...initialMovements,
      ...saved.transfers,
      ...saved.servicePayments.map((payment) => payment.movement),
    ],
    services: initialServices.map((service) =>
      paidServiceIds.has(service.id)
        ? { ...service, status: "paid" }
        : service,
    ),
    persistenceAvailable,
    recoveredInvalidData: false,
  };
};

const initialize = () => {
  if (initialized) return;
  initialized = true;
  const saved = readSavedState();
  demoState = { ...createSnapshot(saved.state, saved.persistenceAvailable), recoveredInvalidData: saved.recoveredInvalidData ?? false };
};

export const subscribeToDemoState = (onChange: () => void) => {
  subscribers.add(onChange);
  initialize();
  window.addEventListener("storage", handleStorageChange);
  return () => {
    subscribers.delete(onChange);
    window.removeEventListener("storage", handleStorageChange);
  };
};

function handleStorageChange(event: StorageEvent) {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  initialized = false;
  initialize();
  publish();
}

export const getDemoStateSnapshot = () => demoState;
export const getServerDemoStateSnapshot = () => initialState;

const currentPersistedState = (): PersistedDemoState => {
  initialize();
  return {
    version: 2,
    transfers: demoState.movements
      .slice(INITIAL_MOVEMENT_COUNT)
      .filter(isDemoTransfer),
    servicePayments: demoState.movements
      .slice(INITIAL_MOVEMENT_COUNT)
      .flatMap((movement) => {
        const serviceId = movement.serviceId;
        const candidate = serviceId
          ? { serviceId, movement }
          : null;
        return candidate && isDemoServicePayment(candidate)
          ? [candidate]
          : [];
      }),
  };
};

const availableBalance = (movements: Movement[]) =>
  movements.reduce((balance, movement) => {
    if (movement.status !== "completed") return balance;
    return (
      balance +
      (movement.type === "income" ? 1 : -1) * movement.amountCents
    );
  }, OPENING_BALANCE_CENTS);

const commitState = (next: PersistedDemoState) => {
  const persistenceAvailable = persistState(next);
  demoState = createSnapshot(next, persistenceAvailable);
  publish();
  return true;
};

export const addDemoTransfer = (transfer: DemoTransfer) => {
  initialize();
  const current = currentPersistedState();
  if (
    !isDemoTransfer(transfer) ||
    demoState.movements.some((movement) => movement.id === transfer.id) ||
    transfer.amountCents > availableBalance(demoState.movements)
  ) {
    return false;
  }
  return commitState({ ...current, transfers: [...current.transfers, transfer] });
};

export const createDemoTransferId = () =>
  `transfer-${window.crypto.randomUUID()}`;

export const payDemoService = (serviceId: string) => {
  initialize();
  const service = demoState.services.find(
    (candidate) => candidate.id === serviceId,
  );
  const current = currentPersistedState();
  if (
    !service ||
    service.status !== "pending" ||
    current.servicePayments.some((payment) => payment.serviceId === serviceId) ||
    service.amountCents > availableBalance(demoState.movements)
  ) {
    return false;
  }

  const movement: DemoServicePayment["movement"] = {
    id: `service-payment-${service.id}`,
    serviceId: service.id,
    date: DEMO_REFERENCE_DATE,
    concept: `Pago de servicio · ${service.provider}`,
    type: "expense",
    amountCents: service.amountCents,
    status: "completed",
    category: service.category,
  };
  const payment = { serviceId: service.id, movement };
  const next = {
    ...current,
    servicePayments: [...current.servicePayments, payment],
  };
  if (!isPersistedDemoState(next)) return false;
  return commitState(next);
};

export const resetDemoState = () => {
  initialize();
  let persistenceAvailable = true;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    persistenceAvailable = false;
  }
  demoState = { ...initialState, persistenceAvailable };
  publish();
};
