import { PrismaClient } from "@prisma/client";
import { carriers } from "../src/lib/seed-data";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear existing data
  await prisma.carrier.deleteMany();
  console.log("Cleared existing carriers.");

  // Insert all carriers
  for (const carrier of carriers) {
    await prisma.carrier.create({ data: carrier });
  }

  console.log(`Seeded ${carriers.length} carriers.`);

  // Print summary by category
  const categories = await prisma.carrier.groupBy({
    by: ["category"],
    _count: { id: true },
  });
  console.log("\nCarriers by category:");
  for (const cat of categories) {
    console.log(`  ${cat.category}: ${cat._count.id}`);
  }

  const publicCount = await prisma.carrier.count({ where: { isPubliclyTraded: true } });
  const privateCount = await prisma.carrier.count({ where: { isPubliclyTraded: false } });
  console.log(`\nPublic: ${publicCount}, Private/Mutual: ${privateCount}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
