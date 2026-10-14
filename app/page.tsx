"use client";
import { motion, useReducedMotion } from "framer-motion";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import SpendingPanel from "./spending-panel";
import {
  DEMO_REFERENCE_DATE,
  OPENING_BALANCE_CENTS,
  type Movement,
  type MovementStatus,
  type ServiceStatus,
} from "./demo-data";
import {
  addDemoTransfer,
  createDemoTransferId,
  demoRecipients,
  getDemoStateSnapshot,
  getServerDemoStateSnapshot,
  payDemoService,
  resetDemoState,
  subscribeToDemoState,
  type DemoRecipientId,
} from "./demo-store";

const movementStatusLabels: Record<MovementStatus, string> = {
  completed: "Completado",
  pending: "Pendiente",
  rejected: "Rechazado",
};

type TransferStep = "entry" | "review" | "success";
type ServiceFilter = "pending" | "paid" | "all";
type ServicePaymentStep = "review" | "success";

type MovementTypeFilter = "all" | "income" | "expense";
type MovementStatusFilter = "all" | MovementStatus;

const serviceStatusLabels: Record<ServiceStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  rejected: "Rechazado",
};

const formatARS = (amountCents: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amountCents / 100);

const dateFromISO = (date: string) => new Date(`${date}T12:00:00`);

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(dateFromISO(date));

const referenceDate = dateFromISO(DEMO_REFERENCE_DATE);
const referenceMonth = DEMO_REFERENCE_DATE.slice(0, 7);
const monthLabel = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
}).format(referenceDate);
const referenceDateLabel = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(referenceDate);
const signedMovementAmount = (movement: Movement) =>
  `${movement.type === "income" ? "+" : "−"}${formatARS(movement.amountCents)}`;

