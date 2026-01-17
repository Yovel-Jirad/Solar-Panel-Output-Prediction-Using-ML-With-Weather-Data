import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { fetchPredictions, processGRUData, processAutoformerData } from '../services/api';

const PredictionContext = createContext();

export const usePredictions = () => {
  const context = useContext(PredictionContext);
  if (!context) {
    throw new Error('usePredictions must be used within PredictionProvider');
  }
  return context;
};

const CACHE_KEYS = {
  GRU: 'solar_gru_predictions',
  AUTOFORMER: 'solar_autoformer_predictions',
  AUTOFORMER_RAW: 'solar_autoformer_raw',
  LAST_UPDATE: 'solar_last_update'
};

const CACHE_DURATION = 60 * 60 * 1000;

export const PredictionProvider = ({ children }) => {
  const [gruPredictions, setGruPredictions] = useState([]);
  const [autoformerPredictions, setAutoformerPredictions] = useState([]);
  const [autoformerRawForecast, setAutoformerRawForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadFromCache = useCallback(() => {
    try {
      const cachedLastUpdate = localStorage.getItem(CACHE_KEYS.LAST_UPDATE);
      
      if (!cachedLastUpdate) {
        return false;
      }

      const lastUpdateTime = new Date(cachedLastUpdate);
      const now = new Date();
      
      // Check if cache is still valid (less than 1 hour old)
      if (now - lastUpdateTime < CACHE_DURATION) {
        const cachedGRU = JSON.parse(localStorage.getItem(CACHE_KEYS.GRU));
        const cachedAutoformer = JSON.parse(localStorage.getItem(CACHE_KEYS.AUTOFORMER));
        const cachedAutoformerRaw = JSON.parse(localStorage.getItem(CACHE_KEYS.AUTOFORMER_RAW));

        if (cachedGRU && cachedAutoformer && cachedAutoformerRaw) {
          setGruPredictions(cachedGRU);
          setAutoformerPredictions(cachedAutoformer);
          setAutoformerRawForecast(cachedAutoformerRaw);
          setLastUpdate(lastUpdateTime);
          console.log('Loaded predictions from cache');
          return true;
        }
      } else {
        console.log('Cache expired, fetching fresh data');
      }
    } catch (err) {
      console.error('Error loading from cache:', err);
    }
    return false;
  }, []);

  const saveToCache = useCallback((gru, autoformer, autoformerRaw, updateTime) => {
    try {
      localStorage.setItem(CACHE_KEYS.GRU, JSON.stringify(gru));
      localStorage.setItem(CACHE_KEYS.AUTOFORMER, JSON.stringify(autoformer));
      localStorage.setItem(CACHE_KEYS.AUTOFORMER_RAW, JSON.stringify(autoformerRaw));
      localStorage.setItem(CACHE_KEYS.LAST_UPDATE, updateTime.toISOString());
      console.log('Saved predictions to cache');
    } catch (err) {
      console.error('Error saving to cache:', err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching predictions from backend...');
      const data = await fetchPredictions();
      
      // Process GRU data (24 hours)
      const processedGRU = processGRUData(data.gru.forecast);
      setGruPredictions(processedGRU);
      
      // Store RAW autoformer data (96 hours)
      setAutoformerRawForecast(data.autoformer.forecast);
      
      // Process Autoformer data for daily summary (4 days)
      const processedAutoformer = processAutoformerData(data.autoformer.forecast);
      setAutoformerPredictions(processedAutoformer);
      
      const updateTime = new Date();
      setLastUpdate(updateTime);
      
      saveToCache(processedGRU, processedAutoformer, data.autoformer.forecast, updateTime);
      
      console.log('Predictions updated successfully!');
      console.log('Raw autoformer forecast:', data.autoformer.forecast);
      console.log('Processed daily summary:', processedAutoformer);
      
    } catch (err) {
      setError('Failed to fetch predictions. Please try again.');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [saveToCache]);

  useEffect(() => {
    // Try to load from cache first
    const cacheLoaded = loadFromCache();
    
    if (cacheLoaded) {
      setLoading(false);
    } else {
      // No valid cache, fetch fresh data
      fetchData();
    }
    
    // Auto-refresh every hour
    const interval = setInterval(() => {
      console.log('Auto-refreshing predictions (hourly)...');
      fetchData();
    }, 60 * 60 * 1000); 
    
    return () => clearInterval(interval);
  }, [fetchData, loadFromCache]);

  const value = {
    gruPredictions,
    autoformerPredictions,
    autoformerRawForecast,
    loading,
    error,
    lastUpdate,
    refreshData: fetchData
  };

  return (
    <PredictionContext.Provider value={value}>
      {children}
    </PredictionContext.Provider>
  );
};