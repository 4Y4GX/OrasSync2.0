
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const supervisorId = 'an1';
    console.log(`Assigning members to supervisor ${supervisorId}...`);

    // Find users who are not the supervisor and not admins (role 1 usually employees)
    const employees = await prisma.d_tbluser.findMany({
        where: {
            NOT: { user_id: supervisorId },
            role_id: 1
        },
        take: 5
    });

    console.log(`Found ${employees.length} potential team members.`);

    for (const emp of employees) {
        await prisma.d_tbluser.update({
            where: { user_id: emp.user_id },
            data: { supervisor_id: supervisorId }
        });
        console.log(`Assigned ${emp.first_name} ${emp.last_name} to ${supervisorId}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
