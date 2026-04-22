#!/bin/bash
# =============================================================================
# SCRIPT: Deploy DigiKawsay a Cloudflare
# Ejecutar desde Git Bash en: src/worker-digikawsay
# REQUISITO: Tener wrangler autenticado (wrangler login) o CLOUDFLARE_API_TOKEN
# =============================================================================

set -e

PROJECT_DIR="C:/Users/Camilo Carvajalino/OneDrive/Proyectos/202604DigiKawsay - Cloudflare"
WORKER_DIR="$PROJECT_DIR/src/worker-digikawsay"

cd "$WORKER_DIR"
echo "Directorio: $(pwd)"

echo ""
echo "=================================================="
echo "  PASO 1: Verificar autenticación Wrangler"
echo "=================================================="
npx wrangler whoami
echo "OK - Autenticado en Cloudflare"

echo ""
echo "=================================================="
echo "  PASO 2: Aplicar migraciones D1 — 001_swarm_insights"
echo "=================================================="
npx wrangler d1 execute digikawsay-d1 \
  --file=../infra/migrations/001_swarm_insights.sql \
  --remote
echo "OK - Migración 001 aplicada"

echo ""
echo "=================================================="
echo "  PASO 3: Aplicar migraciones D1 — 002_flywheel_schema"
echo "=================================================="
npx wrangler d1 execute digikawsay-d1 \
  --file=../infra/migrations/002_flywheel_schema.sql \
  --remote
echo "OK - Migración 002 aplicada"

echo ""
echo "=================================================="
echo "  PASO 4: Inyectar secret TELEGRAM_BOT_USERNAME"
echo "  (Si pide input, escribe: VAL_Digi_bot  y presiona Enter)"
echo "=================================================="
echo "VAL_Digi_bot" | npx wrangler secret put TELEGRAM_BOT_USERNAME 2>/dev/null || \
  npx wrangler secret put TELEGRAM_BOT_USERNAME
echo "OK - Secret inyectado"

echo ""
echo "=================================================="
echo "  PASO 5: Deploy del worker a producción"
echo "=================================================="
npx wrangler deploy --minify
echo "OK - Worker desplegado"

echo ""
echo "=================================================="
echo "  PASO 6: Verificar deployment"
echo "=================================================="
npx wrangler deployments list --name worker-digikawsay 2>/dev/null | head -20

echo ""
echo "=================================================="
echo "  DEPLOY COMPLETADO"
echo "  Worker URL: https://worker-digikawsay.<TU_SUBDOMINIO>.workers.dev"
echo "  Admin panel: https://worker-digikawsay.<TU_SUBDOMINIO>.workers.dev/admin/lobby"
echo "=================================================="
