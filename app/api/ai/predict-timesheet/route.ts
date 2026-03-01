import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/ai/predict-timesheet
 * 
 * Predicts which activities should appear in a user's timesheet for a specific date
 * based on historical patterns using the trained Random Forest model.
 * 
 * @body user_id - User identifier (required)
 * @body target_date - Date to predict for in YYYY-MM-DD format (required)
 * @body confidence_threshold - Minimum confidence score (0.0-1.0, default: 0.5)
 * 
 * @returns List of predicted activities with confidence scores
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, target_date, confidence_threshold = 0.5 } = body;

    // Validation
    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    if (!target_date) {
      return NextResponse.json(
        { error: 'target_date is required' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(target_date)) {
      return NextResponse.json(
        { error: 'target_date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Get historical timesheet data (last 4 weeks)
    const fourWeeksAgo = new Date(target_date);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const historicalData = await prisma.d_tbltime_log.findMany({
      where: {
        user_id: user_id,
        log_date: {
          gte: fourWeeksAgo,
          lt: new Date(target_date),
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

    // Check if user has enough historical data
    if (historicalData.length < 5) {
      return NextResponse.json({
        success: false,
        message: 'Insufficient historical data for prediction (minimum 5 entries required)',
        predictions: [],
        meta: {
          user_id,
          target_date,
          historical_entries: historicalData.length,
          min_required: 5,
        },
      });
    }

    // Transform data for Python script
    const csvData = historicalData.map(row => ({
      tlog_id: row.tlog_id,
      user_id: row.user_id,
      activity_id: row.activity_id,
      activity_name: row.D_tblactivity?.activity_name || '',
      activity_code: row.D_tblactivity?.activity_code || '',
      is_billable: row.D_tblactivity?.is_billable ? 1 : 0,
      log_date: row.log_date?.toISOString().split('T')[0] || '',
      start_time: row.start_time,
      end_time: row.end_time,
      total_hours: row.total_hours,
    }));

    // Get all unique activities
    const allActivities = await prisma.d_tblactivity.findMany({
      select: {
        activity_id: true,
        activity_name: true,
        activity_code: true,
        is_billable: true,
      },
    });

    // Call Python prediction script
    const { spawn } = require('child_process');
    const path = require('path');

    const predictions = await new Promise<any[]>((resolve, reject) => {
      const pythonScript = path.join(process.cwd(), 'ml', 'predict_api.py');
      const python = spawn('python', [
        pythonScript,
        JSON.stringify({
          user_id,
          target_date,
          historical_data: csvData,
          all_activities: allActivities.map(a => a.activity_id),
          confidence_threshold,
        }),
      ]);

      let dataString = '';
      let errorString = '';

      python.stdout.on('data', (data: Buffer) => {
        dataString += data.toString();
      });

      python.stderr.on('data', (data: Buffer) => {
        errorString += data.toString();
      });

      python.on('close', (code: number) => {
        if (code !== 0) {
          console.error('Python script error:', errorString);
          reject(new Error(`Python script exited with code ${code}`));
        } else {
          try {
            const result = JSON.parse(dataString);
            resolve(result);
          } catch (error) {
            reject(new Error('Failed to parse Python output'));
          }
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Predictions generated successfully',
      predictions: predictions,
      meta: {
        user_id,
        target_date,
        historical_entries: historicalData.length,
        predicted_activities: predictions.length,
        confidence_threshold,
        model_version: '1.0',
      },
    });

  } catch (error: any) {
    console.error('Prediction error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate predictions',
        details: error.message
      },
      { status: 500 }
    );
  }
}