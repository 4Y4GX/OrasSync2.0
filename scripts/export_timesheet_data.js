// scripts/export_timesheet_data.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportTimesheetData() {
  try {
    console.log('📊 Exporting timesheet data for ML research...');
    
    // Get last 4 weeks of data
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const data = await prisma.d_tbltime_log.findMany({
      where: {
        log_date: {
          gte: fourWeeksAgo,
        },
        total_hours: { not: null },
      },
      select: {
        tlog_id: true,
        user_id: true,
        activity_id: true,
        log_date: true,
        start_time: true,
        end_time: true,
        total_hours: true,
        D_tblactivity: {
          select: {
            activity_name: true,
            activity_code: true,
            is_billable: true,
          },
        },
      },
      orderBy: {
        log_date: 'asc',
      },
    });
    
    console.log(`✅ Found ${data.length} timesheet entries`);
    
    if (data.length === 0) {
      console.log('⚠️ No data found in the last 4 weeks');
      return;
    }
    
    // Convert to CSV format
    const csv = convertToCSV(data);
    
    // Save to file
    const outputPath = path.join(__dirname, '../../timesync-ai-research/data/timesheet_data_export.csv');
    fs.writeFileSync(outputPath, csv);
    
    console.log(`✅ Data exported to: ${outputPath}`);
    console.log(`📈 Ready for ML analysis!`);
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function convertToCSV(data) {
  if (data.length === 0) return '';
  
  // CSV header
  const headers = [
    'tlog_id',
    'user_id',
    'activity_id',
    'activity_name',
    'activity_code',
    'is_billable',
    'log_date',
    'start_time',
    'end_time',
    'total_hours'
  ];
  
  let csv = headers.join(',') + '\n';
  
  // CSV rows
  data.forEach(row => {
    const values = [
      row.tlog_id,
      `"${row.user_id}"`,
      row.activity_id,
      `"${row.D_tblactivity?.activity_name || ''}"`,
      `"${row.D_tblactivity?.activity_code || ''}"`,
      row.D_tblactivity?.is_billable ? 1 : 0,
      row.log_date.toISOString().split('T')[0],
      `"${row.start_time}"`,
      `"${row.end_time}"`,
      row.total_hours,
    ];
    csv += values.join(',') + '\n';
  });
  
  return csv;
}

exportTimesheetData();