import { NextResponse } from "next/server";

// TEST VERSION - Mock team status data
export async function GET(req: Request) {
    try {
        console.log('[TEST_TEAM_STATUS] Returning mock team status data');

        const mockTeamStatus = [
            {
                user_id: "emp001",
                name: "John Smith",
                email: "john.smith@company.com",
                department: "Engineering",
                team: "Frontend",
                position: "Senior Developer",
                status: "Working",
                hours_today: 6.5,
                current_activity: "Development",
                is_billable: true,
                clock_in_time: new Date(Date.now() - 6.5 * 60 * 60 * 1000).toISOString(),
                clock_out_time: null
            },
            {
                user_id: "emp002",
                name: "Sarah Johnson",
                email: "sarah.j@company.com",
                department: "Engineering",
                team: "Backend",
                position: "Developer",
                status: "Working",
                hours_today: 5.0,
                current_activity: "Code Review",
                is_billable: false,
                clock_in_time: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
                clock_out_time: null
            },
            {
                user_id: "emp003",
                name: "Mike Davis",
                email: "mike.d@company.com",
                department: "Engineering",
                team: "DevOps",
                position: "DevOps Engineer",
                status: "Working",
                hours_today: 7.5,
                current_activity: "Infrastructure Setup",
                is_billable: true,
                clock_in_time: new Date(Date.now() - 7.5 * 60 * 60 * 1000).toISOString(),
                clock_out_time: null
            },
            {
                user_id: "emp004",
                name: "Emily Brown",
                email: "emily.b@company.com",
                department: "Quality Assurance",
                team: "QA",
                position: "QA Tester",
                status: "Working",
                hours_today: 4.0,
                current_activity: "Testing",
                is_billable: true,
                clock_in_time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
                clock_out_time: null
            },
            {
                user_id: "emp005",
                name: "David Wilson",
                email: "david.w@company.com",
                department: "Engineering",
                team: "Frontend",
                position: "Junior Developer",
                status: "Working",
                hours_today: 3.5,
                current_activity: "Meetings",
                is_billable: false,
                clock_in_time: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
                clock_out_time: null
            },
            {
                user_id: "emp006",
                name: "Lisa Anderson",
                email: "lisa.a@company.com",
                department: "Design",
                team: "UX",
                position: "UI/UX Designer",
                status: "Clocked Out",
                hours_today: 8.0,
                current_activity: "—",
                is_billable: false,
                clock_in_time: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
                clock_out_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            },
            {
                user_id: "emp007",
                name: "Robert Taylor",
                email: "robert.t@company.com",
                department: "Engineering",
                team: "Backend",
                position: "Senior Developer",
                status: "Clocked Out",
                hours_today: 8.5,
                current_activity: "—",
                is_billable: false,
                clock_in_time: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
                clock_out_time: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString()
            },
            {
                user_id: "emp008",
                name: "Jessica Martinez",
                email: "jessica.m@company.com",
                department: "Product",
                team: "Product Management",
                position: "Product Manager",
                status: "Offline",
                hours_today: 0,
                current_activity: "—",
                is_billable: false,
                clock_in_time: null,
                clock_out_time: null
            }
        ];

        return NextResponse.json({ teamStatus: mockTeamStatus });

    } catch (error: any) {
        console.error("TEST_TEAM_STATUS_ERROR:", error);
        return NextResponse.json(
            { message: "Failed to load test team status" },
            { status: 500 }
        );
    }
}