const serviceDueState = (dueDate: string) => {
  if (dueDate < DEMO_REFERENCE_DATE) {
    return { label: "Vencido", className: "vencido" };
  }
  if (dueDate === DEMO_REFERENCE_DATE) {
    return { label: "Vence hoy", className: "vence-hoy" };
  }
  return { label: "Por vencer", className: "por-vencer" };
};

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const parseARSAmount = (input: string): number | null => {
  const value = input.trim();
  const match = value.match(/^(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/);
  if (!match) return null;

  const whole = match[1].replaceAll(".", "").replace(/^0+(?=\d)/, "");
  const cents = `${whole}${(match[2] ?? "").padEnd(2, "0")}`.replace(
    /^0+(?=\d)/,
    "",
  );
  const maxSafeCents = String(Number.MAX_SAFE_INTEGER);
  if (
    cents.length > maxSafeCents.length ||
    (cents.length === maxSafeCents.length && cents > maxSafeCents)
  ) {
    return null;
  }
  const amountCents = Number(cents);
  return Number.isSafeInteger(amountCents) && amountCents > 0
    ? amountCents
    : null;
};

let fallbackDarkMode = true;
let themeSessionOnly = false;
const themeSubscribers = new Set<() => void>();

function subscribeToTheme(onChange: () => void) {
  themeSubscribers.add(onChange);
  window.addEventListener("storage", onChange);

  return () => {
    themeSubscribers.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getDarkModeSnapshot() {
  if (themeSessionOnly) return fallbackDarkMode;
  try {
    const savedTheme = window.localStorage.getItem("novabank-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme === "dark";
    }
  } catch {
    return fallbackDarkMode;
  }

  return fallbackDarkMode;
}

function getServerThemeSnapshot() {
  return true;
}

function updateDarkMode(action: boolean | ((current: boolean) => boolean)) {
  const nextValue =
    typeof action === "function" ? action(getDarkModeSnapshot()) : action;
  fallbackDarkMode = nextValue;

  try {
    window.localStorage.setItem("novabank-theme", nextValue ? "dark" : "light");
  } catch {
    themeSessionOnly = true;
    // El modo elegido sigue vigente durante esta sesión aunque no se pueda guardar.
  }

  themeSubscribers.forEach((subscriber) => subscriber());
}

let fallbackShowAmounts = true;
let amountsSessionOnly = false;
const amountVisibilitySubscribers = new Set<() => void>();

function subscribeToAmountVisibility(onChange: () => void) {
  amountVisibilitySubscribers.add(onChange);
  window.addEventListener("storage", onChange);

  return () => {
    amountVisibilitySubscribers.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getShowAmountsSnapshot() {
  if (amountsSessionOnly) return fallbackShowAmounts;
  try {
    const savedPreference = window.localStorage.getItem(
      "novabank-show-amounts",
    );
    if (savedPreference === "true" || savedPreference === "false") {
      return savedPreference === "true";
    }
  } catch {
    return fallbackShowAmounts;
  }

  return fallbackShowAmounts;
}

function getServerAmountVisibilitySnapshot() {
  return true;
}

function updateShowAmounts(action: boolean | ((current: boolean) => boolean)) {
  const nextValue =
    typeof action === "function"
      ? action(getShowAmountsSnapshot())
      : action;
  fallbackShowAmounts = nextValue;

  try {
    window.localStorage.setItem("novabank-show-amounts", String(nextValue));
  } catch {
    amountsSessionOnly = true;
    // La preferencia se mantiene durante la sesión si el navegador bloquea el almacenamiento.
  }

  amountVisibilitySubscribers.forEach((subscriber) => subscriber());
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [transferStep, setTransferStep] = useState<TransferStep>("entry");
  const [recipientId, setRecipientId] = useState<DemoRecipientId | "">("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferConcept, setTransferConcept] = useState("");
  const [transferErrors, setTransferErrors] = useState<{
    recipient?: string;
    amount?: string;
    form?: string;
  }>({});
  const [isProcessingTransfer, setIsProcessingTransfer] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("pending");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [servicePaymentStep, setServicePaymentStep] =
    useState<ServicePaymentStep>("review");
  const [servicePaymentError, setServicePaymentError] = useState("");
  const [revealServiceAmount, setRevealServiceAmount] = useState(false);
  const [isProcessingServicePayment, setIsProcessingServicePayment] =
    useState(false);
  const [movementSearch, setMovementSearch] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] =
    useState<MovementTypeFilter>("all");
  const [movementStatusFilter, setMovementStatusFilter] =
    useState<MovementStatusFilter>("all");
  const [movementFromDate, setMovementFromDate] = useState("");
  const [movementToDate, setMovementToDate] = useState("");
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(
    null,
  );
  const movementDetailRef = useRef<HTMLDivElement>(null);
  const detailCloseButtonRef = useRef<HTMLButtonElement>(null);
  const transferEntryHeadingRef = useRef<HTMLHeadingElement>(null);
  const transferReviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const transferResultHeadingRef = useRef<HTMLHeadingElement>(null);
  const transferRecipientRef = useRef<HTMLSelectElement>(null);
  const transferAmountRef = useRef<HTMLInputElement>(null);
  const isConfirmingTransferRef = useRef(false);
  const serviceDialogRef = useRef<HTMLDivElement>(null);
  const serviceDialogHeadingRef = useRef<HTMLHeadingElement>(null);
  const serviceDialogCloseRef = useRef<HTMLButtonElement>(null);
  const servicePaymentTriggerRef = useRef<HTMLElement | null>(null);
  const isConfirmingServicePaymentRef = useRef(false);
  const demoState = useSyncExternalStore(
    subscribeToDemoState,
    getDemoStateSnapshot,
    getServerDemoStateSnapshot,
  );
  const demoMovements = demoState.movements;
  const demoServices = demoState.services;
  const orderedMovements = [...demoMovements].sort(
    (first, second) =>
      second.date.localeCompare(first.date) ||
      second.id.localeCompare(first.id),
  );
  const recentMovements = orderedMovements.slice(0, 5);
  const monthMovements = demoMovements.filter(
    (movement) =>
      movement.date.slice(0, 7) === referenceMonth &&
      movement.status === "completed",
  );
  const monthlyIncomeCents = monthMovements
    .filter((movement) => movement.type === "income")
    .reduce((total, movement) => total + movement.amountCents, 0);
  const monthlyExpensesCents = monthMovements
    .filter((movement) => movement.type === "expense")
    .reduce((total, movement) => total + movement.amountCents, 0);
  const monthlyBalanceCents = monthlyIncomeCents - monthlyExpensesCents;
  const availableBalanceCents = demoMovements.reduce(
    (balance, movement) => {
      if (movement.status !== "completed") return balance;
      return (
        balance +
        (movement.type === "income" ? 1 : -1) * movement.amountCents
      );
    },
    OPENING_BALANCE_CENTS,
  );
  const upcomingServices = demoServices
    .filter((service) => service.status === "pending")
    .sort((first, second) => first.dueDate.localeCompare(second.dueDate))
    .slice(0, 3);
  const filteredServices = demoServices
    .filter(
      (service) =>
        serviceFilter === "all" || service.status === serviceFilter,
    )
    .sort((first, second) => {
      if (first.status === "pending" && second.status !== "pending") return -1;
      if (first.status !== "pending" && second.status === "pending") return 1;
      return first.dueDate.localeCompare(second.dueDate);
    });
  const selectedService = demoServices.find(
    (service) => service.id === selectedServiceId,
  );
  const selectedServiceIsOverdue =
    selectedService?.status === "pending" &&
    selectedService.dueDate < DEMO_REFERENCE_DATE;
  const parsedTransferAmount = parseARSAmount(transferAmount);
  const selectedRecipient = demoRecipients.find(
    (recipient) => recipient.id === recipientId,
  );
  const darkMode = useSyncExternalStore(
    subscribeToTheme,
    getDarkModeSnapshot,
    getServerThemeSnapshot,
  );
  const showAmounts = useSyncExternalStore(
    subscribeToAmountVisibility,
    getShowAmountsSnapshot,
    getServerAmountVisibilitySnapshot,
  );
  const shouldReduceMotion = useReducedMotion() ?? false;
  const pageInitial = shouldReduceMotion ? false : { opacity: 0, y: 20 };
  const pageTransition = { duration: shouldReduceMotion ? 0 : 0.35 };
  useEffect(() => {
    if (activeTab !== "transfers") return;
    if (transferStep === "entry") transferEntryHeadingRef.current?.focus();
    if (transferStep === "review") transferReviewHeadingRef.current?.focus();
    if (transferStep === "success") transferResultHeadingRef.current?.focus();
  }, [activeTab, transferStep]);
  useEffect(() => {
    if (selectedServiceId) {
      serviceDialogHeadingRef.current?.focus();
      return;
    }
    if (servicePaymentTriggerRef.current?.isConnected) {
      servicePaymentTriggerRef.current.focus();
      return;
    }
    document
      .querySelector<HTMLElement>('nav button[aria-current="page"]')
      ?.focus();
  }, [selectedServiceId, servicePaymentStep]);
  const validDateRange =
    !movementFromDate ||
    !movementToDate ||
    movementFromDate <= movementToDate;
  const normalizedSearch = normalizeSearchText(movementSearch.trim());
  const filteredMovements = validDateRange
    ? orderedMovements.filter((movement) => {
        const matchesSearch =
          !normalizedSearch ||
          normalizeSearchText(movement.concept).includes(normalizedSearch);
        const matchesType =
          movementTypeFilter === "all" ||
          movement.type === movementTypeFilter;
        const matchesStatus =
          movementStatusFilter === "all" ||
          movement.status === movementStatusFilter;
        const matchesFromDate =
          !movementFromDate || movement.date >= movementFromDate;
        const matchesToDate = !movementToDate || movement.date <= movementToDate;

        return (
          matchesSearch &&
          matchesType &&
          matchesStatus &&
          matchesFromDate &&
          matchesToDate
        );
      })
    : [];

  useEffect(() => {
    if (!selectedMovement) return;

    const previouslyFocusedElement = document.activeElement;
    detailCloseButtonRef.current?.focus();

    return () => {
      if (previouslyFocusedElement instanceof HTMLElement) {
        previouslyFocusedElement.focus();
      }
    };
  }, [selectedMovement]);

  const clearMovementFilters = () => {
    setMovementSearch("");
    setMovementTypeFilter("all");
    setMovementStatusFilter("all");
    setMovementFromDate("");
    setMovementToDate("");
  };

  const openMovementDetail = (movement: Movement) => {
    setSelectedMovement(movement);
  };

  const closeMovementDetail = () => {
    setSelectedMovement(null);
  };

  const validateTransfer = () => {
    const errors: typeof transferErrors = {};
    if (!selectedRecipient) {
      errors.recipient = "Seleccioná un destinatario ficticio de la lista.";
    }
    if (parsedTransferAmount === null) {
      errors.amount =
        "Ingresá un monto mayor que cero, con hasta dos decimales (por ejemplo, 1.234,56).";
    } else if (parsedTransferAmount > availableBalanceCents) {
      errors.amount = "El monto supera el saldo disponible de la demo.";
    }
    setTransferErrors(errors);
    if (errors.recipient) transferRecipientRef.current?.focus();
    else if (errors.amount) transferAmountRef.current?.focus();
    return Object.keys(errors).length === 0;
  };

  const reviewTransfer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (validateTransfer()) setTransferStep("review");
  };

  const confirmTransfer = async () => {
    if (isConfirmingTransferRef.current) return;
    if (!validateTransfer()) {
      setTransferStep("entry");
      return;
    }
    isConfirmingTransferRef.current = true;
    setIsProcessingTransfer(true);
    setTransferErrors({});
    await new Promise((resolve) =>
      window.setTimeout(resolve, shouldReduceMotion ? 0 : 250),
    );

    const currentBalanceCents = getDemoStateSnapshot().movements.reduce(
      (balance, movement) => {
        if (movement.status !== "completed") return balance;
        return (
          balance +
          (movement.type === "income" ? 1 : -1) * movement.amountCents
        );
      },
      OPENING_BALANCE_CENTS,
    );
    const latestAmountCents = parseARSAmount(transferAmount);
    if (
      !selectedRecipient ||
      latestAmountCents === null ||
      latestAmountCents > currentBalanceCents
    ) {
      setTransferErrors({
        form: "El saldo disponible cambió. Revisá el monto antes de continuar.",
      });
      setTransferStep("entry");
      setIsProcessingTransfer(false);
      isConfirmingTransferRef.current = false;
      return;
    }

    const transferConceptWithRecipient = `Transferencia a ${selectedRecipient.name.replace(" · Ejemplo", "")}${transferConcept.trim() ? ` · ${transferConcept.trim()}` : ""}`;
    const wasAdded = addDemoTransfer({
      id: createDemoTransferId(),
      date: DEMO_REFERENCE_DATE,
      concept: transferConceptWithRecipient,
      type: "expense",
      amountCents: latestAmountCents,
      status: "completed",
      category: "Transferencia",
    });
    if (!wasAdded) {
      setTransferErrors({
        form: "No se pudo guardar esta simulación. Volvé a intentarlo.",
      });
      setTransferStep("entry");
      setIsProcessingTransfer(false);
      isConfirmingTransferRef.current = false;
      return;
    }

    setIsProcessingTransfer(false);
    setTransferStep("success");
  };

  const startNewTransfer = () => {
    isConfirmingTransferRef.current = false;
    setRecipientId("");
    setTransferAmount("");
    setTransferConcept("");
    setTransferErrors({});
    setTransferStep("entry");
  };

  const cancelTransfer = () => {
    startNewTransfer();
    setActiveTab("dashboard");
  };

  const openServicePayment = (
    serviceId: string,
    trigger: HTMLElement,
  ) => {
    const service = demoState.services.find(
      (candidate) => candidate.id === serviceId,
    );
    if (!service || service.status !== "pending") return;
    servicePaymentTriggerRef.current = trigger;
    isConfirmingServicePaymentRef.current = false;
    setRevealServiceAmount(false);
    setServicePaymentError("");
    setServicePaymentStep("review");
    setSelectedServiceId(serviceId);
  };

  const closeServicePayment = () => {
    if (isConfirmingServicePaymentRef.current) return;
    setSelectedServiceId(null);
    setServicePaymentError("");
  };

  const confirmServicePayment = async () => {
    if (
      isConfirmingServicePaymentRef.current ||
      !selectedService ||
      selectedService.status !== "pending" ||
      selectedService.amountCents > availableBalanceCents
    ) {
      return;
    }
    isConfirmingServicePaymentRef.current = true;
    setIsProcessingServicePayment(true);
    setServicePaymentError("");
    await new Promise((resolve) =>
      window.setTimeout(resolve, shouldReduceMotion ? 0 : 200),
    );

    const latest = getDemoStateSnapshot();
    const latestService = latest.services.find(
      (service) => service.id === selectedService.id,
    );
    const latestBalance = latest.movements.reduce(
      (balance, movement) => {
        if (movement.status !== "completed") return balance;
        return (
          balance +
          (movement.type === "income" ? 1 : -1) * movement.amountCents
        );
      },
      OPENING_BALANCE_CENTS,
    );
    if (
      !latestService ||
      latestService.status !== "pending" ||
      latestService.amountCents > latestBalance
    ) {
      setServicePaymentError(
        latestService?.status === "pending"
          ? "El saldo disponible cambió. No alcanza para simular este pago."
          : "Este servicio ya no está pendiente de pago.",
      );
      setIsProcessingServicePayment(false);
      isConfirmingServicePaymentRef.current = false;
      return;
    }

    if (!payDemoService(latestService.id)) {
      setServicePaymentError(
        "No se pudo completar la simulación. Revisá el saldo y el estado del servicio.",
      );
      setIsProcessingServicePayment(false);
      isConfirmingServicePaymentRef.current = false;
      return;
    }
    setIsProcessingServicePayment(false);
    isConfirmingServicePaymentRef.current = false;
    setServicePaymentStep("success");
  };

  const handleServiceDialogKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeServicePayment();
      return;
    }
    if (event.key !== "Tab" || !serviceDialogRef.current) return;
    const focusableElements = serviceDialogRef.current.querySelectorAll<
      HTMLElement
    >('button:not([disabled]), [tabindex="-1"]');
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!firstElement || !lastElement) return;
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const resetDemo = () => {
    if (
      !window.confirm(
        "Se borrarán las operaciones simuladas y la demo volverá a sus datos ficticios iniciales. Tus preferencias de apariencia se conservarán. ¿Querés restablecer la demo?",
      )
    ) {
      return;
    }
    resetDemoState();
    setSelectedMovement(null);
    clearMovementFilters();
    startNewTransfer();
    closeServicePayment();
    setActiveTab("dashboard");
  };

  const handleMovementDetailKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMovementDetail();
      return;
    }

    if (event.key !== "Tab" || !movementDetailRef.current) return;
    const focusableElements = movementDetailRef.current.querySelectorAll<
      HTMLButtonElement
    >("button:not([disabled]), input:not([disabled]), select:not([disabled])");
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!firstElement || !lastElement) return;
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <main className={darkMode ? "dashboard" : "dashboard light-mode"}>
      <aside className="sidebar">
        <a className="skip-link" href="#main-content">Ir al contenido</a>
        <div className="brand">NovaBank</div>
        <button
          className="theme-toggle"
          type="button"
          onClick={() => updateDarkMode((current) => !current)}
          aria-label={`Cambiar a ${darkMode ? "modo claro" : "modo oscuro"}`}
        >
          {darkMode ? "☀️ Modo claro" : "🌙 Modo oscuro"}
        </button>

        <nav aria-label="Navegación principal">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={activeTab === "dashboard" ? "sidebar-active" : ""}
            aria-current={activeTab === "dashboard" ? "page" : undefined}
          >
            Inicio
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("movements")}
            className={activeTab === "movements" ? "sidebar-active" : ""}
            aria-current={activeTab === "movements" ? "page" : undefined}
          >
            Movimientos
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("transfers")}
            className={activeTab === "transfers" ? "sidebar-active" : ""}
            aria-current={activeTab === "transfers" ? "page" : undefined}
          >
            Transferencias
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={activeTab === "analytics" ? "sidebar-active" : ""}
            aria-current={activeTab === "analytics" ? "page" : undefined}
          >
            Mis gastos
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className={activeTab === "invoices" ? "sidebar-active" : ""}
            aria-current={activeTab === "invoices" ? "page" : undefined}
          >
            Servicios
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={activeTab === "settings" ? "sidebar-active" : ""}
            aria-current={activeTab === "settings" ? "page" : undefined}
          >
            Configuración
          </button>
        </nav>
      </aside>

      <section className="content" id="main-content" tabIndex={-1}>
        <p className="demo-notice">Demo · Sin validez bancaria</p>
        {demoState.recoveredInvalidData && <p className="persistence-notice" role="status">Se recuperó el estado inicial porque los datos guardados no eran válidos.</p>}
        {activeTab === "dashboard" && (
          <motion.div
            initial={pageInitial}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={pageTransition}
          >
            <header className="topbar">
              <div>
                <h1>Hola, Valentín</h1>
                <p>Este es el resumen de tu cuenta personal.</p>
              </div>
            </header>
            <p className="demo-notice">
              Cuenta de demostración · Datos al {referenceDateLabel}
            </p>
            {!demoState.persistenceAvailable && (
              <p className="persistence-notice" role="status">
                Los cambios de esta demo solo se conservarán durante esta
                sesión porque el almacenamiento no está disponible.
              </p>
            )}

            <section className="hero-card">
              <div className="balance-heading">
                <div>
                  <p>Saldo disponible</p>
                  <span>Cuenta en pesos argentinos</span>
                </div>
                <button
                  className="balance-visibility"
                  type="button"
                  onClick={() => updateShowAmounts((current) => !current)}
                  aria-pressed={!showAmounts}
                  aria-label={
                    showAmounts ? "Ocultar importes" : "Mostrar importes"
                  }
                >
                  {showAmounts ? "Ocultar importes" : "Mostrar importes"}
                </button>
              </div>
              <h2 className="balance-amount" aria-live="polite">
                {showAmounts
                  ? formatARS(availableBalanceCents)
                  : "••••••••"}
              </h2>
              <div className="primary-actions">
                <button
                  type="button"
                  className="action-primary"
                  onClick={() => setActiveTab("transfers")}
                >
                  Transferir
                </button>
                <button
                  type="button"
                  className="action-secondary"
                  onClick={() => setActiveTab("invoices")}
                >
                  Pagar un servicio
                </button>
              </div>
            </section>

            <section className="personal-month" aria-labelledby="month-heading">
              <div className="section-heading">
                <div>
                  <h2 id="month-heading">Resumen del mes</h2>
                  <p>{monthLabel}</p>
                </div>
              </div>
              <div className="month-summary-grid">
                <article className="summary-card income-summary">
                  <h3>Ingresos</h3>
                  <p className="summary-amount">
                    {showAmounts ? formatARS(monthlyIncomeCents) : "••••••••"}
                  </p>
                </article>
                <article className="summary-card expense-summary">
                  <h3>Gastos</h3>
                  <p className="summary-amount">
                    {showAmounts ? formatARS(monthlyExpensesCents) : "••••••••"}
                  </p>
                </article>
                <article className="summary-card monthly-balance-card">
                  <h3>Balance del mes</h3>
                  <p
                    className={`summary-amount ${monthlyBalanceCents >= 0 ? "amount-positive" : "amount-negative"}`}
                  >
                    {showAmounts ? formatARS(monthlyBalanceCents) : "••••••••"}
                  </p>
                  <span>Ingresos menos gastos</span>
                </article>
              </div>
            </section>

            <section className="personal-section" aria-labelledby="recent-heading">
              <div className="personal-card">
                <div className="personal-section-header">
                  <div>
                    <h2 id="recent-heading">Movimientos recientes</h2>
                    <p>Tus últimas actividades en la cuenta</p>
                  </div>
                  <button
                    className="text-action"
                    type="button"
                    onClick={() => setActiveTab("movements")}
                  >
                    Ver todos
                  </button>
                </div>
                {recentMovements.length === 0 ? (
                  <p className="empty-state">Todavía no tenés movimientos.</p>
                ) : (
                  <div className="movement-list">
                    {recentMovements.map((movement) => (
                      <article className="movement-row" key={movement.id}>
                        <div className="movement-description">
                          <h3>{movement.concept}</h3>
                          <p>
                            {formatDate(movement.date)} · {movement.category}
                          </p>
                        </div>
                        <div className="movement-details">
                          <span
                            className={`movement-type ${movement.type}`}
                          >
                            {movement.type === "income" ? "Ingreso" : "Egreso"}
                          </span>
                          <span
                            className={`status status-${movement.status}`}
                          >
                            {movementStatusLabels[movement.status]}
                          </span>
                        </div>
                        <p
                          className={`movement-amount ${movement.type}`}
                          aria-label={
                            showAmounts
                              ? signedMovementAmount(movement)
                              : "Importe oculto"
                          }
                        >
                          {showAmounts
                            ? signedMovementAmount(movement)
                            : "••••••"}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="personal-section" aria-labelledby="due-heading">
              <div className="personal-card">
                <div className="personal-section-header">
                  <div>
                    <h2 id="due-heading">Próximos vencimientos</h2>
                    <p>Servicios que requieren tu atención</p>
                  </div>
                  <button
                    className="text-action"
                    type="button"
                    onClick={() => setActiveTab("invoices")}
                  >
                    Ver servicios
                  </button>
                </div>
                {upcomingServices.length === 0 ? (
                  <p className="empty-state">
                    No tenés servicios pendientes de pago.
                  </p>
                ) : (
                  <div className="service-due-list">
                    {upcomingServices.map((service) => {
                      const dueState = serviceDueState(service.dueDate);

                      return (
                        <article className="service-due-row" key={service.id}>
                          <div>
                            <h3>{service.provider}</h3>
                            <p>Vence el {formatDate(service.dueDate)}</p>
                          </div>
                          <span
                            className={`status due-status ${dueState.className}`}
                          >
                            {dueState.label}
                          </span>
                          <p
                            className="service-due-amount"
                            aria-label={
                              showAmounts
                                ? formatARS(service.amountCents)
                                : "Importe oculto"
                            }
                          >
                            {showAmounts
                              ? formatARS(service.amountCents)
                              : "••••••"}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </motion.div>
        )}
        {activeTab === "movements" && (
          <motion.div
            initial={pageInitial}
            animate={{ opacity: 1, y: 0 }}
            transition={pageTransition}
          >
            <header className="topbar">
              <div>
                <h1>Movimientos</h1>
                <p>Consultá y filtrá la actividad de tu cuenta demo.</p>
              </div>
            </header>

            <p className="demo-notice movement-demo-notice">
              Demo · Sin validez bancaria
            </p>
            {!demoState.persistenceAvailable && (
              <p className="persistence-notice" role="status">
                Los cambios de esta demo solo se conservarán durante esta
                sesión porque el almacenamiento no está disponible.
              </p>
            )}

            <section className="table-section">
              <div className="table-card">
                <div className="movement-filters">
                  <div className="filter-field movement-search-field">
                    <label htmlFor="movement-search">Buscar por concepto</label>
                    <input
                      id="movement-search"
                      type="search"
                      value={movementSearch}
                      onChange={(event) => setMovementSearch(event.target.value)}
                      placeholder="Ej.: supermercado"
                    />
                  </div>

                  <div className="filter-field">
                    <label htmlFor="movement-type">Tipo</label>
                    <select
                      id="movement-type"
                      value={movementTypeFilter}
                      onChange={(event) =>
                        setMovementTypeFilter(
                          event.target.value as MovementTypeFilter,
                        )
                      }
                    >
                      <option value="all">Todos</option>
                      <option value="income">Ingresos</option>
                      <option value="expense">Egresos</option>
                    </select>
                  </div>

                  <div className="filter-field">
                    <label htmlFor="movement-status">Estado</label>
                    <select
                      id="movement-status"
                      value={movementStatusFilter}
                      onChange={(event) =>
                        setMovementStatusFilter(
                          event.target.value as MovementStatusFilter,
                        )
                      }
                    >
                      <option value="all">Todos</option>
                      <option value="completed">Completados</option>
                      <option value="pending">Pendientes</option>
                      <option value="rejected">Rechazados</option>
                    </select>
                  </div>

                  <div className="filter-field">
                    <label htmlFor="movement-from">Desde</label>
                    <input
                      id="movement-from"
                      type="date"
                      value={movementFromDate}
                      max={movementToDate || undefined}
                      onChange={(event) => setMovementFromDate(event.target.value)}
                    />
                  </div>

                  <div className="filter-field">
                    <label htmlFor="movement-to">Hasta</label>
                    <input
                      id="movement-to"
                      type="date"
                      value={movementToDate}
                      min={movementFromDate || undefined}
                      onChange={(event) => setMovementToDate(event.target.value)}
                    />
                  </div>

                  <button
                    className="clear-filters"
                    type="button"
                    onClick={clearMovementFilters}
                    disabled={
                      !movementSearch &&
                      movementTypeFilter === "all" &&
                      movementStatusFilter === "all" &&
                      !movementFromDate &&
                      !movementToDate
                    }
                  >
                    Limpiar filtros
                  </button>
                </div>

                <div className="movement-results-heading" aria-live="polite">
                  {!validDateRange ? (
                    <p className="filter-error" role="alert">
                      La fecha inicial no puede ser posterior a la fecha final.
                    </p>
                  ) : (
                    <p>
                      {filteredMovements.length}{" "}
                      {filteredMovements.length === 1
                        ? "movimiento encontrado"
                        : "movimientos encontrados"}
                    </p>
                  )}
                </div>

                {demoMovements.length === 0 ? (
                  <p className="empty-state">
                    Todavía no hay movimientos de demostración.
                  </p>
                ) : filteredMovements.length === 0 ? (
                  <div className="empty-results">
                    <p>No encontramos movimientos con esos filtros.</p>
                    <button
                      className="text-action"
                      type="button"
                      onClick={clearMovementFilters}
                    >
                      Restablecer búsqueda
                    </button>
                  </div>
                ) : (
                  <div
                    className="movement-history"
                    aria-label="Historial de movimientos"
                  >
                    {filteredMovements.map((movement) => (
                      <article className="history-movement" key={movement.id}>
                        <div className="history-movement-main">
                          <h2>{movement.concept}</h2>
                          <p>
                            {formatDate(movement.date)} · {movement.category}
                          </p>
                        </div>
                        <p className={`movement-amount ${movement.type}`}>
                          {movement.type === "income" ? "Ingreso" : "Egreso"}
                          {" · "}
                          {showAmounts
                            ? signedMovementAmount(movement)
                            : "••••••"}
                        </p>
                        <span className={`status status-${movement.status}`}>
                          {movementStatusLabels[movement.status]}
                        </span>
                        <button
                          className="text-action detail-action"
                          type="button"
                          onClick={() => openMovementDetail(movement)}
                          aria-haspopup="dialog"
                          aria-label={`Ver detalle: ${movement.concept}`}
                        >
                          Ver detalle
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </motion.div>
        )}
        {activeTab === "transfers" && (
          <motion.div
            initial={pageInitial}
            animate={{ opacity: 1, y: 0 }}
            transition={pageTransition}
          >
            <header className="topbar">
              <div>
                <h1>Transferencias</h1>
                <p>Recorrido interactivo con destinatarios de ejemplo.</p>
              </div>
            </header>
            <p className="demo-notice transfer-demo-notice">
              Demo · Sin validez bancaria
            </p>
            {!demoState.persistenceAvailable && (
              <p className="persistence-notice" role="status">
                El almacenamiento no está disponible; los cambios de esta demo
                solo se conservarán durante esta sesión.
              </p>
            )}
            <section
              className="transfer-panel"
              aria-labelledby="transfer-step-heading"
            >
              <div className="transfer-panel-heading">
                <p className="transfer-step-indicator">
                  {transferStep === "entry"
                    ? "Paso 1 de 3 · Ingreso"
                    : transferStep === "review"
                      ? "Paso 2 de 3 · Revisión"
                      : "Paso 3 de 3 · Resultado"}
                </p>
                <p className="transfer-demo-explanation">
                  Todos los datos y destinatarios de este recorrido son ficticios.
                </p>
              </div>

              {transferStep === "entry" && (
                <form className="transfer-form" onSubmit={reviewTransfer}>
                  <h2
                    id="transfer-step-heading"
                    ref={transferEntryHeadingRef}
                    tabIndex={-1}
                  >
                    Prepará una transferencia simulada
                  </h2>
                  <div className="transfer-balance">
                    <span>Saldo disponible de la demo</span>
                    <strong className="tabular-nums">
                      {showAmounts
                        ? formatARS(availableBalanceCents)
                        : "••••••••"}
                    </strong>
                  </div>

                  <div className="transfer-field">
                    <label htmlFor="transfer-recipient">
                      Destinatario ficticio
                    </label>
                    <select
                      id="transfer-recipient"
                      ref={transferRecipientRef}
                      value={recipientId}
                      onChange={(event) => {
                        setRecipientId(event.target.value as DemoRecipientId | "");
                        setTransferErrors((current) => ({
                          ...current,
                          recipient: undefined,
                        }));
                      }}
                      aria-invalid={Boolean(transferErrors.recipient)}
                      aria-describedby={
                        transferErrors.recipient
                          ? "transfer-recipient-error"
                          : "transfer-recipient-hint"
                      }
                    >
                      <option value="">Seleccioná un ejemplo</option>
                      {demoRecipients.map((recipient) => (
                        <option key={recipient.id} value={recipient.id}>
                          {recipient.name}
                        </option>
                      ))}
                    </select>
                    <span id="transfer-recipient-hint" className="field-hint">
                      Son nombres de ejemplo; no se solicitan datos bancarios.
                    </span>
                    {transferErrors.recipient && (
                      <span
                        className="field-error"
                        id="transfer-recipient-error"
                      >
                        {transferErrors.recipient}
                      </span>
                    )}
                  </div>

                  <div className="transfer-field">
                    <label htmlFor="transfer-amount">
                      Monto en pesos argentinos
                    </label>
                    <input
                      id="transfer-amount"
                      ref={transferAmountRef}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      maxLength={24}
                      value={transferAmount}
                      onChange={(event) => {
                        setTransferAmount(event.target.value);
                        setTransferErrors((current) => ({
                          ...current,
                          amount: undefined,
                          form: undefined,
                        }));
                      }}
                      placeholder="Ej.: 1.234,56"
                      aria-invalid={Boolean(transferErrors.amount)}
                      aria-describedby={
                        transferErrors.amount
                          ? "transfer-amount-hint transfer-amount-error"
                          : "transfer-amount-hint"
                      }
                    />
                    <span id="transfer-amount-hint" className="field-hint">
                      Usá coma para los decimales y hasta dos cifras; por
                      ejemplo, 1.234,56.
                    </span>
                    {transferErrors.amount && (
                      <span className="field-error" id="transfer-amount-error">
                        {transferErrors.amount}
                      </span>
                    )}
                  </div>

                  <div className="transfer-field">
                    <label htmlFor="transfer-concept">
                      Concepto <span>(opcional)</span>
                    </label>
                    <input
                      id="transfer-concept"
                      type="text"
                      maxLength={100}
                      value={transferConcept}
                      onChange={(event) =>
                        setTransferConcept(event.target.value)
                      }
                      placeholder="¿Para qué es esta simulación?"
                      aria-describedby="transfer-concept-count"
                    />
                    <span
                      id="transfer-concept-count"
                      className="field-hint"
                    >
                      {transferConcept.length}/100 caracteres
                    </span>
                  </div>

                  {transferErrors.form && (
                    <p className="transfer-form-error" role="alert">
                      {transferErrors.form}
                    </p>
                  )}
                  <p className="transfer-disclaimer">
                    Estás en una simulación. No se moverá dinero real.
                  </p>
                  <div className="transfer-actions">
                    <button className="action-primary" type="submit">
                      Revisar simulación
                    </button>
                    <button
                      className="action-secondary"
                      type="button"
                      onClick={cancelTransfer}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {transferStep === "review" && selectedRecipient && (
                <div className="transfer-review">
                  <h2
                    id="transfer-step-heading"
                    ref={transferReviewHeadingRef}
                    tabIndex={-1}
                  >
                    Revisá la simulación
                  </h2>
                  <dl className="transfer-review-list">
                    <div>
                      <dt>Destinatario ficticio</dt>
                      <dd>{selectedRecipient.name}</dd>
                    </div>
                    <div>
                      <dt>Importe</dt>
                      <dd className="tabular-nums">
                        {parsedTransferAmount === null
                          ? ""
                          : formatARS(parsedTransferAmount)}
                      </dd>
                    </div>
                    <div>
                      <dt>Concepto</dt>
                      <dd>{transferConcept.trim() || "Sin concepto"}</dd>
                    </div>
                  </dl>
                  <p className="transfer-disclaimer">
                    Estás por simular una transferencia. No se moverá dinero
                    real.
                  </p>
                  {transferErrors.form && (
                    <p className="transfer-form-error" role="alert">
                      {transferErrors.form}
                    </p>
                  )}
                  <div className="transfer-actions">
                    <button
                      className="action-secondary"
                      type="button"
                      onClick={() => setTransferStep("entry")}
                      disabled={isProcessingTransfer}
                    >
                      Volver a editar
                    </button>
                    <button
                      className="action-primary"
                      type="button"
                      onClick={confirmTransfer}
                      disabled={isProcessingTransfer}
                    >
                      {isProcessingTransfer
                        ? "Procesando simulación…"
                        : "Confirmar simulación"}
                    </button>
                    <button
                      className="text-action"
                      type="button"
                      onClick={cancelTransfer}
                      disabled={isProcessingTransfer}
                    >
                      Cancelar
                    </button>
                  </div>
                  <p className="sr-only" role="status" aria-live="polite">
                    {isProcessingTransfer ? "Procesando simulación." : ""}
                  </p>
                </div>
              )}

              {transferStep === "success" && (
                <div className="transfer-success" role="status">
                  <h2
                    id="transfer-step-heading"
                    ref={transferResultHeadingRef}
                    tabIndex={-1}
                  >
                    Simulación completada. No se realizó ninguna operación real
                  </h2>
                  <p>
                    La operación ficticia ya aparece en Inicio y Movimientos.
                  </p>
                  <div className="transfer-actions">
                    <button
                      className="action-primary"
                      type="button"
                      onClick={() => setActiveTab("movements")}
                    >
                      Ver movimientos
                    </button>
                    <button
                      className="action-secondary"
                      type="button"
                      onClick={startNewTransfer}
                    >
                      Nueva simulación
                    </button>
                  </div>
                </div>
              )}
            </section>
          </motion.div>
        )}
        {activeTab === "analytics" && (
          <SpendingPanel movements={demoMovements} showAmounts={showAmounts}
            reducedMotion={shouldReduceMotion} onReveal={() => updateShowAmounts(true)} />
        )}
        {activeTab === "invoices" && (
          <motion.div
            initial={pageInitial}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={pageTransition}
          >
            <>
              <header className="topbar">
                <div>
                  <h1>Servicios</h1>
                  <p>Gestión de servicios</p>
                </div>
              </header>
              <p className="demo-notice">Demo · Sin validez bancaria</p>
              {!demoState.persistenceAvailable && (
                <p className="persistence-notice" role="status">
                  Los cambios de esta demo solo se conservarán durante esta
                  sesión porque el almacenamiento no está disponible.
                </p>
              )}

              <section className="service-list-section" aria-label="Facturas de servicios">
                <div className="service-filter-group" role="group" aria-label="Filtrar facturas">
                  {(
                    [
                      ["pending", "Pendientes"],
                      ["paid", "Pagadas"],
                      ["all", "Todas"],
                    ] as const
                  ).map(([filter, label]) => (
                    <button
                      id={
                        filter === "pending"
                          ? "service-filter-pending"
                          : undefined
                      }
                      key={filter}
                      type="button"
                      className={
                        serviceFilter === filter ? "service-filter-active" : ""
                      }
                      aria-pressed={serviceFilter === filter}
                      onClick={() => setServiceFilter(filter)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {filteredServices.length === 0 ? (
                  <div className="service-empty-state" role="status">
                    <h2>
                      {serviceFilter === "pending"
                        ? "No tenés servicios pendientes"
                        : serviceFilter === "paid"
                          ? "Todavía no hay servicios pagados"
                          : "Todavía no hay facturas de demostración"}
                    </h2>
                    <p>
                      {serviceFilter === "pending"
                        ? "Las facturas pendientes aparecerán acá."
                        : "No hay facturas que mostrar con este filtro."}
                    </p>
                  </div>
                ) : (
                  <div className="invoice-grid">
                    {filteredServices.map((service) => {
                      const dueState = serviceDueState(service.dueDate);
                      const isPending = service.status === "pending";
                      const overdue = isPending && dueState.className === "vencido";
                      return (
                        <article key={service.id} className="invoice-card">
                          <div className="invoice-top">
                            <div>
                              <h2>{service.provider}</h2>
                              <p className="service-category">
                                {service.category} · {service.period}
                              </p>
                            </div>
                            <span
                              className={`status ${
                                overdue
                                  ? "vencido"
                                  : service.status === "paid"
                                    ? "pago"
                                    : service.status === "pending"
                                      ? "pendiente"
                                      : "rechazado"
                              }`}
                            >
                              {overdue
                                ? "Vencida · Pendiente"
                                : serviceStatusLabels[service.status]}
                            </span>
                          </div>

                          <p>Vencimiento: {formatDate(service.dueDate)}</p>
                          <h3
                            className="tabular-nums"
                            aria-label={
                              showAmounts
                                ? formatARS(service.amountCents)
                                : "Importe oculto"
                            }
                          >
                            {showAmounts
                              ? formatARS(service.amountCents)
                              : "••••••"}
                          </h3>
                          {isPending ? (
                            <button
                              className="action-primary service-payment-action"
                              type="button"
                              onClick={(event) =>
                                openServicePayment(
                                  service.id,
                                  event.currentTarget,
                                )
                              }
                            >
                              Simular pago
                            </button>
                          ) : (
                            <p className="service-paid-note">
                              Este servicio ya figura como pagado.
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          </motion.div>
        )}
        {activeTab === "settings" && (
          <motion.div
            initial={pageInitial}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={pageTransition}
          >
            <header className="topbar">
              <div>
                <h1>Configuración</h1>
                <p>Administrar preferencias</p>
              </div>
            </header>

            <section className="settings-grid">
              <div className="settings-card">
                <h2>Perfil de demostración</h2>
                <p>Valentín · Usuario ficticio</p>
                <p className="setting-note">Cuenta de ejemplo en pesos argentinos. No se solicitan datos personales ni bancarios.</p>
              </div>
              <div className="settings-card">
                <h2>Apariencia</h2>
                <label htmlFor="theme-preference">Tema de la aplicación</label>
                <select id="theme-preference" value={darkMode ? "dark" : "light"}
                  onChange={(event) => updateDarkMode(event.target.value === "dark")}>
                  <option value="dark">Modo oscuro</option>
                  <option value="light">Modo claro</option>
                </select>
                <p className="setting-note">La preferencia se conserva en este navegador cuando el almacenamiento está disponible.</p>
              </div>
              <div className="settings-card">
                <h2>Privacidad visual</h2>
                <p aria-live="polite">Importes {showAmounts ? "visibles" : "ocultos"} en las vistas informativas.</p>
                <button className="toggle-btn" type="button" aria-pressed={!showAmounts}
                  onClick={() => updateShowAmounts((current) => !current)}>
                  {showAmounts ? "Ocultar importes" : "Mostrar importes"}
                </button>
                <p className="setting-note">El monto que ingresás al simular una transferencia permanece visible para revisarlo.</p>
              </div>
              <div className="settings-card">
                <h2>Acerca de NovaBank</h2>
                <p>Proyecto de portfolio de banca personal. Los pagos y transferencias son simulaciones locales con datos ficticios.</p>
                <p className="setting-note">No mueve dinero, no ofrece autenticación bancaria y no genera comprobantes.</p>
              </div>
              <div className="settings-card reset-demo-card">
                <h3>Datos de demostración</h3>
                <p>
                  Restablecé los movimientos ficticios y las simulaciones
                  guardadas. Las preferencias de apariencia se conservarán.
                </p>
                <button
                  className="action-secondary"
                  type="button"
                  onClick={resetDemo}
                >
                  Restablecer demo
                </button>
              </div>
            </section>
          </motion.div>
        )}
        {selectedService && (
          <div
            className="movement-dialog-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeServicePayment();
            }}
          >
            <div
              ref={serviceDialogRef}
              className="movement-dialog service-payment-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="service-payment-title"
              aria-describedby={
                servicePaymentStep === "review"
                  ? "service-payment-disclaimer"
                  : undefined
              }
              onKeyDown={handleServiceDialogKeyDown}
            >
              <div className="movement-dialog-header">
                <div>
                  <p className="movement-demo-label">
                    Demo · Sin validez bancaria
                  </p>
                  <h2
                    id="service-payment-title"
                    ref={serviceDialogHeadingRef}
                    tabIndex={-1}
                  >
                    {servicePaymentStep === "review"
                      ? "Revisar simulación de pago"
                      : "Simulación completada. No se realizó ningún pago real"}
                  </h2>
                </div>
                {servicePaymentStep === "review" && (
                  <button
                    ref={serviceDialogCloseRef}
                    className="dialog-close"
                    type="button"
                    onClick={closeServicePayment}
                    disabled={isProcessingServicePayment}
                    aria-label="Cancelar simulación de pago"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              {servicePaymentStep === "review" ? (
                <>
                  <dl className="movement-detail-list service-review-list">
                    <div>
                      <dt>Proveedor ficticio</dt>
                      <dd>{selectedService.provider}</dd>
                    </div>
                    <div>
                      <dt>Categoría</dt>
                      <dd>{selectedService.category}</dd>
                    </div>
                    <div>
                      <dt>Período</dt>
                      <dd>{selectedService.period}</dd>
                    </div>
                    <div>
                      <dt>Vencimiento</dt>
                      <dd>{formatDate(selectedService.dueDate)}</dd>
                    </div>
                    <div>
                      <dt>Importe de la factura</dt>
                      <dd
                        className="tabular-nums"
                        aria-label={
                          revealServiceAmount
                            ? formatARS(selectedService.amountCents)
                            : "Importe oculto; se puede mostrar para verificar"
                        }
                      >
                        {revealServiceAmount
                          ? formatARS(selectedService.amountCents)
                          : "••••••"}
                      </dd>
                    </div>
                    <div>
                      <dt>Saldo disponible de demostración</dt>
                      <dd
                        className="tabular-nums"
                        aria-label={
                          showAmounts
                            ? formatARS(availableBalanceCents)
                            : "Saldo disponible oculto"
                        }
                      >
                        {showAmounts
                          ? formatARS(availableBalanceCents)
                          : "••••••"}
                      </dd>
                    </div>
                  </dl>
                  <button
                    className="text-action service-amount-toggle"
                    type="button"
                    onClick={() =>
                      setRevealServiceAmount((visible) => !visible)
                    }
                    aria-pressed={revealServiceAmount}
                  >
                    {revealServiceAmount
                      ? "Ocultar importe en esta revisión"
                      : "Mostrar importe para verificar"}
                  </button>
                  {selectedServiceIsOverdue && (
                    <p className="service-review-overdue">
                      Esta factura está vencida y todavía figura como pendiente.
                    </p>
                  )}
                  {selectedService.amountCents > availableBalanceCents && (
                    <p className="transfer-form-error" role="alert">
                      El saldo disponible de la demo no alcanza para este pago.
                    </p>
                  )}
                  {servicePaymentError && (
                    <p className="transfer-form-error" role="alert">
                      {servicePaymentError}
                    </p>
                  )}
                  <p
                    className="transfer-disclaimer"
                    id="service-payment-disclaimer"
                  >
                    Estás por simular el pago de un servicio. No se moverá
                    dinero real.
                  </p>
                  <div className="transfer-actions">
                    <button
                      className="action-secondary"
                      type="button"
                      onClick={closeServicePayment}
                      disabled={isProcessingServicePayment}
                    >
                      Cancelar
                    </button>
                    <button
                      className="action-primary"
                      type="button"
                      onClick={confirmServicePayment}
                      disabled={
                        isProcessingServicePayment ||
                        selectedService.status !== "pending" ||
                        selectedService.amountCents > availableBalanceCents
                      }
                    >
                      {isProcessingServicePayment
                        ? "Procesando simulación…"
                        : "Confirmar simulación"}
                    </button>
                  </div>
                  <p className="sr-only" role="status" aria-live="polite">
                    {isProcessingServicePayment
                      ? "Procesando simulación de pago."
                      : ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="service-payment-success" role="status">
                    El servicio quedó marcado como pagado en la demo.
                  </p>
                  <div className="transfer-actions">
                    <button
                      className="action-secondary"
                      type="button"
                      onClick={closeServicePayment}
                    >
                      Volver a servicios
                    </button>
                    <button
                      className="action-primary"
                      type="button"
                      onClick={() => {
                        setSelectedServiceId(null);
                        setActiveTab("movements");
                      }}
                    >
                      Ver movimientos
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {selectedMovement && (
          <div
            className="movement-dialog-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeMovementDetail();
            }}
          >
            <div
              ref={movementDetailRef}
              className="movement-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="movement-dialog-title"
              onKeyDown={handleMovementDetailKeyDown}
            >
              <div className="movement-dialog-header">
                <div>
                  <p className="movement-demo-label">
                    Demo · Sin validez bancaria
                  </p>
                  <h2 id="movement-dialog-title">
                    {selectedMovement.concept}
                  </h2>
                </div>
                <button
                  ref={detailCloseButtonRef}
                  className="dialog-close"
                  type="button"
                  onClick={closeMovementDetail}
                  aria-label="Cerrar detalle del movimiento"
                >
                  Cerrar
                </button>
              </div>

              <dl className="movement-detail-list">
                <div>
                  <dt>Importe</dt>
                  <dd
                    className={`movement-amount ${selectedMovement.type}`}
                    aria-label={
                      showAmounts
                        ? signedMovementAmount(selectedMovement)
                        : "Importe oculto"
                    }
                  >
                    {showAmounts
                      ? signedMovementAmount(selectedMovement)
                      : "••••••"}
                  </dd>
                </div>
                <div>
                  <dt>Tipo</dt>
                  <dd>
                    {selectedMovement.type === "income" ? "Ingreso" : "Egreso"}
                  </dd>
                </div>
                <div>
                  <dt>Categoría</dt>
                  <dd>{selectedMovement.category}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>{formatDate(selectedMovement.date)}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <span
                      className={`status status-${selectedMovement.status}`}
                    >
                      {movementStatusLabels[selectedMovement.status]}
                    </span>
                  </dd>
                </div>
              </dl>

              <p className="movement-demo-disclaimer">
                Movimiento ficticio de demostración. No representa una
                operación real y no tiene validez bancaria.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
