
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking Supervisors and their teams...");

    const supervisors = await prisma.d_tbluser.findMany({
        where: { role_id: 2 },
        select: { user_id: true, first_name: true, last_name: true, email: true }
    });

    console.log(`Found ${supervisors.length} supervisors.`);

    for (const sup of supervisors) {
        const reportCount = await prisma.d_tbluser.count({
            where: { supervisor_id: sup.user_id }
        });
        console.log(`Supervisor: ${sup.first_name} ${sup.last_name} (${sup.user_id}) - Reports: ${reportCount}`);

        if (reportCount > 0) {
            const reports = await prisma.d_tbluser.findMany({
                where: { supervisor_id: sup.user_id },
                select: { user_id: true, first_name: true, last_name: true }
            });
            console.log(`  -> Reports: ${reports.map(r => `${r.first_name} ${r.last_name}`).join(', ')}`);
        }
    }

    // Also check if there are any managers (role 3) or admins (role 4)
    const managers = await prisma.d_tbluser.findMany({ where: { role_id: { in: [3, 4] } } });
    console.log(`Found ${managers.length} Managers/Admins.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
