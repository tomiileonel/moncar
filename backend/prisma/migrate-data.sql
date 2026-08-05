-- ═══════════════════════════════════════════════════════════════
-- MONCAR: Script de Migración de Datos (Fase 3)
-- Ejecutar ANTES de `npx prisma migrate dev --name schema-v2`
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- PASO 0: BACKUP (OBLIGATORIO)
-- ═══════════════════════════════════════════════════════════════
-- Desde PowerShell (con WAMP levantado):
-- c:\wamp64\bin\mysql\mysql8.4.7\bin\mysqldump.exe -u root moncar > moncar_backup.sql

-- ═══════════════════════════════════════════════════════════════
-- PASO 1: INSPECCIÓN (EJECUTAR Y LEER ANTES DE CONTINUAR)
-- ═══════════════════════════════════════════════════════════════
-- Ejecutar estas queries y LEER los resultados antes de proseguir.
-- Si la DB tiene 0 registros, saltar directamente a PASO 4.

SELECT 'Total de registros:' AS inspection;
SELECT COUNT(*) AS total FROM Vehicle;

SELECT 'cost_labor formats:' AS inspection;
SELECT DISTINCT cost_labor FROM Vehicle WHERE cost_labor IS NOT NULL LIMIT 20;

SELECT 'cost_parts formats:' AS inspection;
SELECT DISTINCT cost_parts FROM Vehicle WHERE cost_parts IS NOT NULL LIMIT 20;

SELECT 'km formats:' AS inspection;
SELECT DISTINCT km FROM Vehicle WHERE km IS NOT NULL LIMIT 20;

SELECT 'entry formats:' AS inspection;
SELECT DISTINCT entry FROM Vehicle LIMIT 10;

SELECT 'status values:' AS inspection;
SELECT DISTINCT status FROM Vehicle;

SELECT 'source values:' AS inspection;
SELECT DISTINCT source FROM Vehicle;

SELECT 'type values:' AS inspection;
SELECT DISTINCT type FROM Vehicle;

SELECT 'model (year) values:' AS inspection;
SELECT DISTINCT model FROM Vehicle LIMIT 20;

-- ═══════════════════════════════════════════════════════════════
-- PASO 2: TRANSFORMACIÓN DE DATOS (SOLO SI N > 0 REGISTROS)
-- ═══════════════════════════════════════════════════════════════

-- 2a. km: String → Int (quitar separadores de miles)
UPDATE Vehicle SET km = NULL WHERE km IS NULL OR TRIM(km) = '' OR TRIM(km) = '0';
UPDATE Vehicle SET km = CAST(REPLACE(REPLACE(km, '.', ''), ',', '') AS UNSIGNED)
  WHERE km IS NOT NULL AND TRIM(km) != '';

-- 2b. cost_labor: String → Decimal
UPDATE Vehicle SET cost_labor = NULL WHERE cost_labor IS NULL OR TRIM(cost_labor) = '';
UPDATE Vehicle SET cost_labor = CASE
  WHEN cost_labor LIKE '%,%' THEN
    CAST(REPLACE(REPLACE(cost_labor, '.', ''), ',', '.') AS DECIMAL(12,2))
  ELSE
    CAST(cost_labor AS DECIMAL(12,2))
  END
  WHERE cost_labor IS NOT NULL AND TRIM(cost_labor) != '';

-- 2c. cost_parts: String → Decimal (mismo tratamiento que cost_labor)
UPDATE Vehicle SET cost_parts = NULL WHERE cost_parts IS NULL OR TRIM(cost_parts) = '';
UPDATE Vehicle SET cost_parts = CASE
  WHEN cost_parts LIKE '%,%' THEN
    CAST(REPLACE(REPLACE(cost_parts, '.', ''), ',', '.') AS DECIMAL(12,2))
  ELSE
    CAST(cost_parts AS DECIMAL(12,2))
  END
  WHERE cost_parts IS NOT NULL AND TRIM(cost_parts) != '';

-- 2d. entry: String → DateTime
UPDATE Vehicle SET entry = CASE
  WHEN entry LIKE '%/%' THEN STR_TO_DATE(entry, '%d/%m/%Y')
  WHEN entry LIKE '%-%' THEN STR_TO_DATE(entry, '%Y-%m-%d')
  ELSE entry
END WHERE entry IS NOT NULL AND TRIM(entry) != '';

-- 2e. exit: String → DateTime (mismo tratamiento que entry)
UPDATE Vehicle SET exit = CASE
  WHEN exit LIKE '%/%' THEN STR_TO_DATE(exit, '%d/%m/%Y')
  WHEN exit LIKE '%-%' THEN STR_TO_DATE(exit, '%Y-%m-%d')
  ELSE exit
END WHERE exit IS NOT NULL AND TRIM(exit) != '';

-- 2f. status: strings → enum values (capitalización)
UPDATE Vehicle SET status = 'PENDIENTE' WHERE status = 'Pendiente';
UPDATE Vehicle SET status = 'EN_REPARACION' WHERE status = 'En reparación';
UPDATE Vehicle SET status = 'LISTO' WHERE status = 'Listo';

-- 2g. source: strings → enum values (capitalización)
UPDATE Vehicle SET source = 'CLIENT' WHERE source = 'client';
UPDATE Vehicle SET source = 'ADMIN' WHERE source = 'admin';

-- 2h. type: strings → enum values (capitalización)
UPDATE Vehicle SET type = 'AUTO' WHERE type IN ('Auto', 'auto');
UPDATE Vehicle SET type = 'CAMIONETA' WHERE type IN ('Camioneta', 'camioneta');
UPDATE Vehicle SET type = 'CAMION' WHERE type IN ('Camión', 'camion', 'Camion');

-- 2i. model → year (el campo "model" siempre recibió años del dropdown YEARS)
-- Valores no numéricos quedan en NULL (correcto: preferimos NULL a basura en Int)
UPDATE Vehicle SET model = CAST(model AS UNSIGNED)
  WHERE model IS NOT NULL AND model REGEXP '^[0-9]+$';
UPDATE Vehicle SET model = NULL
  WHERE model IS NOT NULL AND NOT (model REGEXP '^[0-9]+$');

-- ═══════════════════════════════════════════════════════════════
-- PASO 3: VERIFICACIÓN POST-TRANSFORMACIÓN
-- ═══════════════════════════════════════════════════════════════
SELECT 'Verificar que los valores son correctos:' AS verification;
SELECT id, owner, type, carname, model AS year_value, km, entry, exit,
       cost_labor, cost_parts, status, source
FROM Vehicle LIMIT 10;

-- Verificar que no quedaron valores inválidos para los enums
SELECT 'status inválidos (debería ser 0):' AS check_enum;
SELECT COUNT(*) FROM Vehicle WHERE status NOT IN ('PENDIENTE', 'EN_REPARACION', 'LISTO');

SELECT 'source inválidos (debería ser 0):' AS check_enum;
SELECT COUNT(*) FROM Vehicle WHERE source NOT IN ('CLIENT', 'ADMIN');

SELECT 'type inválidos (debería ser 0):' AS check_enum;
SELECT COUNT(*) FROM Vehicle WHERE type NOT IN ('AUTO', 'CAMIONETA', 'CAMION');

-- ═══════════════════════════════════════════════════════════════
-- PASO 4: MIGRACIÓN PRISMA
-- ═══════════════════════════════════════════════════════════════
-- SOLO DESPUÉS de verificar PASO 3 (o si la DB tiene 0 registros):
--
-- cd backend
-- npx prisma migrate dev --name schema-v2
--
-- Si falla, NO usar --force-reset. Restaurar backup y revisar PASO 2.
