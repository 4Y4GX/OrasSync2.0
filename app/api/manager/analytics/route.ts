import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET(request: Request) {
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

    // 1. Get ONLY employees in the department to calculate Target Hours
    // FIXED: Swapped hardcoded role_ids for a strict relational check on "Employee"
    const deptUsers = await prisma.d_tbluser.findMany({
      where: { 
        dept_id: deptId, 
        D_tblrole: {
          role_name: "Employee"
        } 
      },
      include: { D_tblteam: true }
    });
    
    const userIds = deptUsers.map(u => u.user_id);
    const employeeCount = userIds.length;
    
    const targetWeeklyHours = employeeCount * 40; 
    const targetDailyHours = employeeCount * 8; 

    // 2. Set Time boundaries based on URL parameter or current date
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const referenceDate = dateParam ? new Date(dateParam) : new Date();
    
    // Set to local midnight to avoid timezone drift
    referenceDate.setHours(0, 0, 0, 0); 
    
    // WEEK BOUNDARIES (Monday to Next Monday)
    const startOfWeek = new Date(referenceDate);
    const dayOfWeek = startOfWeek.getDay();
    const diffToMonday = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startOfWeek.setDate(diffToMonday);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    // MONTH BOUNDARIES (1st of this month to 1st of next month)
    const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const endOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);

    // 3. Fetch Time Logs (Only for strictly verified Employees)
    const weeklyLogs = await prisma.d_tbltime_log.findMany({
      where: { 
        user_id: { in: userIds }, 
        log_date: { gte: startOfWeek, lt: endOfWeek } 
      },
      include: {
        D_tblactivity: true,
        D_tbluser_D_tbltime_log_user_idToD_tbluser: {
            include: { D_tblteam: true }
        }
      }
    });

    const monthlyLogs = await prisma.d_tbltime_log.findMany({
      where: { 
        user_id: { in: userIds }, 
        log_date: { gte: startOfMonth, lt: endOfMonth } 
      },
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
          const logDay = new Date(l.log_date).getDay();
          const mapDay = logDay === 0 ? 6 : logDay - 1; 
          // Only map logs that belong to the exact target week
          const logDate = new Date(l.log_date);
          const diffTime = Math.abs(logDate.getTime() - startOfWeek.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          
          return mapDay === index && diffDays < 7;
      });
      const actual = dailyLogs.reduce((sum, log) => sum + (log.total_hours ? parseFloat(log.total_hours.toString()) : 0), 0);
      return {
          day: d,
          actual: actual,
          target: index < 5 ? targetDailyHours : 0
      };
    });

    // 6. Group Activities by Team
    const teamsMap: Record<string, any> = {};

    deptUsers.forEach(u => {
        const tName = u.D_tblteam?.team_name || 'Unassigned';
        if (!teamsMap[tName]) {
            teamsMap[tName] = { team_name: tName, projectsMap: {} };
        }
    });

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

    const teamsArray = Object.values(teamsMap).map(team => ({
        team_name: team.team_name,
        projects: Object.values(team.projectsMap).map((p: any, idx) => ({
            id: idx,
            name: p.name,
            hours: p.hours,
            progress: Math.min(Math.round((p.hours / 40) * 100), 100) 
        }))
    }));

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