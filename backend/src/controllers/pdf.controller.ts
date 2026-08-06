import type { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export async function vehiclePdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vehicleId = Number.parseInt(req.params.id as string, 10);
    if (Number.isNaN(vehicleId)) {
      res.status(400).json({ error: 'Identificador de vehículo inválido' });
      return;
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, deleted: false },
      include: { parts: { include: { item: true } } },
    });
    if (!vehicle) {
      res.status(404).json({ error: 'Vehículo no encontrado' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="moncar-${vehicle.id}.pdf"`);

    const doc = new PDFDocument({ margin: 48 });
    doc.pipe(res);
    doc.fontSize(24).fillColor('#b8860b').text('MONCAR');
    doc.moveDown(0.25).fontSize(11).fillColor('#333333').text('Comprobante de servicio');
    doc.moveDown();
    doc.fontSize(12).text(`Vehículo: ${vehicle.plate || 'Sin patente'} — ${vehicle.carname}`);
    doc.text(`Propietario: ${vehicle.owner}`);
    doc.text(`Teléfono: ${vehicle.phone}`);
    doc.text(`Estado: ${vehicle.status}`);
    doc.text(`Ingreso: ${vehicle.entry.toLocaleDateString('es-AR')}`);
    if (vehicle.exit) doc.text(`Salida: ${vehicle.exit.toLocaleDateString('es-AR')}`);
    doc.moveDown();
    doc.fontSize(11).text('Problema / descripción:', { underline: true });
    doc.text(vehicle.problem);
    doc.moveDown();
    doc.fontSize(12).text(`Mano de obra: $ ${vehicle.cost_labor?.toFixed(2) ?? '0.00'}`);
    doc.text(`Repuestos: $ ${vehicle.cost_parts?.toFixed(2) ?? '0.00'}`);
    const total = (vehicle.cost_labor ?? new Prisma.Decimal(0)).plus(vehicle.cost_parts ?? new Prisma.Decimal(0));
    doc.font('Helvetica-Bold').fontSize(14).text(`Total: $ ${total.toFixed(2)}`);
    doc.font('Helvetica');

    if (vehicle.parts.length) {
      doc.moveDown();
      doc.fontSize(11).text('Repuestos utilizados:', { underline: true });
      for (const part of vehicle.parts) {
        doc.text(`• ${part.item.name}: ${part.quantity} ${part.item.unit}`);
      }
    }
    doc.moveDown(2).fontSize(9).fillColor('#666666').text('Documento informativo. No constituye factura fiscal.');
    doc.end();
  } catch (error) {
    next(error);
  }
}
