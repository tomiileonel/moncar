import { Prisma, StockMovementType } from '@prisma/client';

export interface VehiclePartInput {
  itemId: number;
  quantity: number;
  unitCost?: string | null;
}

export class InsufficientStockError extends Error {
  constructor(itemName: string) {
    super(`Stock insuficiente para ${itemName}`);
    this.name = 'InsufficientStockError';
  }
}

export class InventoryItemNotFoundError extends Error {
  constructor(itemId: number) {
    super(`El repuesto #${itemId} no existe`);
    this.name = 'InventoryItemNotFoundError';
  }
}

export class InventoryItemInactiveError extends Error {
  constructor(itemId: number) {
    super(`El repuesto #${itemId} está inactivo`);
    this.name = 'InventoryItemInactiveError';
  }
}

/**
 * Replaces the parts associated with a vehicle and applies only the delta to
 * inventory. Every stock change and line-item change runs in the caller's
 * Prisma transaction, so a partial consumption can never be committed.
 */
export async function replaceVehicleParts(
  tx: Prisma.TransactionClient,
  vehicleId: number,
  rawParts: VehiclePartInput[],
): Promise<void> {
  const requested = new Map<number, VehiclePartInput>();
  for (const part of rawParts) {
    const current = requested.get(part.itemId);
    requested.set(part.itemId, {
      itemId: part.itemId,
      quantity: (current?.quantity ?? 0) + part.quantity,
      unitCost: part.unitCost ?? current?.unitCost ?? null,
    });
  }

  const existing = await tx.vehiclePart.findMany({ where: { vehicleId } });
  const itemIds = [...new Set([...existing.map((part) => part.itemId), ...requested.keys()])];
  const items = itemIds.length
    ? await tx.inventoryItem.findMany({ where: { id: { in: itemIds } } })
    : [];
  const itemById = new Map(items.map((item) => [item.id, item]));

  for (const part of requested.values()) {
    const item = itemById.get(part.itemId);
    if (!item) throw new InventoryItemNotFoundError(part.itemId);
    if (!item.active) throw new InventoryItemInactiveError(part.itemId);
  }

  const currentByItem = new Map(existing.map((part) => [part.itemId, part]));
  const allItemIds = new Set([...currentByItem.keys(), ...requested.keys()]);

  for (const itemId of allItemIds) {
    const item = itemById.get(itemId);
    if (!item) throw new InventoryItemNotFoundError(itemId);

    const before = currentByItem.get(itemId)?.quantity ?? 0;
    const after = requested.get(itemId)?.quantity ?? 0;
    const delta = after - before;

    if (delta > 0) {
      const updated = await tx.inventoryItem.updateMany({
        where: { id: itemId, active: true, quantity: { gte: delta } },
        data: { quantity: { decrement: delta } },
      });
      if (updated.count !== 1) throw new InsufficientStockError(item.name);
      await tx.stockMovement.create({
        data: { itemId, vehicleId, type: StockMovementType.SALIDA, quantity: delta, note: 'Consumo en reparación' },
      });
    } else if (delta < 0) {
      const returned = Math.abs(delta);
      await tx.inventoryItem.update({ where: { id: itemId }, data: { quantity: { increment: returned } } });
      await tx.stockMovement.create({
        data: { itemId, vehicleId, type: StockMovementType.ENTRADA, quantity: returned, note: 'Devolución de reparación' },
      });
    }

    if (after === 0) {
      if (currentByItem.has(itemId)) {
        await tx.vehiclePart.delete({ where: { vehicleId_itemId: { vehicleId, itemId } } });
      }
      continue;
    }

    const part = requested.get(itemId)!;
    await tx.vehiclePart.upsert({
      where: { vehicleId_itemId: { vehicleId, itemId } },
      create: { vehicleId, itemId, quantity: after, unitCost: part.unitCost ?? null },
      update: { quantity: after, unitCost: part.unitCost ?? null },
    });
  }
}
