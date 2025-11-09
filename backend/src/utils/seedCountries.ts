/**
 * Seed initial country data to database
 */
import prisma from './prisma';
import { countryTemplates } from './countryTemplates';

export async function seedCountries() {
  console.log('🌍 Seeding countries...');

  for (const template of countryTemplates) {
    try {
      await prisma.country.upsert({
        where: { code: template.code },
        update: {
          name: template.name,
          banks: template.banks,
          currencies: template.currencies,
          commonPhrases: template.commonPhrases,
          isActive: true,
        },
        create: {
          code: template.code,
          name: template.name,
          banks: template.banks,
          currencies: template.currencies,
          commonPhrases: template.commonPhrases,
          isActive: true,
        },
      });
      console.log(`✅ Seeded: ${template.name} (${template.code})`);
    } catch (error) {
      console.error(`❌ Error seeding ${template.name}:`, error);
    }
  }

  console.log('✅ Countries seeded successfully!');
}

// Run if called directly
if (require.main === module) {
  seedCountries()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}



