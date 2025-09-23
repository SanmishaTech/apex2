// Check how many assets exist in the database
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    const count = await prisma.asset.count();
    console.log(`Total assets in database: ${count}`);
    
    if (count > 0) {
      const assets = await prisma.asset.findMany({
        take: 10,
        include: {
          assetGroup: true,
          assetCategory: true,
        },
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('\nFirst 10 assets:');
      assets.forEach((asset, i) => {
        console.log(`${i + 1}. ${asset.assetNo} - ${asset.assetName} (Group: ${asset.assetGroup?.assetGroup}, Category: ${asset.assetCategory?.category})`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
