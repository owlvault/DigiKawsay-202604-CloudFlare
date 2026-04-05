import os
import logging
from datetime import datetime, timedelta
from google.cloud import monitoring_v3
from google.cloud import billing_v1

logger = logging.getLogger(__name__)

class GCPMonitor:
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.client = monitoring_v3.MetricServiceClient()
        self.billing_client = billing_v1.CloudBillingClient()
        self.project_name = f"projects/{project_id}"

    def get_gemini_metrics(self, hours: int = 24):
        """
        Obtiene métricas de uso de la API de Gemini (Generative Language API).
        Retorna conteo de llamadas exitosas y errores.
        """
        now = datetime.utcnow()
        start_time = now - timedelta(hours=hours)

        interval = monitoring_v3.TimeInterval(
            {
                "end_time": {"seconds": int(now.timestamp())},
                "start_time": {"seconds": int(start_time.timestamp())},
            }
        )

        # Filtro para la API de Gemini
        # Nota: generativelanguage.googleapis.com es el servicio
        filter_base = (
            'resource.type="consumed_api" AND '
            'metric.type="serviceruntime.googleapis.com/api/request_count" AND '
            'resource.labels.service="generativelanguage.googleapis.com"'
        )

        results = {
            "success": 0,
            "quota_exceeded": 0,
            "other_errors": 0,
            "total": 0
        }

        try:
            # Consultar métricas agrupadas por código de respuesta
            # Codigos 2xx (Success), 429 (Quota exceeded), etc.
            request = monitoring_v3.ListTimeSeriesRequest(
                name=self.project_name,
                filter=filter_base,
                interval=interval,
                view=monitoring_v3.ListTimeSeriesRequest.TimeSeriesView.FULL,
            )

            results_ts = self.client.list_time_series(request=request)

            for ts in results_ts:
                status_code = ts.metric.labels.get("response_code", "unknown")
                count = sum(point.value.int64_value for point in ts.points)

                if status_code.startswith("2"):
                    results["success"] += count
                elif status_code == "429":
                    results["quota_exceeded"] += count
                else:
                    results["other_errors"] += count
                
                results["total"] += count

        except Exception as e:
            logger.error(f"Error recuperando métricas de Monitoring: {e}")
            return None

        return results

    def get_billing_info(self):
        """
        Recupera información básica de facturación.
        En el MVP, esto es una estimación basada en el estado de la cuenta.
        Nota: Obtener costos exactos por API requiere exportación a BigQuery, 
        pero aquí verificamos si la facturación está activa y el crédito consumido si es posible.
        """
        try:
            # Solo podemos ver si el proyecto está vinculado y activo
            billing_info = self.billing_client.get_project_billing_info(name=self.project_name)
            return {
                "billing_enabled": billing_info.billing_enabled,
                "billing_account": billing_info.billing_account_name.split("/")[-1] if billing_info.billing_enabled else "None",
            }
        except Exception as e:
            logger.error(f"Error recuperando info de billing: {e}")
            return {"billing_enabled": False, "error": str(e)}

    def get_system_health(self):
        """
        Mock de salud del sistema local (PubSub, DB).
        En producción esto consultaría healthchecks reales.
        """
        return {
            "pubsub_emulator": "Online" if os.getenv("PUBSUB_EMULATOR_HOST") else "GCP Native",
            "postgres_db": "Connected",
            "val_service": "Active",
            "last_heartbeat": datetime.utcnow().isoformat()
        }
