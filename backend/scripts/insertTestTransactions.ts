import prisma from '../src/utils/prisma';
import { extractPrefix } from '../src/utils/partialTxnIdMatcher';

/**
 * Insert test transactions for testing developer verification endpoint
 */
async function insertTestTransactions() {
  try {
    // Get admin user
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: { id: true, username: true, devApiKey: true },
    });

    if (!admin) {
      console.error('❌ Admin user not found. Please create admin user first.');
      process.exit(1);
    }

    console.log(`\n📋 Inserting test transactions for user: ${admin.username} (${admin.id})\n`);

    // Sample transactions with different scenarios
    const testTransactions = [
      {
        txnId: 'TXN123456789',
        amount: 5000.00,
        sender: '****1234',
        bank: 'Telebirr',
        sendFrom: 'Telebirr',
        sendTo: 'User Account',
      },
      {
        txnId: 'MOMO987654321',
        amount: 2500.50,
        sender: '****5678',
        bank: 'M-Pesa',
        sendFrom: 'M-Pesa',
        sendTo: 'User Account',
      },
      {
        txnId: 'CBETX20241201001',
        amount: 10000.00,
        sender: '****9012',
        bank: 'Commercial Bank',
        sendFrom: 'Commercial Bank',
        sendTo: 'User Account',
      },
      {
        txnId: 'AB123XYZ45',
        amount: 750.25,
        sender: '****3456',
        bank: 'Awash Bank',
        sendFrom: 'Awash Bank',
        sendTo: 'User Account',
      },
      {
        txnId: 'PAY20241201ABC',
        amount: 15000.00,
        sender: '****7890',
        bank: 'Dashen Bank',
        sendFrom: 'Dashen Bank',
        sendTo: 'User Account',
      },
    ];

    let inserted = 0;
    let skipped = 0;

    // Check if txnIdPrefix column exists
    const tableInfo = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Transaction' AND column_name = 'txnIdPrefix'
    `;
    const hasTxnIdPrefix = tableInfo.length > 0;

    for (const txn of testTransactions) {
      try {
        // Check if transaction already exists using raw SQL
        const existing = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Transaction" 
          WHERE "userId" = ${admin.id} AND "txnId" = ${txn.txnId}
          LIMIT 1
        `;

        if (existing.length > 0) {
          console.log(`⏭️  Skipped (already exists): ${txn.txnId}`);
          skipped++;
          continue;
        }

        // Extract prefix for partial matching
        const txnIdPrefix = extractPrefix(txn.txnId, 8);
        const now = new Date();

        // Insert using raw SQL - use only basic columns that definitely exist
        await prisma.$executeRaw`
          INSERT INTO "Transaction" ("id", "userId", "txnId", "amount", "sender", "bank", "receivedAt", "createdAt")
          VALUES (gen_random_uuid()::text, ${admin.id}, ${txn.txnId}, ${txn.amount}, ${txn.sender}, ${txn.bank}, ${now}, ${now})
          ON CONFLICT ("userId", "txnId") DO NOTHING
        `;

        console.log(`✅ Created: ${txn.txnId} - ${txn.amount} ${txn.bank}`);
        inserted++;
      } catch (error: any) {
        if (error.code === 'P2002' || error.message?.includes('duplicate')) {
          console.log(`⏭️  Skipped (duplicate): ${txn.txnId}`);
          skipped++;
        } else {
          console.error(`❌ Error creating ${txn.txnId}:`, error.message);
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Inserted: ${inserted}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`\n🔑 Developer API Key: ${admin.devApiKey}`);
    console.log(`\n🧪 Test the verification endpoint:`);
    console.log(`   curl "http://localhost:3000/api/verify?key=${admin.devApiKey}&txn=TXN123456789"`);
    console.log(`\n`);

  } catch (error: any) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  insertTestTransactions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

