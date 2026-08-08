require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

(async () => {
  try {
    const hashedPassword = await bcrypt.hash('123456', 10);
    const admin = await prisma.admin.create({
      data: {
        name: 'Leonel Ramón',
        email: 'tomasleonelramon@gmail.com',
        password: hashedPassword,
        role: 'OWNER'
      }
    });
    console.log('Admin creado:', admin.email);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
