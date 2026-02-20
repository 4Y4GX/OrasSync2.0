import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET() {
  const user = await getUserFromCookie();

  if (!user || (user.role_id !== 5 && user.role_id !== 4)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const managerData = await prisma.d_tbluser.findUnique({
      where: { user_id: user.user_id },
      select: { dept_id: true }
    });

    if (!managerData || !managerData.dept_id) {
      return NextResponse.json({ message: "Department not found" }, { status: 400 });
    }

    const deptId = managerData.dept_id;

    // 1. Get all employees in the department to calculate Target Hours
    const deptUsers = await prisma.d_tbluser.findMany({
      where: { dept_id: deptId, role_id: { in: [1, 4] } },
      include: { D_tblteam: true }
    });
    
    const userIds = deptUsers.map(u => u.user_id);
    const employeeCount = userIds.length;
    
    // Assuming a standard 40-hour work week and 8-hour work day per employee
    const targetWeeklyHours = employeeCount * 40; 
    const targetDailyHours = employeeCount * 8; 

    // 2. Set Time boundaries for This Week and This Month
    const today = new Date();
    
    const startOfWeek = new Date(today);
    const dayOfWeek = startOfWeek.getDay();
    const diffToMonday = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startOfWeek.setDate(diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // 3. Fetch Time Logs
    const weeklyLogs = await prisma.d_tbltime_log.findMany({
      where: { user_id: { in: userIds }, log_date: { gte: startOfWeek } },
      include: {
        D_tblactivity: true,
        D_tbluser_D_tbltime_log_user_idToD_tbluser: {
            include: { D_tblteam: true }
        }
      }
    });

    const monthlyLogs = await prisma.d_tbltime_log.findMany({
      where: { user_id: { in: userIds }, log_date: { gte: startOfMonth } },
      select: { total_hours: true }
    });

    // 4. Calculate Top Panel Metrics
    const weeklyHours = weeklyLogs.reduce((sum, log) => sum + (log.total_hours ? parseFloat(log.total_hours.toString()) : 0), 0);
    const monthlyHours = monthlyLogs.reduce((sum, log) => sum + (log.total_hours ? parseFloat(log.total_hours.toString()) : 0), 0);
    const weeklyPercentage = targetWeeklyHours > 0 ? (weeklyHours / targetWeeklyHours) * 100 : 0;

    // 5. Generate Weekly Bar Chart Data
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyChart = days.map((d, index) => {
      const dailyLogs = weeklyLogs.filter(l => {
          if (!l.log_date) return false;
          const logDay = new Date(l.log_date).getDay(); // 0 = Sun, 1 = Mon...
          const mapDay = logDay === 0 ? 6 : logDay - 1; // Remap so 0 = Mon... 6 = Sun
          return mapDay === index;
      });
      const actual = dailyLogs.reduce((sum, log) => sum + (log.total_hours ? parseFloat(log.total_hours.toString()) : 0), 0);
      return {
          day: d,
          actual: actual,
          target: index < 5 ? targetDailyHours : 0 // Mon-Fri has targets, Weekends = 0
      };
    });

    // 6. Group Activities by Team (Functioning as "Projects")
    const teamsMap: Record<string, any> = {};

    // Pre-fill teams that exist in the dept (so empty tabs show up as "No Project")
    deptUsers.forEach(u => {
        const tName = u.D_tblteam?.team_name || 'Unassigned';
        if (!teamsMap[tName]) {
            teamsMap[tName] = { team_name: tName, projectsMap: {} };
        }
    });

    // Add logged hours to respective team and activity
    weeklyLogs.forEach(log => {
        const user = log.D_tbluser_D_tbltime_log_user_idToD_tbluser;
        const teamName = user?.D_tblteam?.team_name || 'Unassigned';
        const actName = log.D_tblactivity?.activity_name || 'General Task';
        const hours = log.total_hours ? parseFloat(log.total_hours.toString()) : 0;

        if (!teamsMap[teamName].projectsMap[actName]) {
            teamsMap[teamName].projectsMap[actName] = { name: actName, hours: 0 };
        }
        teamsMap[teamName].projectsMap[actName].hours += hours;
    });

    // Format for frontend
    const teamsArray = Object.values(teamsMap).map(team => ({
        team_name: team.team_name,
        projects: Object.values(team.projectsMap).map((p: any, idx) => ({
            id: idx,
            name: p.name,
            hours: p.hours,
            // Mock progress visual based on a 40 hour milestone
            progress: Math.min(Math.round((p.hours / 40) * 100), 100) 
        }))
    }));

    // Sort alphabetically
    teamsArray.sort((a, b) => a.team_name.localeCompare(b.team_name));

    return NextResponse.json({
      weeklyHours,
      monthlyHours,
      targetWeeklyHours,
      weeklyPercentage,
      weeklyChart,
      teams: teamsArray
    });

  } catch (error) {
    console.error("Analytics Fetch Error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}