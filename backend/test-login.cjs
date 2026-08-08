require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    const admin = await prisma.admin.findUnique({ where: { email: 'tomasleonelramon@gmail.com' } });
    if (!admin) {
      console.log('Admin no encontrado.');
      return;
    }
    const match = await bcrypt.compare('123456', admin.password);
    console.log('Password match:', match);
    if (!process.env.JWT_SECRET) throw new Error('No JWT_SECRET');
    const token = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET);
    console.log('Login OK, Token:', token.substring(0, 20) + '...');
  } catch (e) {
    console.error('Crash:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
