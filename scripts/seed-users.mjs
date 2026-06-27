import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const users = [
  { name: 'Admin', username: 'admin', password: 'adminpassword123', role: 'admin' },
  { name: 'Sithum', username: 'sithum', password: 'sithumD', role: 'admin' },
  { name: 'Dumindu', username: 'dumindu', password: 'dunkudda', role: 'admin' },
  { name: 'Sahan', username: 'sahan', password: 'sahansessi', role: 'admin' },
];

async function seed() {
  console.log('Connecting to PostgreSQL...');

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { username: u.username } });
    if (!existing) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      await prisma.user.create({ data: { ...u, password: hashedPassword } });
      console.log(`Created user: ${u.username}`);
    } else {
      console.log(`User already exists: ${u.username}`);
    }
  }

  await prisma.$disconnect();
  console.log('Done.');
}

seed().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
