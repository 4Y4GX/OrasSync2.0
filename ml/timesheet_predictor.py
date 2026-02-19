"""
Timesheet Prediction Module for Smart Timesheet Pre-fill

This module loads the trained Random Forest model and makes predictions
on which activities should appear in a user's timesheet.

Author: Audrey (AI Team Lead)
Project: OrasSync 2.0
Date: February 18, 2026
"""

import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime

from feature_engineering import TimesheetFeatureEngineer


class TimesheetPredictor:
    """
    Predicts which activities should appear in a user's timesheet based on
    historical patterns using a trained Random Forest model.
    """
    
    def __init__(self, model_path: str = None):
        """
        Initialize the predictor with a trained model.
        
        Args:
            model_path: Path to the trained model .pkl file
        """
        if model_path is None:
            # Default to models folder in research repo
            model_path = Path(__file__).parent.parent / 'models' / 'random_forest_timesheet_predictor.pkl'
        
        self.model = self._load_model(model_path)
        self.feature_engineer = TimesheetFeatureEngineer()
        self.feature_columns = self.feature_engineer.feature_columns
    
    def _load_model(self, model_path):
        """
        Load the trained Random Forest model.
        
        Args:
            model_path: Path to the .pkl file
            
        Returns:
            Loaded model
        """
        try:
            model = joblib.load(model_path)
            print(f"✅ Model loaded successfully from {model_path}")
            return model
        except Exception as e:
            raise Exception(f"Failed to load model from {model_path}: {str(e)}")
    
    def predict_single(
        self,
        user_id: str,
        activity_id: int,
        log_date: datetime,
        history_df: pd.DataFrame,
        user_id_mapping: Dict[str, int] = None,
        start_time: str = None
    ) -> Tuple[int, float]:
        """
        Predict if a single activity should appear in timesheet.
        
        Args:
            user_id: User identifier
            activity_id: Activity identifier
            log_date: Date to predict for
            history_df: Historical timesheet data
            user_id_mapping: Mapping of user_id to encoded values
            start_time: Start time string (optional)
            
        Returns:
            Tuple of (prediction, probability)
            - prediction: 0 (don't predict) or 1 (predict)
            - probability: Confidence score (0.0 to 1.0)
        """
        # Extract features
        features = self.feature_engineer.extract_features(
            user_id=user_id,
            activity_id=activity_id,
            log_date=log_date,
            history_df=history_df,
            user_id_mapping=user_id_mapping,
            start_time=start_time
        )
        
        # Convert to DataFrame with correct column order
        features_df = pd.DataFrame([features])[self.feature_columns]
        
        # Make prediction
        prediction = self.model.predict(features_df)[0]
        probability = self.model.predict_proba(features_df)[0][1]  # Probability of class 1
        
        return int(prediction), float(probability)
    
    def predict_batch(
        self,
        predictions_df: pd.DataFrame,
        history_df: pd.DataFrame,
        user_id_mapping: Dict[str, int] = None
    ) -> pd.DataFrame:
        """
        Predict for multiple activities at once.
        
        Args:
            predictions_df: DataFrame with columns: user_id, activity_id, log_date
            history_df: Historical timesheet data
            user_id_mapping: Mapping of user_id to encoded values
            
        Returns:
            DataFrame with predictions and probabilities
        """
        # Extract features for all predictions
        features_df = self.feature_engineer.extract_features_batch(
            predictions_df=predictions_df,
            history_df=history_df,
            user_id_mapping=user_id_mapping
        )
        
        # Ensure correct column order
        features_df = features_df[self.feature_columns]
        
        # Make predictions
        predictions = self.model.predict(features_df)
        probabilities = self.model.predict_proba(features_df)[:, 1]
        
        # Combine with original data
        result_df = predictions_df.copy()
        result_df['should_predict'] = predictions
        result_df['confidence'] = probabilities
        
        return result_df
    
    def predict_daily_timesheet(
        self,
        user_id: str,
        target_date: datetime,
        all_activities: List[int],
        history_df: pd.DataFrame,
        user_id_mapping: Dict[str, int] = None,
        confidence_threshold: float = 0.5
    ) -> List[Dict]:
        """
        Predict which activities should appear in timesheet for a specific day.
        
        Args:
            user_id: User identifier
            target_date: Date to predict for
            all_activities: List of all possible activity IDs
            history_df: Historical timesheet data
            user_id_mapping: Mapping of user_id to encoded values
            confidence_threshold: Minimum confidence to include activity (default 0.5)
            
        Returns:
            List of predicted activities with metadata
        """
        predictions = []
        
        for activity_id in all_activities:
            prediction, probability = self.predict_single(
                user_id=user_id,
                activity_id=activity_id,
                log_date=target_date,
                history_df=history_df,
                user_id_mapping=user_id_mapping
            )
            
            # Only include if predicted AND confidence above threshold
            if prediction == 1 and probability >= confidence_threshold:
                # Get activity metadata from history
                activity_rows = history_df[history_df['activity_id'] == activity_id]
                
                if len(activity_rows) > 0:
                    activity_name = activity_rows['activity_name'].iloc[0]
                    activity_code = activity_rows['activity_code'].iloc[0]
                    is_billable = activity_rows['is_billable'].iloc[0]
                    avg_duration = activity_rows['total_hours'].mean()
                else:
                    activity_name = f"Activity {activity_id}"
                    activity_code = f"ACT{activity_id}"
                    is_billable = 0
                    avg_duration = 8.0
                
                predictions.append({
                    'activity_id': activity_id,
                    'activity_name': activity_name,
                    'activity_code': activity_code,
                    'is_billable': bool(is_billable),
                    'predicted_duration': round(avg_duration, 2),
                    'confidence': round(probability, 4),
                    'date': target_date.strftime('%Y-%m-%d')
                })
        
        # Sort by confidence (highest first)
        predictions.sort(key=lambda x: x['confidence'], reverse=True)
        
        return predictions
    
    def get_model_info(self) -> Dict:
        """
        Get information about the loaded model.
        
        Returns:
            Dictionary with model metadata
        """
        return {
            'model_type': type(self.model).__name__,
            'n_estimators': getattr(self.model, 'n_estimators', None),
            'max_depth': getattr(self.model, 'max_depth', None),
            'n_features': self.model.n_features_in_,
            'feature_names': self.feature_columns
        }


