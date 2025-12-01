/**
 * Script to delete a user by phone number
 * Run: npx tsx scripts/deleteUser.ts
 */
import prisma from '../src/utils/prisma';

async function deleteUser() {
  const phoneNumbers = ['+251932123090', '0932123090', '251932123090', '932123090'];
  
  try {
    for (const phone of phoneNumbers) {
      const user = await prisma.user.findUnique({
        where: { phone },
        include: {
          patterns: true,
          transactions: true,
          simCards: true,
        },
      });

      if (user) {
        console.log(`\n🔍 Found user with phone: ${phone}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Username: ${user.username || 'N/A'}`);
        console.log(`   Email: ${user.email || 'N/A'}`);
        console.log(`   Patterns: ${user.patterns.length}`);
        console.log(`   Transactions: ${user.transactions.length}`);
        console.log(`   SIM Cards: ${user.simCards.length}`);

        // Delete related records first (cascade should handle this, but being explicit)
        await prisma.oTP.deleteMany({ where: { phone: user.phone! } });
        await prisma.pattern.deleteMany({ where: { userId: user.id } });
        await prisma.transaction.deleteMany({ where: { userId: user.id } });
        await prisma.simCard.deleteMany({ where: { userId: user.id } });
        await prisma.auditLog.deleteMany({ where: { userId: user.id } });
        await prisma.usageStats.deleteMany({ where: { userId: user.id } });

        // Delete the user
        await prisma.user.delete({
          where: { id: user.id },
        });

        console.log(`\n✅ User deleted successfully!`);
        return;
      }
    }

    console.log(`\n❌ No user found with phone numbers: ${phoneNumbers.join(', ')}`);
  } catch (error: any) {
    console.error(`\n❌ Error deleting user:`, error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteUser();

