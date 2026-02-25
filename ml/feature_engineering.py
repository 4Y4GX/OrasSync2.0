"""
Feature Engineering Module for Smart Timesheet Pre-fill

This module extracts ML-ready features from raw timesheet data for the
Random Forest prediction model.

Author: Audrey (AI Team Lead)
Project: OrasSync 2.0
Date: February 18, 2026
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple


class TimesheetFeatureEngineer:
    """
    Extracts and engineers features from timesheet data for ML predictions.
    """
    
    def __init__(self):
        """Initialize the feature engineer."""
        self.feature_columns = [
            'day_of_week_encoded',
            'hour_of_day',
            'month',
            'is_month_end',
            'activity_frequency',
            'avg_duration',
            'duration_consistency',
            'recent_trend',
            'total_occurrences',
            'is_billable',
            'activity_id',
            'user_id_encoded'
        ]
    
    def extract_temporal_features(self, log_date: datetime, start_time: str = None) -> Dict:
        """
        Extract temporal features from a date.
        
        Args:
            log_date: Date of the timesheet entry
            start_time: Start time string (optional)
            
        Returns:
            Dictionary of temporal features
        """
        features = {
            'day_of_week_encoded': log_date.weekday(),  # 0=Monday, 6=Sunday
            'month': log_date.month,
            'is_month_end': 1 if log_date.day >= 25 else 0,
            'hour_of_day': 9  # Default to 9 AM
        }
        
        # Extract hour if start_time provided
        if start_time:
            try:
                parts = str(start_time).split()
                if len(parts) >= 4:
                    time_part = parts[4]
                    hour = int(time_part.split(':')[0])
                    features['hour_of_day'] = hour
            except:
                pass
        
        return features
    
    def calculate_activity_frequency(
        self, 
        activity_id: int, 
        day_of_week: int, 
        history_df: pd.DataFrame
    ) -> float:
        """
        Calculate how often an activity appears on a specific day of week.
        
        Args:
            activity_id: ID of the activity
            day_of_week: Day of week (0=Monday, 6=Sunday)
            history_df: Historical timesheet data
            
        Returns:
            Frequency score (0.0 to 1.0)
        """
        # Filter for this activity
        activity_history = history_df[history_df['activity_id'] == activity_id]
        
        # Count occurrences on this day of week
        same_day_history = activity_history[
            activity_history['log_date'].dt.dayofweek == day_of_week
        ]
        
        # Total days of this weekday in history
        total_days_of_week = len(history_df[
            history_df['log_date'].dt.dayofweek == day_of_week
        ])
        
        if total_days_of_week == 0:
            return 0.0
        
        frequency = len(same_day_history) / total_days_of_week
        return round(frequency, 4)
    
    def calculate_duration_consistency(
        self, 
        activity_id: int, 
        history_df: pd.DataFrame
    ) -> Tuple[float, float]:
        """
        Calculate average duration and consistency for an activity.
        
        Args:
            activity_id: ID of the activity
            history_df: Historical timesheet data
            
        Returns:
            Tuple of (avg_duration, duration_consistency)
        """
        activity_history = history_df[history_df['activity_id'] == activity_id]
        
        if len(activity_history) == 0:
            return 0.0, 0.0
        
        avg_duration = activity_history['total_hours'].mean()
        std_duration = activity_history['total_hours'].std()
        
        # Consistency = 1 - coefficient of variation
        if pd.notna(std_duration) and avg_duration > 0:
            consistency = 1 - (std_duration / avg_duration)
            consistency = max(0, min(1, consistency))  # Clip to [0, 1]
        else:
            consistency = 1.0 if len(activity_history) == 1 else 0.0
        
        return round(avg_duration, 4), round(consistency, 4)
    
    def calculate_recent_trend(
        self, 
        activity_id: int, 
        current_date: datetime, 
        history_df: pd.DataFrame
    ) -> float:
        """
        Calculate recent trend (increasing/decreasing occurrence rate).
        
        Args:
            activity_id: ID of the activity
            current_date: Current date
            history_df: Historical timesheet data
            
        Returns:
            Trend score (negative = decreasing, positive = increasing)
        """
        activity_history = history_df[history_df['activity_id'] == activity_id]
        
        week_ago = current_date - timedelta(days=7)
        
        recent_count = len(activity_history[activity_history['log_date'] >= week_ago])
        older_count = len(activity_history[activity_history['log_date'] < week_ago])
        
        if older_count == 0:
            return 0.0
        
        trend = (recent_count - older_count) / older_count
        return round(trend, 4)
    
    def extract_features(
        self, 
        user_id: str,
        activity_id: int,
        log_date: datetime,
        history_df: pd.DataFrame,
        user_id_mapping: Dict[str, int] = None,
        start_time: str = None
    ) -> Dict:
        """
        Extract all features for a single prediction.
        
        Args:
            user_id: User identifier
            activity_id: Activity identifier
            log_date: Date to predict for
            history_df: Historical timesheet data (must have 'log_date' as datetime)
            user_id_mapping: Mapping of user_id to encoded values
            start_time: Start time string (optional)
            
        Returns:
            Dictionary of all features
        """
        # Temporal features
        temporal = self.extract_temporal_features(log_date, start_time)
        
        # Pattern features
        day_of_week = temporal['day_of_week_encoded']
        activity_frequency = self.calculate_activity_frequency(
            activity_id, day_of_week, history_df
        )
        avg_duration, duration_consistency = self.calculate_duration_consistency(
            activity_id, history_df
        )
        recent_trend = self.calculate_recent_trend(activity_id, log_date, history_df)
        
        # Activity history
        total_occurrences = len(history_df[history_df['activity_id'] == activity_id])
        
        # Get is_billable from history
        activity_rows = history_df[history_df['activity_id'] == activity_id]
        is_billable = activity_rows['is_billable'].iloc[0] if len(activity_rows) > 0 else 0
        
        # Encode user_id
        user_id_encoded = 0
        if user_id_mapping and user_id in user_id_mapping:
            user_id_encoded = user_id_mapping[user_id]
        
        # Combine all features
        features = {
            **temporal,
            'activity_frequency': activity_frequency,
            'avg_duration': avg_duration,
            'duration_consistency': duration_consistency,
            'recent_trend': recent_trend,
            'total_occurrences': total_occurrences,
            'is_billable': int(is_billable),
            'activity_id': activity_id,
            'user_id_encoded': user_id_encoded
        }
        
        return features
    
    def extract_features_batch(
        self,
        predictions_df: pd.DataFrame,
        history_df: pd.DataFrame,
        user_id_mapping: Dict[str, int] = None
    ) -> pd.DataFrame:
        """
        Extract features for multiple predictions at once.
        
        Args:
            predictions_df: DataFrame with columns: user_id, activity_id, log_date
            history_df: Historical timesheet data
            user_id_mapping: Mapping of user_id to encoded values
            
        Returns:
            DataFrame with all features
        """
        features_list = []
        
        for _, row in predictions_df.iterrows():
            features = self.extract_features(
                user_id=row['user_id'],
                activity_id=row['activity_id'],
                log_date=row['log_date'],
                history_df=history_df,
                user_id_mapping=user_id_mapping,
                start_time=row.get('start_time', None)
            )
            features_list.append(features)
        
        return pd.DataFrame(features_list)