# Example usage
if __name__ == "__main__":
    # Load sample data
    history_df = pd.read_csv('../data/timesheet_data_export.csv')
    history_df['log_date'] = pd.to_datetime(history_df['log_date'])
    
    # Initialize predictor
    predictor = TimesheetPredictor()
    
    # Print model info
    print("Model Info:")
    print(predictor.get_model_info())
    
    # Make a sample prediction
    user_id = "1"
    activity_id = 1
    target_date = datetime(2026, 2, 19)  # Tomorrow
    
    prediction, probability = predictor.predict_single(
        user_id=user_id,
        activity_id=activity_id,
        log_date=target_date,
        history_df=history_df
    )
    
    print(f"\nPrediction for User {user_id}, Activity {activity_id} on {target_date.date()}:")
    print(f"Should Predict: {'Yes' if prediction == 1 else 'No'}")
    print(f"Confidence: {probability:.2%}")
    
    # Predict full daily timesheet
    all_activities = history_df['activity_id'].unique().tolist()
    daily_predictions = predictor.predict_daily_timesheet(
        user_id=user_id,
        target_date=target_date,
        all_activities=all_activities,
        history_df=history_df,
        confidence_threshold=0.5
    )
    
    print(f"\n📋 Predicted Timesheet for {target_date.date()}:")
    for pred in daily_predictions:
        print(f"  • {pred['activity_name']} ({pred['confidence']:.0%} confidence)")