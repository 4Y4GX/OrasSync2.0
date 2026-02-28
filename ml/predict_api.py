"""
Python API wrapper for timesheet predictions.
Called by Next.js API route to generate ML predictions.
"""

import sys
import json
import pandas as pd
from datetime import datetime
from pathlib import Path

# Add ml folder to path
sys.path.insert(0, str(Path(__file__).parent))

from timesheet_predictor import TimesheetPredictor


def main():
    try:
        # Read input from command line argument
        input_data = json.loads(sys.argv[1])
        
        user_id = input_data['user_id']
        target_date = datetime.strptime(input_data['target_date'], '%Y-%m-%d')
        historical_data = input_data['historical_data']
        all_activities = input_data['all_activities']
        confidence_threshold = input_data.get('confidence_threshold', 0.5)
        
        # Convert historical data to DataFrame
        history_df = pd.DataFrame(historical_data)
        history_df['log_date'] = pd.to_datetime(history_df['log_date'])
        
        # Initialize predictor
        model_path = Path(__file__).parent / 'models' / 'random_forest_timesheet_predictor.pkl'
        predictor = TimesheetPredictor(model_path=str(model_path))
        
        # Generate predictions
        predictions = predictor.predict_daily_timesheet(
            user_id=user_id,
            target_date=target_date,
            all_activities=all_activities,
            history_df=history_df,
            confidence_threshold=confidence_threshold
        )
        
        # Output JSON to stdout
        print(json.dumps(predictions))
        
    except Exception as e:
        # Output error to stderr
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()