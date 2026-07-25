require('dotenv').config();
const prisma = require('./src/config/prisma');

async function test() {
  try {
    const user = await prisma.user.findFirst({ 
      where: { role: 'ADMIN' }, 
      select: { id: true, email: true, role: true } 
    });
    console.log('Admin user:', JSON.stringify(user));

    // Test if PromoUsage table exists
    const count = await prisma.promoUsage.count();
    console.log('PromoUsage count:', count);

    // Test if Order has discountAmount
    const order = await prisma.order.findFirst({ 
      select: { id: true, discountAmount: true, promoCode: true } 
    });
    console.log('Sample order:', JSON.stringify(order));

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
