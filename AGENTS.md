# AGENTS.md — Moncar

## Resumen del proyecto

Sistema web para talleres mecánicos. El backend ejecutable está en `backend/` y usa Node.js, TypeScript, Express, Prisma, PostgreSQL, Zod, JWT y bcrypt; el frontend servido está bajo `backend/public/`.

## Equipo de ingeniería

La entrada única es `fullstack-orchestrator`, definido en `.agents/agents/fullstack-orchestrator.md`. Aplicar también `../AGENTS.md` cuando esté disponible. Skills prioritarias: `typescript-reliability`, `prisma-postgres`, `auth-security`, `testing-quality`, `performance`, `devops-cicd` y `release-engineering`.

## Setup, desarrollo y validación

Desde `backend/`:

- `npm install`
- Desarrollo: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Tests: `npm test`
- Producción local: `npm start`
- `npm run vercel-build` solo con aprobación explícita para migraciones y despliegue.

## Arquitectura y estilo

Preservar la separación frontend/API/dominio/infraestructura. Validar con Zod en bordes, usar Prisma sin N+1 y mantener autorización por recurso en servidor. Las migraciones requieren `database-prisma` y `security-review` cuando afecten datos o permisos.

## Seguridad

JWT, bcrypt e invitaciones son límites de confianza. No exponer tokens, hashes, variables de entorno ni credenciales. Nunca ejecutar migraciones destructivas sin aprobación humana.

## Flujo de contribución

Ejecutar lint, tests y build del backend; revisar diff y resultados de seguridad/performance. Release solo después de `devops` y `release-manager`.
