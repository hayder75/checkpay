/**
 * Script to query patterns from database
 * Usage: npx ts-node scripts/query-patterns.ts [username]
 */

import prisma from '../src/utils/prisma';

async function queryPatterns(username?: string) {
  try {
    let user;
    
    if (username) {
      // Find user by username
      user = await prisma.user.findUnique({
        where: { username: username },
        select: { id: true, username: true, email: true, phone: true, country: true },
      });
      
      if (!user) {
        console.log(`User "${username}" not found. Showing all patterns...\n`);
        user = null;
      } else {
        console.log(`\n=== User: ${user.username} ===`);
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email || 'N/A'}`);
        console.log(`Phone: ${user.phone || 'N/A'}`);
        console.log(`Country: ${user.country || 'N/A'}\n`);
      }
    }

    // Query patterns
    const where = user ? { userId: user.id } : {};
    
    const patterns = await prisma.pattern.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            phone: true,
            country: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (patterns.length === 0) {
      console.log('No patterns found.');
      return;
    }

    console.log(`\n=== Found ${patterns.length} Pattern(s) ===\n`);

    patterns.forEach((pattern, index) => {
      console.log(`\n--- Pattern ${index + 1} ---`);
      console.log(`ID: ${pattern.id}`);
      console.log(`Name: ${pattern.name}`);
      console.log(`User: ${pattern.user.username || pattern.user.email || pattern.user.phone || 'N/A'}`);
      console.log(`Bank: ${pattern.bank || 'N/A'}`);
      console.log(`Currency: ${pattern.currency || 'N/A'}`);
      console.log(`Description: ${pattern.description || 'N/A'}`);
      console.log(`Created: ${pattern.createdAt}`);
      console.log(`\nRegex:`);
      console.log(pattern.regex);
      console.log(`\nExtract Fields:`);
      console.log(JSON.stringify(pattern.extractFields, null, 2));
      console.log(`\n--- End Pattern ${index + 1} ---\n`);
    });

  } catch (error) {
    console.error('Error querying patterns:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get username from command line args
const username = process.argv[2];
queryPatterns(username);



