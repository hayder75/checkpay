import prisma from './prisma';

/**
 * Merge duplicate users that have the same phone or email
 * This script finds users with matching phone/email and merges them
 */
export async function mergeDuplicateUsers() {
  console.log('🔍 Searching for duplicate users...');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      phone: true,
      username: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${users.length} total users`);

  // Group users by phone or email
  const phoneMap = new Map<string, string[]>(); // phone -> [userIds]
  const emailMap = new Map<string, string[]>(); // email -> [userIds]

  for (const user of users) {
    if (user.phone) {
      const normalized = user.phone.trim();
      if (!phoneMap.has(normalized)) {
        phoneMap.set(normalized, []);
      }
      phoneMap.get(normalized)!.push(user.id);
    }
    if (user.email) {
      const normalized = user.email.trim().toLowerCase();
      if (!emailMap.has(normalized)) {
        emailMap.set(normalized, []);
      }
      emailMap.get(normalized)!.push(user.id);
    }
  }

  // Find duplicates
  const duplicatesToMerge: Array<{ keep: string; merge: string[]; reason: string }> = [];

  // Check phone duplicates
  for (const [phone, userIds] of phoneMap.entries()) {
    if (userIds.length > 1) {
      // Keep the oldest user, merge others
      const sorted = userIds.sort((a, b) => {
        const userA = users.find(u => u.id === a);
        const userB = users.find(u => u.id === b);
        return (userA?.createdAt.getTime() || 0) - (userB?.createdAt.getTime() || 0);
      });
      duplicatesToMerge.push({
        keep: sorted[0],
        merge: sorted.slice(1),
        reason: `Same phone: ${phone}`,
      });
    }
  }

  // Check email duplicates
  for (const [email, userIds] of emailMap.entries()) {
    if (userIds.length > 1) {
      // Keep the oldest user, merge others
      const sorted = userIds.sort((a, b) => {
        const userA = users.find(u => u.id === a);
        const userB = users.find(u => u.id === b);
        return (userA?.createdAt.getTime() || 0) - (userB?.createdAt.getTime() || 0);
      });
      duplicatesToMerge.push({
        keep: sorted[0],
        merge: sorted.slice(1),
        reason: `Same email: ${email}`,
      });
    }
  }

  // Also check if phone matches email (cross-reference)
  for (const user of users) {
    if (user.phone && emailMap.has(user.phone.trim().toLowerCase())) {
      const emailUserIds = emailMap.get(user.phone.trim().toLowerCase())!;
      if (!emailUserIds.includes(user.id)) {
        // Phone number matches an email - these should be merged
        const allIds = [user.id, ...emailUserIds];
        const sorted = allIds.sort((a, b) => {
          const userA = users.find(u => u.id === a);
          const userB = users.find(u => u.id === b);
          return (userA?.createdAt.getTime() || 0) - (userB?.createdAt.getTime() || 0);
        });
        duplicatesToMerge.push({
          keep: sorted[0],
          merge: sorted.slice(1),
          reason: `Phone ${user.phone} matches email`,
        });
      }
    }
    if (user.email && phoneMap.has(user.email.trim())) {
      const phoneUserIds = phoneMap.get(user.email.trim())!;
      if (!phoneUserIds.includes(user.id)) {
        // Email matches a phone number - these should be merged
        const allIds = [user.id, ...phoneUserIds];
        const sorted = allIds.sort((a, b) => {
          const userA = users.find(u => u.id === a);
          const userB = users.find(u => u.id === b);
          return (userA?.createdAt.getTime() || 0) - (userB?.createdAt.getTime() || 0);
        });
        duplicatesToMerge.push({
          keep: sorted[0],
          merge: sorted.slice(1),
          reason: `Email ${user.email} matches phone`,
        });
      }
    }
  }

  // Remove duplicates from the merge list (keep only unique merges)
  const uniqueMerges = new Map<string, Set<string>>();
  for (const dup of duplicatesToMerge) {
    const key = dup.keep;
    if (!uniqueMerges.has(key)) {
      uniqueMerges.set(key, new Set());
    }
    dup.merge.forEach(id => uniqueMerges.get(key)!.add(id));
  }

  console.log(`\n📊 Found ${uniqueMerges.size} sets of duplicates to merge`);

  if (uniqueMerges.size === 0) {
    console.log('✅ No duplicates found!');
    return;
  }

  // Perform merges
  for (const [keepId, mergeIds] of uniqueMerges.entries()) {
    const keepUser = users.find(u => u.id === keepId);
    const mergeUsers = Array.from(mergeIds).map(id => users.find(u => u.id === id)).filter(Boolean);

    console.log(`\n🔄 Merging ${mergeUsers.length} users into ${keepId.substring(0, 8)}...`);
    console.log(`   Keep: ${keepUser?.email || keepUser?.phone || keepUser?.username || 'N/A'}`);

    for (const mergeUser of mergeUsers) {
      if (!mergeUser) continue;
      console.log(`   Merge: ${mergeUser.email || mergeUser.phone || mergeUser.username || 'N/A'}`);

      // Update all related records to point to the kept user
      await prisma.pattern.updateMany({
        where: { userId: mergeUser.id },
        data: { userId: keepId },
      });

      await prisma.transaction.updateMany({
        where: { userId: mergeUser.id },
        data: { userId: keepId },
      });

      await prisma.auditLog.updateMany({
        where: { userId: mergeUser.id },
        data: { userId: keepId },
      });

      await prisma.simCard.updateMany({
        where: { userId: mergeUser.id },
        data: { userId: keepId },
      });

      await prisma.usageStats.updateMany({
        where: { userId: mergeUser.id },
        data: { userId: keepId },
      });

      // Merge user data (keep the most complete record)
      const updateData: any = {};
      if (mergeUser.email && !keepUser?.email) updateData.email = mergeUser.email;
      if (mergeUser.phone && !keepUser?.phone) updateData.phone = mergeUser.phone;
      if (mergeUser.username && !keepUser?.username) updateData.username = mergeUser.username;

      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
          where: { id: keepId },
          data: updateData,
        });
      }

      // Delete the duplicate user
      await prisma.user.delete({
        where: { id: mergeUser.id },
      });

      console.log(`   ✅ Merged and deleted ${mergeUser.id.substring(0, 8)}...`);
    }
  }

  console.log(`\n✅ Merge complete!`);
}

// Run if called directly
if (require.main === module) {
  mergeDuplicateUsers()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}



