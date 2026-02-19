import { NextResponse } from "next/server";

// TEST VERSION with mock data for demonstration
export async function GET(req: Request) {
    try {
        // Get weekOffset from query parameters
        const { searchParams } = new URL(req.url);
        const weekOffset = parseInt(searchParams.get('weekOffset') || '0', 10);

        console.log('[TEST_SUPERVISOR_STATS] WeekOffset:', weekOffset);

        // Mock data for testing
        const totalMembers = 8;
        const activeClocks = 5;
        const totalHours = 38.5;
        const offlineCount = 3;

        // Generate mock graph data for 7 days
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const graphData = [];

        // Calculate start of the target week based on offset
        const startOfTargetWeek = new Date();
        startOfTargetWeek.setDate(startOfTargetWeek.getDate() - startOfTargetWeek.getDay() + (weekOffset * 7));
        startOfTargetWeek.setHours(0, 0, 0, 0);

        console.log('[TEST_SUPERVISOR_STATS] Week start:', startOfTargetWeek.toISOString());

        // Mock hours for each day (realistic pattern)
        const mockHoursPattern = [
            12.5,  // Sunday - low
            42.0,  // Monday - high
            38.5,  // Tuesday - normal
            35.0,  // Wednesday - normal
            40.5,  // Thursday - normal
            36.0,  // Friday - normal
            8.0    // Saturday - low
        ];

        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfTargetWeek);
            d.setDate(d.getDate() + i);

            const dayIndex = d.getDay();
            const dailyTotal = mockHoursPattern[i];
            
            // Calculate percentage (8 hours per person = 100%)
            let percentage = 0;
            if (dailyTotal > 0) {
                percentage = Math.min(100, Math.max(5, (dailyTotal / (totalMembers * 8)) * 100));
            }
            
            console.log(`[TEST_SUPERVISOR_STATS] ${days[dayIndex]}: ${dailyTotal}h (${percentage.toFixed(1)}%)`);
            
            graphData.push({
                day: days[dayIndex],
                hours: dailyTotal.toFixed(1),
                percentage: percentage
            });
        }

        // Mock weekly performance
        const weeklyTotal = mockHoursPattern.reduce((a, b) => a + b, 0);
        const avgPerPerson = (weeklyTotal / totalMembers).toFixed(1);
        const productivity = Math.min(100, (weeklyTotal / (totalMembers * 40) * 100)).toFixed(0);

        console.log('[TEST_SUPERVISOR_STATS] Weekly total:', weeklyTotal);

        const response = {
            totalMembers,
            currentlyWorking: activeClocks,
            totalHours: totalHours.toFixed(1),
            offline: offlineCount,
            graphData,
            teamPerformance: {
                weeklyTotal: weeklyTotal.toFixed(1),
                avgPerPerson,
                productivity: `${productivity}%`
            }
        };

        console.log('[TEST_SUPERVISOR_STATS] Response:', JSON.stringify(response, null, 2));

        return NextResponse.json(response);

    } catch (error: any) {
        console.error("TEST_SUPERVISOR_STATS_ERROR:", error);
        console.error("Stack:", error.stack);
        return NextResponse.json(
            { message: "Failed to fetch test stats", error: error.message },
            { status: 500 }
        );
    }
}
