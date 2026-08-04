// Seed file — populates the database with initial data
// Run with: npm run db:seed
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Admin User ─────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@zouqcafe.com' },
    update: {},
    create: {
      name: 'ZOCK Admin',
      email: 'admin@zouqcafe.com',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin: ${admin.email} (password: admin123)`);

  // ─── Categories ──────────────────────────────────────────────────────────────
  const categories = [
    { name: 'BBQ', sortOrder: 1 },
    { name: 'Fast Food', sortOrder: 2 },
    { name: 'Drinks', sortOrder: 3 },
    { name: 'Drink Corner', sortOrder: 4 }, // cigarettes, luzy, misc
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log('✅ Categories created');

  // ─── Sample Products ─────────────────────────────────────────────────────────
  const bbq = await prisma.category.findUnique({ where: { name: 'BBQ' } });
  const fastFood = await prisma.category.findUnique({ where: { name: 'Fast Food' } });
  const drinks = await prisma.category.findUnique({ where: { name: 'Drinks' } });
  const drinkCorner = await prisma.category.findUnique({ where: { name: 'Drink Corner' } });

  const products = [
    // BBQ
    { categoryId: bbq.id, name: 'Chicken Karahi (1kg)', description: 'Rich, spicy karahi cooked in desi ghee', price: 850, isAvailable: true },
    { categoryId: bbq.id, name: 'Mutton Karahi (1kg)', description: 'Tender mutton in aromatic spices', price: 1400, isAvailable: true },
    { categoryId: bbq.id, name: 'BBQ Platter (4 pcs)', description: 'Seekh kabab, boti, tikka, and naan', price: 950, isAvailable: true },
    // Fast Food
    { categoryId: fastFood.id, name: 'Zouq Special Burger', description: 'Double patty with special sauce', price: 350, isAvailable: true },
    { categoryId: fastFood.id, name: 'Crispy Fries (Large)', description: 'Golden crispy seasoned fries', price: 180, isAvailable: true },
    { categoryId: fastFood.id, name: 'Chicken Shawarma', description: 'Grilled chicken wrap with garlic sauce', price: 280, isAvailable: true },
    // Drinks
    { categoryId: drinks.id, name: 'Mango Lassi', description: 'Fresh mango blended with yogurt', price: 150, isAvailable: true },
    { categoryId: drinks.id, name: 'Soft Drink (500ml)', description: 'Pepsi, 7UP, or Dew', price: 80, isAvailable: true },
    // Drink Corner
    { categoryId: drinkCorner.id, name: 'Marlboro Red', description: 'Pack of 20', price: 600, isAvailable: true },
    { categoryId: drinkCorner.id, name: 'Luzy Energy Drink', description: '250ml can', price: 120, isAvailable: true },
  ];

  for (const product of products) {
    const existing = await prisma.product.findFirst({ where: { name: product.name } });
    if (!existing) {
      await prisma.product.create({ data: product });
    }
  }
  console.log('✅ Sample products created');

  // ─── Spin Prizes ──────────────────────────────────────────────────────────────
  const prizes = [
    { name: '10% Discount Coupon', description: 'Get 10% off your next order', weight: 40, color: '#FF6B6B', isActive: true },
    { name: 'Free Drink', description: 'Any soft drink on the house', weight: 30, color: '#4ECDC4', isActive: true },
    { name: 'Free Fries', description: 'Large crispy fries, on us', weight: 15, color: '#FFE66D', isActive: true },
    { name: 'Free Shawarma', description: 'A full shawarma wrap for free', weight: 8, color: '#A8E6CF', isActive: true },
    { name: '2kg Chicken Karahi', description: 'A full 2kg karahi — lucky you!', weight: 5, color: '#FF8B94', isActive: true },
    { name: 'Free Family Meal', description: 'Complete family meal for 4 people', weight: 2, color: '#C7B9FF', isActive: true },
  ];

  for (const prize of prizes) {
    const existing = await prisma.spinPrize.findFirst({ where: { name: prize.name } });
    if (!existing) {
      await prisma.spinPrize.create({ data: prize });
    }
  }
  console.log('✅ Spin prizes created');

  // ─── App Config ───────────────────────────────────────────────────────────────
  await prisma.appConfig.upsert({
    where: { key: 'daily_spin_limit' },
    update: {},
    create: { key: 'daily_spin_limit', value: '1' },
  });
  console.log('✅ App config: daily_spin_limit = 1');

  // ─── EasyPaisa Payment Number ─────────────────────────────────────────────
  await prisma.appConfig.upsert({
    where: { key: 'easypaisa_number' },
    update: { value: '03008356059' },
    create: { key: 'easypaisa_number', value: '03008356059' },
  });
  await prisma.appConfig.upsert({
    where: { key: 'easypaisa_account_name' },
    update: { value: 'ZOCK Cafe' },
    create: { key: 'easypaisa_account_name', value: 'ZOCK Cafe' },
  });
  console.log('✅ App config: easypaisa_number = 03008356059');

  // ─── Weekly Missions ──────────────────────────────────────────────────────────
  const missions = [
    {
      title: 'Item Starter',
      description: 'Buy any 3 items in a week and earn a Rs. 50 voucher!',
      type: 'ITEMS_BOUGHT',
      targetCount: 3,
      voucherAmount: 50,
      minOrderForVoucher: 1000,
      sortOrder: 1,
    },
    {
      title: 'Item Collector',
      description: 'Buy any 5 items in a week and earn a Rs. 80 voucher!',
      type: 'ITEMS_BOUGHT',
      targetCount: 5,
      voucherAmount: 80,
      minOrderForVoucher: 1000,
      sortOrder: 2,
    },
    {
      title: 'Big Shopper',
      description: 'Buy 100 items in a week and earn a Rs. 120 voucher!',
      type: 'ITEMS_BOUGHT',
      targetCount: 100,
      voucherAmount: 120,
      minOrderForVoucher: 1500,
      sortOrder: 3,
    },
    {
      title: 'Deal Hunter',
      description: 'Order 3 deals in a week and earn a Rs. 200 voucher!',
      type: 'DEALS_BOUGHT',
      targetCount: 3,
      voucherAmount: 200,
      minOrderForVoucher: 2000,
      sortOrder: 4,
    },
  ];

  for (const mission of missions) {
    const existing = await prisma.weeklyMission.findFirst({ where: { title: mission.title } });
    if (!existing) {
      await prisma.weeklyMission.create({ data: mission });
    }
  }
  console.log('✅ Weekly missions seeded');

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
