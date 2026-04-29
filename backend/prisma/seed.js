const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('demo123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'demo@fincouple.com' },
    update: {},
    create: {
      email: 'demo@fincouple.com',
      password,
      name: 'João',
      partnerName: 'Maria',
    },
  });

  console.log('Seed concluído. Usuário demo criado:', user.email);
  console.log('Email: demo@fincouple.com | Senha: demo123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
