
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const supervisorId = 'an1';
    console.log(`Unassigning members from supervisor ${supervisorId}...`);

    const result = await prisma.d_tbluser.updateMany({
        where: { supervisor_id: supervisorId },
        data: { supervisor_id: null }
    });

    console.log(`Unassigned ${result.count} users.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
