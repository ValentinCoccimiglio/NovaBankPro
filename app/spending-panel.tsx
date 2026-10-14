"use client";
import { useState } from "react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { DEMO_REFERENCE_DATE, type Movement } from "./demo-data";
import { availablePeriods, periodLabel, previousPeriod, spendingSummary } from "./spending";

const money = (cents: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(cents / 100);
const percent = (value: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);

export default function SpendingPanel({ movements, showAmounts, reducedMotion, onReveal }: {
  movements: Movement[]; showAmounts: boolean; reducedMotion: boolean; onReveal: () => void;
}) {
  const [selectedMonth, setSelectedMonth] = useState(DEMO_REFERENCE_DATE.slice(0, 7));
  const periods = availablePeriods(movements);
  const month = periods.includes(selectedMonth) ? selectedMonth : periods[0];
  const current = month === DEMO_REFERENCE_DATE.slice(0, 7);
  const throughDay = current ? Number(DEMO_REFERENCE_DATE.slice(8, 10)) : 31;
  const summary = spendingSummary(movements, month, throughDay);
  const previous = spendingSummary(movements, previousPeriod(month), throughDay);
  const value = (cents: number) => showAmounts ? money(cents) : "••••";
  const comparison = previous.expenseCents > 0
    ? (summary.expenseCents - previous.expenseCents) / previous.expenseCents * 100 : null;
  return (
    <div>
      <header className="topbar"><div><h1>Mis gastos</h1><p>Entendé cómo se distribuyen tus egresos de demostración.</p></div></header>
      <p className="demo-notice">Demo · Sin validez bancaria · Fecha de referencia: {DEMO_REFERENCE_DATE.split("-").reverse().join("/")}</p>
      <div className="period-control"><label htmlFor="spending-period">Mes y año</label>
        <select id="spending-period" value={month} onChange={(event) => setSelectedMonth(event.target.value)}>
          {periods.map((period) => <option key={period} value={period}>{periodLabel(period)}</option>)}
        </select>
      </div>
      <p className="setting-note">{current ? `Del 1 al ${throughDay} de ${periodLabel(month)}.` : periodLabel(month)} Solo operaciones completadas. Los egresos incluyen pagos de servicios y transferencias salientes.</p>
      <section className="personal-summary-grid" aria-label="Resumen del período">
        {[ ["Ingresos", summary.incomeCents], ["Gastos", summary.expenseCents], ["Balance del período", summary.balanceCents] ].map(([label, amount]) => (
          <div className="stat-card" key={label}><p>{label}</p><h2 className="tabular-nums">{value(Number(amount))}</h2></div>
        ))}
      </section>
      <p className="setting-note">El balance es la diferencia entre ingresos y gastos de este período; no es el saldo disponible de la cuenta.</p>
      {!summary.count ? <p className="empty-results" role="status">No hay movimientos completados en este período.</p> : (
        <section className="analytics-card spending-categories" aria-labelledby="categories-title">
          <h2 id="categories-title">Gastos por categoría</h2>
          {!showAmounts ? <div className="empty-results"><p>Los importes y el gráfico están ocultos.</p><button className="action-secondary" onClick={onReveal}>Mostrar importes</button></div>
            : !summary.expenseCents ? <p role="status">No hay gastos completados en este período.</p> : <>
              <div className="spending-chart" aria-hidden="true">
                <ResponsiveContainer width="100%" height={Math.max(220, summary.categories.length * 48)}>
                  <BarChart data={summary.categories} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 0 }} accessibilityLayer={false}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="category" width={110} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(amount) => money(Number(amount))} cursor={{ fill: "var(--surface-raised)" }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 10 }} />
                    <Bar dataKey="amountCents" name="Gastos" fill="var(--accent)" radius={[0, 6, 6, 0]} isAnimationActive={!reducedMotion} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="category-list" aria-label="Detalle de gastos por categoría">
                {summary.categories.map((item) => <li key={item.category}><span>{item.category}</span><strong className="tabular-nums">{money(item.amountCents)}</strong><span>{percent(item.percentage)} %</span></li>)}
              </ul>
            </>}
        </section>
      )}
      <section className="analytics-card spending-comparison" aria-labelledby="comparison-title">
        <h2 id="comparison-title">Comparación de gastos</h2>
        {!showAmounts ? <p>Mostrá los importes para consultar la comparación.</p> : !summary.count || !previous.count ? <p>No hay suficientes registros para comparar con el mes anterior.</p> : comparison === null ? <p>El período anterior no registra gastos. No se calcula una variación porcentual sobre cero.</p> : <p><strong>{percent(Math.abs(comparison))} % {comparison > 0 ? "más" : comparison < 0 ? "menos" : "de variación"}</strong> respecto de {periodLabel(previousPeriod(month))}.</p>}
        <p className="setting-note">{current ? `Se comparan los días 1 al ${throughDay} de ambos meses.` : "Se comparan los meses completos."} Los resultados se basan únicamente en los registros ficticios disponibles, no en un historial bancario completo.</p>
      </section>
    </div>
  );
}
