# Moncar 🚗🔧

**Moncar** es un sistema de gestión operativa ágil, directo y sin fricciones diseñado para el uso cotidiano en talleres mecánicos. Olvidamos las exhibiciones corporativas para centrarnos en lo verdaderamente crítico: **velocidad de registro, control de presupuestos transparente (desglose de mano de obra y repuestos) y seguimiento del estado de los vehículos en tiempo real.**

## 🚀 Características Principales

- **Interfaz Unificada y Ágil:** Accesible tanto para clientes como administradores desde una única vista optimizada. Perfecta para operar desde una tablet en el mostrador o el taller.
- **Gestión Visual de Órdenes:** Seguimiento del estado en tiempo real (Pendiente, En Reparación, Listo).
- **Control Financiero Transparente:** Cálculo automático de presupuestos separando estrictamente "Mano de Obra" y "Repuestos".
- **Robusta Validación de Datos:** Validación proactiva en el cliente (Vanilla JS) y en el servidor (Zod).
- **Reportes Financieros de Precisión:** Dashboard para administradores con cálculo exacto de ingresos facturados vs. en curso.
- **Seguridad y Registro Cerrado:** Autenticación mediante JWT y contraseñas (Bcrypt). El sistema es 100% cerrado al público: los nuevos mecánicos solo pueden registrarse a través de un **Sistema de Invitaciones Seguras** (tokens de un solo uso encriptados generados por un `OWNER`).
---

## 🛠️ Stack Tecnológico

A diferencia de las arquitecturas monolíticas pesadas, Moncar apuesta por la agilidad extrema en el cliente respaldada por un backend fuertemente tipado.

### Frontend
- **HTML5 & CSS3** (Estilizado rápido y responsivo vía Tailwind CSS CDN).
- **Vanilla JavaScript** (Manipulación asíncrona del DOM sin tiempos de compilación ni dependencias innecesarias).

### Backend
- **Core:** Node.js + Express.js.
- **Lenguaje:** TypeScript (Para un tipado estricto y predecible de extremo a extremo).
- **Base de Datos & ORM:** MySQL interactuando a través de **Prisma ORM**.
- **Seguridad & Validación:** Zod (Esquemas), JWT (Autenticación), Bcrypt (Hasheo de contraseñas).

---

## 🆚 Moncar vs. Checkcar

Aunque ambos sistemas abordan la gestión vehicular, sus filosofías y arquitecturas son radicalmente opuestas.

| Característica | Moncar 🚗🔧 | Checkcar 🏢🚙 |
| :--- | :--- | :--- |
| **Enfoque del Producto** | **Herramienta operativa interna, rápida y directa.** | Producto comercial (SaaS) enfocado en marketing. |
| **Página de Aterrizaje** | ❌ Inexistente. Va directo al flujo de trabajo. | ✅ Completa (Marketing, Testimonios, Precios). |
| **Frontend** | Vanilla JavaScript + Tailwind CSS. Ultraligero. | React.js + Vite. Arquitectura pesada de componentes. |
| **Backend** | **TypeScript + Prisma ORM**. Fuertemente tipado. | JavaScript + SQL Crudo (driver `mysql2`). |
| **Interfaz de Usuario** | Vista compartida y rápida. Ideal para trabajo físico. | Interfaces segregadas corporativas y públicas. |
| **Gestión Financiera** | Diferenciación estricta de *Mano de Obra* y *Repuestos*. | Montos globales orientados a la facturación. |

> **En síntesis:** Checkcar es la vitrina digital corporativa. **Moncar es la herramienta cruda e interna que el mecánico tiene abierta en la tablet, lista para registrar un vehículo en menos de 5 segundos.**

---

## ⚙️ Instalación y Configuración Local

### 1. Configuración del Entorno

```bash
# Navegar al directorio del backend
cd backend

# Instalar dependencias
npm install
```

### 2. Variables de Entorno

Crear un archivo `.env` en el directorio `backend` con el siguiente contenido (basarse en `.env.example`):

```env
DATABASE_URL="mysql://usuario:password@localhost:3306/moncar_db"
JWT_SECRET="tu_secreto_super_seguro_y_complejo"
PORT=3000
APP_URL="http://localhost:3000"
CRON_SECRET="un_secreto_distinto_para_el_scheduler"
# Opcional: webhook compatible con WhatsApp/email propio
NOTIFICATION_WEBHOOK_URL=""
```

### 3. Base de Datos y Ejecución

```bash
# Generar el cliente de Prisma y sincronizar el esquema con la base de datos
npx prisma generate
npx prisma db push

# Compilar el código TypeScript
npm run build

# Iniciar el servidor
npm start
```

Para desarrollo con recarga en caliente (hot-reload):

```bash
npm run dev
```

## Fases 5–8 implementadas

- **Tracking público:** `GET /api/vehicles/track?plate=...&phone=...`, limitado por IP y sin exponer datos del propietario.
- **Inventario:** `GET /api/inventory`, alta de repuestos, ajustes de entrada/salida y movimientos auditables. Los repuestos asociados a una reparación se consumen dentro de la misma transacción que la orden.
- **Comprobantes:** `GET /api/vehicles/:id/pdf`, protegido con JWT.
- **Notificaciones:** al pasar un vehículo a `LISTO` se registra el evento. `NOTIFICATION_WEBHOOK_URL` permite conectarlo con un proveedor externo; sin webhook se genera un enlace de WhatsApp para envío manual.
- **Mantenimiento:** `/api/cron/cleanup-invites` elimina invitaciones usadas o expiradas y está programado diariamente en Vercel.

En Vercel, configurar como mínimo `DATABASE_URL`, `JWT_SECRET`, `APP_URL` y `CRON_SECRET`. El build de producción ejecuta `prisma migrate deploy` antes de compilar.

Para backups locales de MySQL, definir opcionalmente `MYSQL_USER` y `MYSQL_PASSWORD` y ejecutar:

```powershell
./scripts/backup-mysql.ps1
```

El script conserva los últimos 7 días en `backend/backups/` y esa carpeta no se versiona.

---

**Moncar:** Potencia el flujo de trabajo de tu taller mecánico con eficiencia extrema y sin complicaciones.
