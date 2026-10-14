# NovaBank Pro

Demo interactiva de banca personal para portfolio, con interfaz en español y datos ficticios. **Sin validez bancaria: no mueve dinero, no solicita datos bancarios ni genera comprobantes.**

## Funcionalidades

- Inicio con saldo disponible, resumen del mes, movimientos recientes y próximos vencimientos.
- Historial con búsqueda sin distinción de tildes, filtros por tipo, estado y fechas, y detalle informativo.
- Transferencias simuladas a destinatarios predefinidos: ingreso, validación, revisión y resultado.
- Pago simulado de servicios, con validación de saldo y prevención de pagos duplicados.
- Mis gastos: selector de período, ingresos, egresos, balance y distribución por categoría. Comparación con el período anterior cuando existen registros; el mes de referencia compara días equivalentes.
- Configuración con perfil ficticio, temas claro/oscuro, ocultación de importes y restablecimiento de la demo.
- Navegación por teclado, foco visible, modales y respeto de movimiento reducido.

## Tecnologías

Next.js (App Router), React, TypeScript, CSS con variables, Geist mediante next/font, Recharts y Framer Motion. No se utiliza un backend bancario.

## Ejecución local

Con una versión de Node.js compatible con Next.js 16 (20.9 o superior):

```bash
npm ci
npm run dev
```

Abrí http://localhost:3000. Para una compilación de producción:

```bash
npm run build
npm start
```

La compilación necesita acceso a Google Fonts para descargar Geist mediante next/font.

## Verificación

```bash
npm run lint
npx tsc --noEmit
node --test tests/demo.test.cjs
npm run build
```

Las pruebas usan el runner incorporado de Node y TypeScript ya instalado. Compilan los módulos de dominio en una carpeta temporal, sin tocar el estado del navegador. Cubren cálculos, categorías, duplicados, saldo, pagos, persistencia, migración y recuperación.

## Modelo de datos

`app/demo-data.ts` define la fecha de referencia de la demo (13 de octubre de 2026), el saldo inicial y los registros ficticios. Los importes se guardan en centavos. Solo los movimientos completados afectan el saldo y los resúmenes. Los egresos incluyen transferencias salientes y pagos de servicios; el balance del período no equivale al saldo disponible.

`app/demo-store.ts` integra operaciones y facturas. `app/spending.ts` calcula los resúmenes mensuales y `app/spending-panel.tsx` los presenta, con una alternativa textual al gráfico.

## Persistencia y privacidad visual

Las operaciones simuladas se guardan localmente bajo `novabank-demo-state`. El tema y la ocultación usan `novabank-theme` y `novabank-show-amounts`. No hay sincronización con un servidor. Si el almacenamiento está bloqueado, las operaciones pueden usarse durante la sesión; los datos inválidos se recuperan al estado inicial con un aviso.

“Restablecer demo” requiere confirmación, elimina las operaciones simuladas y recupera las facturas iniciales sin borrar las preferencias de apariencia. Ocultar importes también retira el gráfico y sus tooltips. El monto de una transferencia permanece visible durante la edición y revisión; en servicios puede revelarse expresamente para confirmar.

## Límites

- Los datos son ejemplos, no un historial bancario completo ni asesoramiento financiero.
- No hay cuentas reales, login, autenticación en dos pasos, envío de correos ni pagos reales.
- No se generan recibos, comprobantes, exportaciones, QR ni códigos de autorización.
- La navegación entre secciones es local a la pantalla; no hay URLs independientes por sección.
- La persistencia local no ofrece garantías transaccionales entre varias pestañas que operen simultáneamente. Usar una pestaña para recorrer la demo.
- El perfil es fijo y ficticio. No se recopilan datos personales.
