/**
 * Seed OCR Patterns
 * Script to seed predefined OCR patterns into the database
 * 
 * Usage: npx ts-node src/scripts/seedOCRPatterns.ts
 */

import prisma from '../utils/prisma';
import { predefinedOCRPatterns } from '../utils/ocrPatternDefinitions';
import { createOCRPattern } from '../utils/ocrPatternExtractor';

async function seedOCRPatterns() {
  console.log('🌱 Seeding OCR patterns...\n');

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const pattern of predefinedOCRPatterns) {
    try {
      // Check if pattern already exists
      const existing = await prisma.oCRPattern.findUnique({
        where: {
          institution_countryCode_name: {
            institution: pattern.institution,
            countryCode: pattern.countryCode,
            name: pattern.name,
          },
        },
      });

      if (existing) {
        console.log(`⏭️  Skipped: ${pattern.name} (already exists)`);
        skipped++;
        continue;
      }

      // Create pattern
      await createOCRPattern(pattern);
      console.log(`✅ Created: ${pattern.name} (${pattern.institution}, ${pattern.countryCode})`);
      created++;
    } catch (error: any) {
      console.error(`❌ Error creating ${pattern.name}:`, error.message);
      errors++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log('\n✨ Done!');
}

// Run if executed directly
if (require.main === module) {
  seedOCRPatterns()
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export default seedOCRPatterns;












