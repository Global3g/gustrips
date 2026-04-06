'use client';

import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, TrendingDown, Plane } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { listAlerts, deleteAlert, type Alert } from '@/lib/api/alerts';
import CreateAlertModal from '@/components/alerts/CreateAlertModal';

export default function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadAlerts = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const response = await listAlerts(user.uid);
      setAlerts(response.alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar alertas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [user]);

  const handleDelete = async (alertId: string) => {
    if (!confirm('¿Eliminar esta alerta?')) return;

    try {
      await deleteAlert(alertId);
      setAlerts(alerts.filter(a => a.id !== alertId));
    } catch (err) {
      alert('Error al eliminar alerta');
    }
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency === 'MXN' ? 'MXN' : 'USD',
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 p-3">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Alertas de Precios</h1>
              <p className="text-sm text-white/60">
                Te avisamos cuando los precios bajen
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowCreateModal(true)}
            icon={Plus}
          >
            Nueva Alerta
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent"></div>
          </div>
        )}

        {/* Empty State */}
        {!loading && alerts.length === 0 && (
          <EmptyState
            icon={Bell}
            title="No tienes alertas activas"
            description="Crea una alerta y te notificaremos cuando el precio baje"
          />
        )}

        {/* Alerts List */}
        {!loading && alerts.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-white/60">
              {alerts.length} alerta{alerts.length !== 1 ? 's' : ''} activa{alerts.length !== 1 ? 's' : ''}
            </p>

            <div className="grid gap-4">
              {alerts.map((alert) => (
                <Card key={alert.id}>
                  <div className="flex items-start justify-between gap-4">
                    {/* Alert Info */}
                    <div className="flex-1 space-y-3">
                      {/* Route */}
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-purple-500/10 p-2">
                          <Plane className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            {alert.origin} → {alert.destination}
                          </p>
                          <p className="text-sm text-white/60">
                            Creada el {formatDate(alert.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* Target Price */}
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-xs text-white/50">Precio objetivo</p>
                          <p className="text-xl font-bold text-purple-400">
                            {formatPrice(alert.targetPrice, alert.currency)}
                          </p>
                        </div>

                        {alert.lastChecked && (
                          <div className="text-xs text-white/50">
                            <p>Última revisión</p>
                            <p>{formatDate(alert.lastChecked)}</p>
                          </div>
                        )}

                        {alert.lastNotified && (
                          <div className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-400">
                            ✓ Notificado
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => handleDelete(alert.id)}
                        variant="ghost"
                        icon={Trash2}
                        className="text-red-400 hover:bg-red-500/10"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Info Card */}
        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-purple-400" />
              <p className="font-semibold text-white">¿Cómo funcionan las alertas?</p>
            </div>
            <ul className="space-y-2 text-sm text-white/80">
              <li>• Verificamos los precios cada hora automáticamente</li>
              <li>• Te enviamos un email cuando el precio está por debajo de tu objetivo</li>
              <li>• Solo recibirás una notificación cada 24 horas por alerta</li>
              <li>• Guardamos el histórico de precios para que veas las tendencias</li>
            </ul>
          </div>
        </Card>
      </div>

      {/* Create Alert Modal */}
      {showCreateModal && user && (
        <CreateAlertModal
          userId={user.uid}
          userEmail={user.email || ''}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadAlerts();
          }}
        />
      )}
    </div>
  );
}
