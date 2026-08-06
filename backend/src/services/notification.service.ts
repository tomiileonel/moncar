import { NotificationChannel, NotificationStatus, VehicleStatus } from '@prisma/client';
import { APP_URL, NOTIFICATION_WEBHOOK_URL } from '../config.js';
import { prisma } from '../lib/prisma.js';

type ReadyVehicle = {
  id: number;
  plate: string | null;
  carname: string;
  phone: string;
  status: VehicleStatus;
};

function createWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Sends a ready notification only on the PENDIENTE/EN_REPARACION -> LISTO
 * transition. Without a provider configured, it still records a pending
 * notification and exposes a WhatsApp deep link for manual sending.
 */
export async function notifyVehicleReady(vehicle: ReadyVehicle, previousStatus: VehicleStatus): Promise<void> {
  if (vehicle.status !== VehicleStatus.LISTO || previousStatus === VehicleStatus.LISTO) return;

  const plate = vehicle.plate || 'tu vehículo';
  const message = `Moncar: ${plate} (${vehicle.carname}) ya está listo para retirar. ${APP_URL}`;
  const channel = NOTIFICATION_WEBHOOK_URL ? NotificationChannel.WEBHOOK : NotificationChannel.WHATSAPP;
  let status: NotificationStatus = NotificationStatus.PENDING;
  let providerResponse = NOTIFICATION_WEBHOOK_URL
    ? null
    : `Envío manual disponible: ${createWhatsAppUrl(vehicle.phone, message)}`;
  let sentAt: Date | null = null;

  if (NOTIFICATION_WEBHOOK_URL) {
    try {
      const response = await fetch(NOTIFICATION_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'vehicle.ready',
          vehicleId: vehicle.id,
          plate: vehicle.plate,
          phone: vehicle.phone,
          message,
          whatsappUrl: createWhatsAppUrl(vehicle.phone, message),
        }),
        signal: AbortSignal.timeout(5_000),
      });
      status = response.ok ? NotificationStatus.SENT : NotificationStatus.FAILED;
      providerResponse = await response.text().catch(() => `HTTP ${response.status}`);
      if (response.ok) sentAt = new Date();
    } catch (error) {
      status = NotificationStatus.FAILED;
      providerResponse = error instanceof Error ? error.message : 'Error desconocido del proveedor';
    }
  }

  await prisma.notification.create({
    data: {
      vehicleId: vehicle.id,
      channel,
      status,
      recipient: vehicle.phone,
      message,
      providerResponse,
      sentAt,
    },
  });
}

export function vehicleWhatsAppUrl(vehicle: Pick<ReadyVehicle, 'phone' | 'plate' | 'carname'>): string {
  const message = `Moncar: ${vehicle.plate || 'tu vehículo'} (${vehicle.carname}) ya está listo para retirar.`;
  return createWhatsAppUrl(vehicle.phone, message);
}
