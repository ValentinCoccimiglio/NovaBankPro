"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

const revenueData = [
  { month: "Enero", revenue: 4000 },

  { month: "Febrero", revenue: 6200 },

  { month: "Marzo", revenue: 5800 },

  { month: "Abril", revenue: 9100 },

  { month: "Mayo", revenue: 12400 },

  { month: "Junio", revenue: 14800 },
];
const expensesData = [
  { month: "Enero", expenses: 2200 },
  { month: "Febrero", expenses: 2800 },
  { month: "Marzo", expenses: 3100 },
  { month: "Abril", expenses: 4200 },
  { month: "Mayo", expenses: 5100 },
  { month: "Junio", expenses: 6200 },
];

const transactions = [
  {
    client: "Internet Hogar",
    amount: "$12,400",
    status: "Pago",
  },

  {
    client: "Luz",
    amount: "$8,200",
    status: "Pendiente",
  },

  {
    client: "Servicio Agua",
    amount: "$4,820",
    status: "En proceso",
  },

  {
    client: "Seguro Auto",
    amount: "$18,900",
    status: "Pago",
  },
];

const invoices = [
  {
    id: "#2481",
    client: "Luz",
    amount: "$8,200",
    status: "Pendiente",
  },
  {
    id: "#2482",
    client: "Agua",
    amount: "$12,400",
    status: "Pago",
  },
  {
    id: "#2483",
    client: "Internet",
    amount: "$4,900",
    status: "Rechazado",
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [emailNotifications, setEmailNotifications] = useState(true);

  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  return (
    <main className={darkMode ? "dashboard" : "dashboard light-mode"}>
      <aside className="sidebar">
        <h2>NovaBank</h2>
        <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>

        <nav>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={activeTab === "dashboard" ? "sidebar-active" : ""}
          >
            Inicio
          </button>

          <button
            onClick={() => setActiveTab("transactions")}
            className={activeTab === "transactions" ? "sidebar-active" : ""}
          >
            Transferencias
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={activeTab === "analytics" ? "sidebar-active" : ""}
          >
            Analticas
          </button>

          <button
            onClick={() => setActiveTab("invoices")}
            className={activeTab === "invoices" ? "sidebar-active" : ""}
          >
            Servicios
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={activeTab === "settings" ? "sidebar-active" : ""}
          >
            Configuracion
          </button>
        </nav>
      </aside>

      <section className="content">
        {" "}
        {activeTab === "dashboard" && (
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.35,
            }}
          >
            {" "}
            <header className="topbar">
              <div>
                <h1>BIENVENIDO</h1>

                <p>Valentin</p>
              </div>

              <button>Registrar error</button>
            </header>
            <section className="hero-card">
              <p>SALDO TOTAL</p>

              <h2>$248,420</h2>

              <span>+18.2% Este mes</span>
            </section>
            <section className="stats-grid">
              <div className="stat-card">
                <p>Total Transferencias</p>

                <h3>12,480</h3>

                <span>+12%</span>
              </div>

              <div className="stat-card">
                <p>Clientes activos</p>

                <h3>1,284</h3>

                <span>+4.8%</span>
              </div>

              <div className="stat-card">
                <p>Facturas pendientes</p>

                <h3>84</h3>

                <span>-2.1%</span>
              </div>

              <div className="stat-card">
                <p>Rendimientos</p>

                <h3>18.2%</h3>

                <span>+6.4%</span>
              </div>
            </section>
            <section className="insights-grid">
              <div className="insight-card revenue-growth">
                <p>Crecimiento de ingresos</p>

                <h2>+18.4%</h2>

                <span>En comparación con el mes pasado</span>
              </div>

              <div className="insight-card">
                <p>Fondos</p>

                <h2>$82,400</h2>

                <span>Liquidez disponible</span>
              </div>
            </section>
            <section className="business-insights">
              <h3>Información empresarial</h3>

              <div className="insight-item">
                Los ingresos mensuales aumentaron un 18,4% en comparación con el período anterior.
              </div>

              <div className="insight-item">
                La tasa de retención de clientes se mantiene por encima del 92%.
              </div>

              <div className="insight-item">
                Los tiempos de procesamiento de pagos mejoraron un 12%.
              </div>
            </section>
            <section className="analytics-section">
              <div className="analytics-card">
                <div className="analytics-header">
                  <div>
                    <h3>Análisis de ingresos</h3>

                    <p>Rendimiento empresarial mensual</p>
                  </div>

                  <button>Descargar</button>
                </div>

                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={revenueData}>
                      <XAxis dataKey="month" />

                      <Tooltip />

                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#3b82f6"
                        strokeWidth={4}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
            <section className="table-section">
              <div className="table-card">
                <div className="table-header">
                  <div>
                    <h3>MOVIMIENTOS RECIENTES</h3>

                    <p>Última actividad empresarial</p>
                  </div>

                  <button>Ver todo</button>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>

                      <th>Saldo</th>

                      <th>Estado</th>
                    </tr>
                  </thead>

                  <tbody>
                    {transactions.map((transaction, index) => (
                      <tr key={index}>
                        <td>{transaction.client}</td>

                        <td>{transaction.amount}</td>

                        <td>
                          <span
                            className={`status ${transaction.status.toLowerCase()}`}
                          >
                            {transaction.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </motion.div>
        )}
        {activeTab === "transactions" && (
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.35,
            }}
          >
            <header className="topbar">
              <div>
                <h1>Transactions</h1>
                <p>Gestionar todas las transferencias comerciales</p>
              </div>
            </header>

            <section className="table-section">
              <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Saldo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>

                  <tbody>
                    {transactions.map((transaction, index) => (
                      <tr key={index}>
                        <td>{transaction.client}</td>
                        <td>{transaction.amount}</td>

                        <td>
                          <span
                            className={`status ${transaction.status.toLowerCase()}`}
                          >
                            {transaction.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </motion.div>
        )}
        {activeTab === "analytics" && (
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.35,
            }}
          >
            <header className="topbar">
              <div>
                <h1>Analiticas</h1>
                <p>Descripción general del rendimiento</p>
              </div>
            </header>

            <section className="analytics-section">
              <div className="analytics-card">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={revenueData}>
                    <XAxis dataKey="month" />
                    <Tooltip />

                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={4}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="analytics-grid">
              <div className="analytics-card">
                <h3>Resumen de gastos</h3>

                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={expensesData}>
                    <XAxis dataKey="month" />

                    <Tooltip />

                    <Bar dataKey="expenses" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="executive-grid">
              <div className="stat-card">
                <p>Beneficio</p>

                <h3>$66,200</h3>

                <span>+14.2%</span>
              </div>

              <div className="stat-card">
                <p>Transacción promedio</p>

                <h3>$842</h3>

                <span>+8.4%</span>
              </div>

              <div className="stat-card">
                <p>Tasa de retención</p>

                <h3>92%</h3>

                <span>Estable</span>
              </div>
            </section>
          </motion.div>
        )}
        {activeTab === "invoices" && (
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.35,
            }}
          >
            <>
              <header className="topbar">
                <div>
                  <h1>Servicios</h1>
                  <p>Gestion de sevicios</p>
                </div>

                <button>Pagar Servicio</button>
              </header>

              <section className="invoice-grid">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="invoice-card">
                    <div className="invoice-top">
                      <h3>{invoice.id}</h3>

                      <span
                        className={`status ${invoice.status.toLowerCase()}`}
                      >
                        {invoice.status}
                      </span>
                    </div>

                    <p>{invoice.client}</p>

                    <h2>{invoice.amount}</h2>
                  </div>
                ))}
              </section>
            </>
          </motion.div>
        )}
        {activeTab === "settings" && (
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.35,
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <header className="topbar">
                <div>
                  <h1>Configuracion</h1>
                  <p>Administrar prefrencias</p>
                </div>
              </header>

              <section className="settings-grid">
                <div className="settings-card">
                  <h3>Perfil</h3>

                  <p>NovaBank Inc.</p>

                  <span>Cuenta bancaria</span>
                </div>

                <div className="settings-card">
                  <h3>Notificaciones Email</h3>

                  <button
                    className="toggle-btn"
                    onClick={() => setEmailNotifications(!emailNotifications)}
                  >
                    {emailNotifications ? "Desactivadas" : "Activadas"}
                  </button>
                </div>

                <div className="settings-card">
                  <h3>Autenticacion en dos pasos</h3>

                  <button
                    className="toggle-btn"
                    onClick={() => setTwoFactorAuth(!twoFactorAuth)}
                  >
                    {twoFactorAuth ? "Desactivada" : "Activiada"}
                  </button>
                </div>
              </section>
            </motion.div>
          </motion.div>
        )}
      </section>
    </main>
  );
}
