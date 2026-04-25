#!/bin/bash
# =============================================================================
# SCRIPT: Resolver problemas de versionado DigiKawsay
# Ejecutar desde Git Bash en: C:\Users\Camilo Carvajalino\OneDrive\Proyectos\202604DigiKawsay - Cloudflare
# =============================================================================

set -e  # Detener si hay errores

PROJECT_DIR="C:/Users/Camilo Carvajalino/OneDrive/Proyectos/202604DigiKawsay - Cloudflare"
cd "$PROJECT_DIR"

echo "=================================================="
echo "  PASO 1: Limpiar git lock (si existe)"
echo "=================================================="
rm -f .git/index.lock
echo "OK - Lock eliminado (si existía)"

echo ""
echo "=================================================="
echo "  PASO 2: Configurar identidad git (ya guardada)"
echo "=================================================="
git config user.email "camilo.carvajalino@gmail.com"
git config user.name "Camilo Carvajalino"
echo "OK - Identidad configurada"

echo ""
echo "=================================================="
echo "  PASO 3: COMMIT 1 — .gitignore + untrack logs"
echo "=================================================="
# Los archivos ya fueron desindexados (git rm --cached) en el sandbox.
# Verificar que el .gitignore tiene los nuevos patrones:
grep -q "ag00_log.txt" .gitignore && echo "OK - .gitignore actualizado" || echo "ERROR - .gitignore no tiene los nuevos patrones"

# Re-hacer el git rm --cached por si el índice se perdió con el lock
git rm --cached ag00_log.txt ag00_log2.txt channel_log.txt channel_log2.txt \
    channel_log3.txt err.txt preproc_log.txt ps.txt pubsub_err.txt \
    pubsub_init_log.txt pubsub_logs.txt val_log_new.txt info.json 2>/dev/null || true

git add .gitignore
git commit -m "chore: exclude runtime logs from tracking, add .wrangler to .gitignore

- Untrack ag00_log, channel_log, pubsub_log, err, ps, preproc_log, val_log, info.json
- Add explicit patterns to .gitignore for all runtime-generated files
- Add .wrangler/ to .gitignore (local dev state only)"

echo "OK - Commit 1 realizado"

echo ""
echo "=================================================="
echo "  PASO 4: COMMIT 2 — Worker DigiKawsay (código)"
echo "=================================================="
git add src/worker-digikawsay/src/index.tsx
git add src/worker-digikawsay/src/ui.tsx
git add src/worker-digikawsay/wrangler.jsonc
git commit -m "feat(worker): multi-project dashboard, delete endpoints, TELEGRAM_BOT_USERNAME

- Dashboard and WoZ console now support multi-project selector via query param
- Add delete participant and delete project endpoints (with cascade)
- Add TELEGRAM_BOT_USERNAME to wrangler vars (used for magic link generation)
- Fix DashboardView and WozView to accept activeProjectId and botUsername props
- invite_url_template now uses dynamic bot username from env"

echo "OK - Commit 2 realizado"

echo ""
echo "=================================================="
echo "  PASO 5: COMMIT 3 — Transición Manuales V3.0→V4.0"
echo "=================================================="
# Staged: 6 deletes de V3.0 — Untracked: 6 archivos V4.0
git add Manuales/
git commit -m "docs(manuales): upgrade documentation from V3.0 to V4.0

- Remove Manuales V3.0 (00-05) — replaced by V4.0 series
- Add Manuales V4.0 (00-05) with updated project structure and Cloudflare native architecture"

echo "OK - Commit 3 realizado"

echo ""
echo "=================================================="
echo "  PASO 6: COMMIT 4 — Documentación agents y reqs"
echo "=================================================="
git add .agents/ AGENTS.md GEMINI.md README.md Requerimientos/ requirements.txt
# src/val-service/state.py solo tiene cambios CRLF, incluirlo limpia el repo
git add src/val-service/state.py infra/
git commit -m "chore: normalize line endings and update agent workflows/skills documentation

- Convert CRLF to LF across .agents/ rules, skills, workflows
- Update README, AGENTS.md, GEMINI.md with current architecture
- Sync Requerimientos JSON/TXT documents to latest version"

echo "OK - Commit 4 realizado"

echo ""
echo "=================================================="
echo "  PASO 7: Push rama actual a origin"
echo "=================================================="
git push origin claude/analyze-val-agent-TUzz5
echo "OK - Push de rama activa"

echo ""
echo "=================================================="
echo "  PASO 8: Merge rama activa a main y push"
echo "=================================================="
git checkout main
git merge --ff-only claude/analyze-val-agent-TUzz5
git push origin main
git checkout claude/analyze-val-agent-TUzz5
echo "OK - main actualizado con todos los commits"

echo ""
echo "=================================================="
echo "  PASO 9: Verificar estado git final"
echo "=================================================="
git log --oneline -8
git status

echo ""
echo "=================================================="
echo "  LISTO: Git al día. Siguiente paso: Cloudflare"
echo "  Ejecutar: resolver_cloudflare.sh"
echo "=================================================="
