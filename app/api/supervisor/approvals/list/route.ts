import { NextResponse } from "next/server";

// TEST VERSION with mock approval data
export async function GET(req: Request) {
    try {
        console.log('[TEST_APPROVALS] Returning mock approval data');

        // Mock pending approvals for testing
        const mockApprovals = [
            {
                user_id: "emp001",
                employee: "John Smith",
                date: "2026-02-17",
                hours: 8.5,
                activities: 3,
                status: "pending",
                log_ids: [1, 2, 3],
                details: [
                    {
                        activity_name: "Development",
                        start_time: "09:00 AM",
                        end_time: "12:30 PM",
                        hours: "3.50",
                        is_billable: true
                    },
                    {
                        activity_name: "Meetings",
                        start_time: "01:00 PM",
                        end_time: "03:00 PM",
                        hours: "2.00",
                        is_billable: false
                    },
                    {
                        activity_name: "Code Review",
                        start_time: "03:00 PM",
                        end_time: "06:00 PM",
                        hours: "3.00",
                        is_billable: true
                    }
                ]
            },
            {
                user_id: "emp002",
                employee: "Sarah Johnson",
                date: "2026-02-17",
                hours: 7.0,
                activities: 2,
                status: "pending",
                log_ids: [4, 5],
                details: [
                    {
                        activity_name: "Testing",
                        start_time: "09:30 AM",
                        end_time: "01:00 PM",
                        hours: "3.50",
                        is_billable: true
                    },
                    {
                        activity_name: "Documentation",
                        start_time: "02:00 PM",
                        end_time: "05:30 PM",
                        hours: "3.50",
                        is_billable: false
                    }
                ]
            },
            {
                user_id: "emp003",
                employee: "Mike Davis",
                date: "2026-02-16",
                hours: 9.0,
                activities: 4,
                status: "pending",
                log_ids: [6, 7, 8, 9],
                details: [
                    {
                        activity_name: "Development",
                        start_time: "08:00 AM",
                        end_time: "11:00 AM",
                        hours: "3.00",
                        is_billable: true
                    },
                    {
                        activity_name: "Client Meeting",
                        start_time: "11:00 AM",
                        end_time: "12:00 PM",
                        hours: "1.00",
                        is_billable: true
                    },
                    {
                        activity_name: "Development",
                        start_time: "01:00 PM",
                        end_time: "04:30 PM",
                        hours: "3.50",
                        is_billable: true
                    },
                    {
                        activity_name: "Training",
                        start_time: "04:30 PM",
                        end_time: "06:00 PM",
                        hours: "1.50",
                        is_billable: false
                    }
                ]
            }
        ];

        return NextResponse.json(mockApprovals);

    } catch (error: any) {
        console.error("TEST_APPROVAL_LIST_ERROR:", error);
        return NextResponse.json(
            { message: "Failed to load test approvals" },
            { status: 500 }
        );
    }
}
