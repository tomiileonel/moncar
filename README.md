# Moncar 🚗🔧

**Moncar** es un sistema de gestión operativa ágil y directo diseñado específicamente para el uso cotidiano en talleres mecánicos. Creado bajo una filosofía de "cero fricciones", Moncar omite la exhibición corporativa para centrarse exclusivamente en la velocidad de registro, el control de presupuestos (desglose de mano de obra y repuestos) y el seguimiento del estado de los vehículos en tiempo real.

## 🚀 Características Principales

* **Interfaz Unificada y Ágil:** Acceso de clientes y administradores desde una misma pantalla rápida, ideal para usarse en una tablet de mostrador.
* **Gestión de Órdenes en Tiempo Real:** Seguimiento visual del estado de los vehículos (Pendiente, En Reparación, Listo).
* **Desglose Financiero Dinámico:** Cálculo en tiempo real de presupuestos separando "Mano de Obra" y "Repuestos".
* **Validación Estricta:** Limpieza y validación de datos proactiva tanto en el cliente (Vanilla JS) como en el servidor (Zod).
* **Seguridad:** Autenticación de mecánicos/administradores mediante JWT y encriptación de contraseñas con Bcrypt.

---

## 🛠️ Stack Tecnológico

A diferencia de las arquitecturas monolíticas de frontend pesadas, Moncar apuesta por un frontend ultraligero combinado con un backend fuertemente tipado y robusto.

**Frontend:**
* HTML5 & CSS3 (Tailwind CSS vía CDN)
* Vanilla JavaScript (Manipulación directa del DOM y gestión de estado asíncrono)

**Backend:**
* **Entorno:** Node.js con Express.js
* **Lenguaje:** TypeScript (Asegurando tipado estricto de extremo a extremo)
* **Base de Datos & ORM:** MySQL gestionado a través de **Prisma ORM**
* **Validación & Seguridad:** Zod (Validación de esquemas), JWT (Autenticación), Bcrypt (Hasheo).

---

## 🆚 Moncar vs. Checkcar

Aunque ambos sistemas abordan la gestión de vehículos, tienen propósitos, enfoques y arquitecturas de software diametralmente opuestas.

| Característica | Moncar 🚗🔧 | Checkcar 🏢🚙 |
| :--- | :--- | :--- |
| **Enfoque del Producto** | Herramienta de uso interno, rápido y operativo. | Producto comercial (SaaS) enfocado en "venderse al mercado". |
| **Landing Page** | ❌ Inexistente. Va directo a la acción. | ✅ Completa (Secciones *Why Us*, *Testimonials*, *Services*). |
| **Stack Frontend** | Vanilla JavaScript + HTML/Tailwind. Renderizado ligero y sin tiempos de compilación complejos. | React.js + Vite + Enrutamiento (React Router). Arquitectura basada en componentes. |
| **Stack Backend** | **TypeScript + Prisma ORM**. Fuertemente tipado, con migraciones automáticas y validación con Zod. | **JavaScript + SQL Crudo**. Consultas manuales a MySQL mediante el driver `mysql2`. |
| **Flujo de Usuario** | Interfaz compartida (Portal de cliente y Admin modal en la misma vista). Ideal para uso físico en el taller. | Interfaces separadas. Rutas protegidas exclusivas y vistas corporativas públicas distintas. |
| **Gestión de Costos** | Diferenciación estricta y en tiempo real de *Mano de Obra* vs *Repuestos* al editar. | Manejo de montos más general orientados a la facturación de órdenes globales. |

**En resumen:** `Checkcar` es la vitrina digital y el sistema administrativo completo que un taller usaría para atraer clientes de internet. `Moncar` es la herramienta cruda, rápida e interna que el mecánico o recepcionista tiene abierta en la tablet llena de grasa para registrar un auto en 5 segundos.

---

## ⚙️ Instalación y Configuración Local

### 1. Configuración del Backend
```bash
# Navegar al directorio del backend
cd backend

# Instalar dependencias
npm install

# Configurar variables de entorno (Crear archivo .env)
# DATABASE_URL="mysql://usuario:password@localhost:3306/moncar_db"
# JWT_SECRET="tu_secreto_super_seguro"

# Generar el cliente de Prisma y sincronizar la BD
npx prisma generate
npx prisma db push

# Compilar TypeScript e iniciar el servidor
npm run build
npm start
