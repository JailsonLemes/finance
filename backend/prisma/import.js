const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const dataPath = path.join(__dirname, 'import_data.json');
  const { incomes, expenses, investments } = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // Upsert user Jailson & Giovanna
  const password = await bcrypt.hash('fincouple2026', 10);
  const user = await prisma.user.upsert({
    where: { email: 'jailson@fincouple.com' },
    update: {},
    create: {
      email: 'jailson@fincouple.com',
      password,
      name: 'Jailson',
      partnerName: 'Giovanna',
    },
  });
  console.log(`Usuário: ${user.email} (id: ${user.id})`);

  // Clear previous imported data
  await prisma.income.deleteMany({ where: { userId: user.id } });
  await prisma.expense.deleteMany({ where: { userId: user.id } });
  await prisma.investment.deleteMany({ where: { userId: user.id } });

  // Import incomes
  let incomeCount = 0;
  for (const item of incomes) {
    await prisma.income.create({
      data: {
        userId: user.id,
        date: new Date(item.year, item.month - 1, 1),
        description: item.description,
        category: item.category,
        value: item.value,
        type: item.type,
        person: item.person,
      },
    });
    incomeCount++;
  }
  console.log(`✓ ${incomeCount} receitas importadas`);

  // Import expenses
  let expenseCount = 0;
  for (const item of expenses) {
    await prisma.expense.create({
      data: {
        userId: user.id,
        date: new Date(item.year, item.month - 1, 5),
        description: item.description,
        category: item.category,
        subcategory: item.subcategory || null,
        value: item.value,
        person: item.person,
        paymentMethod: item.paymentMethod,
      },
    });
    expenseCount++;
  }
  console.log(`✓ ${expenseCount} despesas importadas`);

  // Import investments
  let investCount = 0;
  for (const item of investments) {
    await prisma.investment.create({
      data: {
        userId: user.id,
        date: new Date(item.year, item.month - 1, 1),
        description: item.description,
        type: item.type,
        investedValue: item.value,
        currentValue: item.value,
        profitability: 0,
      },
    });
    investCount++;
  }
  console.log(`✓ ${investCount} investimentos importados`);

  // Create bills from fixed recurring expenses
  const fixedBills = [
    { description: 'Aluguel', value: 1000, category: 'Moradia', responsible: 'both' },
    { description: 'Água', value: 100, category: 'Moradia', responsible: 'both' },
    { description: 'Luz', value: 250, category: 'Moradia', responsible: 'both' },
    { description: 'Internet', value: 129.9, category: 'Moradia', responsible: 'both' },
    { description: 'Plano celular (casal)', value: 128.87, category: 'Moradia', responsible: 'both' },
    { description: 'Netflix', value: 59.9, category: 'Moradia', responsible: 'both' },
    { description: 'Psicóloga', value: 340, category: 'Saúde', responsible: 'partner2' },
    { description: 'Plano de Saúde', value: 347.99, category: 'Saúde', responsible: 'both' },
    { description: 'Empréstimo Jailson', value: 138, category: 'Financiamentos', responsible: 'partner1' },
    { description: 'Prestação Moto', value: 494.05, category: 'Transporte', responsible: 'both' },
    { description: 'Seguro Moto', value: 74.9, category: 'Transporte', responsible: 'both' },
    { description: 'Faculdade Jailson', value: 207.2, category: 'Pessoal', responsible: 'partner1' },
    { description: 'Chapecoense Jailson', value: 100, category: 'Pessoal', responsible: 'partner1' },
    { description: 'Assinaturas Disney+', value: 46.94, category: 'Pessoal', responsible: 'both' },
    { description: 'Youtube Premium', value: 53.9, category: 'Pessoal', responsible: 'both' },
    { description: 'Google GB', value: 9.99, category: 'Pessoal', responsible: 'both' },
    { description: 'Ar condicionado', value: 277, category: 'Pessoal', responsible: 'both' },
    { description: 'Inês', value: 120, category: 'Pessoal', responsible: 'both' },
    { description: 'Cosméticos Giovanna', value: 150, category: 'Pessoal', responsible: 'partner2' },
    { description: 'Chapecoense Giovanna', value: 100, category: 'Pessoal', responsible: 'partner2' },
    { description: 'Empréstimo celular Jailson', value: 180, category: 'Lazer', responsible: 'partner1' },
  ];

  await prisma.bill.deleteMany({ where: { userId: user.id } });

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let billCount = 0;
  for (const bill of fixedBills) {
    const dueDate = new Date(currentYear, currentMonth, 10);
    const isPast = dueDate < now;
    await prisma.bill.create({
      data: {
        userId: user.id,
        description: bill.description,
        value: bill.value,
        dueDate,
        category: bill.category,
        responsible: bill.responsible,
        recurrent: true,
        paid: false,
        status: isPast ? 'overdue' : 'pending',
      },
    });
    billCount++;
  }
  console.log(`✓ ${billCount} contas a pagar criadas (mês atual)`);

  // Planning for current month
  const planningData = [
    { category: 'Moradia', plannedValue: 2668.67 },
    { category: 'Saúde', plannedValue: 687.99 },
    { category: 'Financiamentos', plannedValue: 261.75 },
    { category: 'Transporte', plannedValue: 968.95 },
    { category: 'Pessoal', plannedValue: 1218.21 },
    { category: 'Lazer', plannedValue: 180 },
    { category: 'Alimentação', plannedValue: 1000 },
  ];

  await prisma.planning.deleteMany({ where: { userId: user.id, month: now.getMonth() + 1, year: currentYear } });

  for (const p of planningData) {
    await prisma.planning.upsert({
      where: { userId_month_year_category: { userId: user.id, month: now.getMonth() + 1, year: currentYear, category: p.category } },
      update: { plannedValue: p.plannedValue },
      create: { userId: user.id, month: now.getMonth() + 1, year: currentYear, ...p },
    });
  }
  console.log(`✓ Planejamento do mês atual configurado`);

  console.log('\n=== IMPORT CONCLUÍDO ===');
  console.log('Login: jailson@fincouple.com');
  console.log('Senha: fincouple2026');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
