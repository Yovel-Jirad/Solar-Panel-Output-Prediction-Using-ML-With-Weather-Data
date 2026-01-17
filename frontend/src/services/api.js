const API_BASE_URL = 'https://solar-forcast-backend-632074917176.us-central1.run.app';

// Health check to wake up backend 
export const checkBackendHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/`, {
      method: 'GET',
    });
    const data = await response.json();
    return data.status === 'healthy';
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}; 

// Fetch predictions from backend
export const fetchPredictions = async () => {
  try {
    // First, wake up backend if it's sleeping
    console.log('Waking up backend...');
    await checkBackendHealth();
    
    console.log('Fetching predictions...');
    const response = await fetch(`${API_BASE_URL}/api/predict`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Prediction request failed');
    }

    return data.predictions;
  } catch (error) {
    console.error('Error fetching predictions:', error);
    throw error;
  }
};

// Process GRU data for charts (24 hours)
export const processGRUData = (gruForecast) => {
  const now = new Date();
  return gruForecast.map((power, index) => {
    const time = new Date(now.getTime() + index * 60 * 60 * 1000);
    return {
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      predictedPower: Math.max(0, power), // No negative values
      actualPower: Math.max(0, power + (Math.random() - 0.5) * 50) // Mock actual for comparison
    };
  });
};

// Process Autoformer data for daily summary (4 days)
export const processAutoformerData = (autoformerForecast) => {
  const predictions = [];
  const now = new Date();
  
  // Group by days (24 hours each)
  for (let day = 0; day < 4; day++) {
    const startIdx = day * 24;
    const endIdx = startIdx + 24;
    const dayData = autoformerForecast.slice(startIdx, endIdx);
    
    // Filter out zeros for average calculation (nighttime hours)
    const validPowers = dayData.filter(p => p > 0);
    const avgPower = validPowers.length > 0
      ? validPowers.reduce((sum, val) => sum + val, 0) / validPowers.length
      : 0;
    
    const date = new Date(now);
    date.setDate(date.getDate() + day + 1); // Start from tomorrow
    
    predictions.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      avgPower: avgPower,
      minPower: Math.min(...dayData.filter(p => p > 0), Infinity) === Infinity ? 0 : Math.min(...dayData.filter(p => p > 0)),
      maxPower: Math.max(...dayData)
    });
  }
  
  return predictions;
};

// Process Autoformer hourly data for detailed view
export const processAutoformerHourly = (autoformerForecast) => {
  const now = new Date();
  return autoformerForecast.map((power, index) => {
    const time = new Date(now.getTime() + index * 60 * 60 * 1000);
    return {
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      date: time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      predictedPower: Math.max(0, power)
    };
  });
};

export const fetchAnalytics = async () => {
  try {
    console.log('Fetching analytics...');
    const response = await fetch(`${API_BASE_URL}/api/analytics`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Analytics request failed');
    }

    return data;
  } catch (error) {
    console.error('Error fetching analytics:', error);
    throw error;
  }
};