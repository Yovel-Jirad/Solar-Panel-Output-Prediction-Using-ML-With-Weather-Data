import React, { useState, useEffect } from 'react';
import { Line, Pie } from 'react-chartjs-2';
import { usePredictions } from '../contexts/PredictionContext';
import { fetchAnalytics } from '../services/api';
import '../components/ChartConfig';

function LongTermForecast() {
  const { 
    autoformerPredictions,      // Daily summary (4 days)
    autoformerRawForecast,      // Raw 96 hours
    loading, 
    error, 
    lastUpdate, 
    refreshData 
  } = usePredictions();
  
  const [numPanels, setNumPanels] = useState(1);
  const [daysToShow, setDaysToShow] = useState(4);
  const [selectedDay, setSelectedDay] = useState(1);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Fetch analytics on component mount
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setAnalyticsLoading(true);
        const data = await fetchAnalytics();
        setAnalytics(data.autoformer);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setAnalyticsLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  const processHourlyData = () => {
    if (!autoformerRawForecast || autoformerRawForecast.length === 0) {
      return [];
    }

    // Use lastUpdate time (when predictions were fetched)
    const baseTime = lastUpdate || new Date();
    const hourlyByDay = [];
    
    for (let day = 0; day < 4; day++) {
      const startIdx = day * 24;
      const endIdx = startIdx + 24;
      const dayHours = autoformerRawForecast.slice(startIdx, endIdx);
      
      // Create hourly data with actual future times from last update
      const hourlyData = dayHours.map((power, hourOffset) => {
        const globalHourOffset = startIdx + hourOffset; 
        const futureTime = new Date(baseTime.getTime() + (globalHourOffset + 1) * 60 * 60 * 1000);
        
        return {
          time: futureTime.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          }),
          fullDateTime: futureTime.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          predictedPower: Math.max(0, power)
        };
      });
      
      hourlyByDay.push(hourlyData);
    }
    
    return hourlyByDay;
  };

  const hourlyByDay = processHourlyData();

  // Calculate daily energy
  const calculateDailyEnergy = (day) => {
    return day.avgPower * 24;
  };

  // Filter predictions based on selected days
  const displayedPredictions = autoformerPredictions.slice(0, daysToShow);

  // Calculate statistics
  const totalEnergy = autoformerPredictions.length > 0
    ? autoformerPredictions.reduce((sum, day) => sum + calculateDailyEnergy(day), 0)
    : 0;

  const peakDay = autoformerPredictions.length > 0
    ? autoformerPredictions.reduce((max, day) => day.maxPower > max.maxPower ? day : max)
    : { date: 'N/A', maxPower: 0 };

  // Calculate statistics for displayed days
  const displayedTotalEnergy = displayedPredictions.reduce((sum, day) => sum + calculateDailyEnergy(day), 0);
  const displayedAvgPower = displayedPredictions.length > 0
    ? displayedPredictions.reduce((sum, day) => sum + day.avgPower, 0) / displayedPredictions.length
    : 0;
  const displayedPeakPower = displayedPredictions.length > 0
    ? Math.max(...displayedPredictions.map(day => day.maxPower))
    : 0;

  // Get hourly data for selected day
  const selectedDayHourly = hourlyByDay[selectedDay - 1] || [];

  // Define hour range labels
  const hourRanges = {
    1: "0-24 hours",
    2: "24-48 hours",
    3: "48-72 hours",
    4: "72-96 hours"
  };

  // Chart data
  const chartData = {
    labels: selectedDayHourly.map(h => h.time),
    datasets: [
      {
        label: 'Predicted Power (W)',
        data: selectedDayHourly.map(h => h.predictedPower * numPanels),
        borderColor: 'rgb(25, 135, 84)',
        backgroundColor: 'rgba(25, 135, 84, 0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `Hourly Forecast - ${hourRanges[selectedDay]}`
      },
      tooltip: {
        callbacks: {
          title: function(context) {
            const index = context[0].dataIndex;
            return selectedDayHourly[index]?.fullDateTime || context[0].label;
          },
          label: function(context) {
            return `Power: ${Math.round(context.parsed.y)}W`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Power (Watts)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time of Day'
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      }
    }
  };

  // Prepare pie chart data for success rate
  const pieChartData = analytics ? {
    labels: ['Success Rate', 'Error Rate'],
    datasets: [{
      data: [
        parseFloat(analytics['Success_Rate_%'].toFixed(2)),
        parseFloat((100 - analytics['Success_Rate_%']).toFixed(2))
      ],
      backgroundColor: [
        'rgba(25, 135, 84, 0.8)',
        'rgba(220, 53, 69, 0.8)'
      ],
      borderColor: [
        'rgb(25, 135, 84)',
        'rgb(220, 53, 69)'
      ],
      borderWidth: 2
    }]
  } : null;

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
      title: {
        display: true,
        text: 'Model Success Rate'
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.label}: ${context.parsed}%`;
          }
        }
      }
    }
  };

  if (loading && autoformerPredictions.length === 0) {
    return (
      <div className="long-term-forecast">
        <h2 className="mb-4">Long-Term Forecast (Autoformer Model)</h2>
        <div className="alert alert-info">
          <div className="spinner-border spinner-border-sm me-2" role="status"></div>
          Loading predictions... This may take 30-60 seconds.
        </div>
      </div>
    );
  }

  return (
    <div className="long-term-forecast">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Long-Term Forecast (Autoformer Model)</h2>
        <button 
          className="btn btn-primary" 
          onClick={refreshData}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
              Refreshing...
            </>
          ) : (
            '🔄 Refresh Data'
          )}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          {error}
          <button type="button" className="btn-close" onClick={() => {}}></button>
        </div>
      )}

      {lastUpdate && (
        <div className="alert alert-success">
          <strong>Last Updated:</strong> {lastUpdate.toLocaleTimeString()}
        </div>
      )}

      {/* Controls */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              <label className="form-label"><strong>Number of Solar Panels:</strong></label>
              <input 
                type="number" 
                className="form-control"
                value={numPanels}
                onChange={(e) => setNumPanels(Number(e.target.value))}
                min="1"
                max="100"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label"><strong>Display Time Frame (Table):</strong></label>
              <select 
                className="form-select"
                value={daysToShow}
                onChange={(e) => setDaysToShow(Number(e.target.value))}
              >
                <option value={1}>Next Day</option>
                <option value={2}>Next 2 Days</option>
                <option value={3}>Next 3 Days</option>
                <option value={4}>Next 4 Days (Full Forecast)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="card mb-4">
        <div className="card-header bg-success text-white">
          <h5 className="mb-0">📅 Daily Energy Production - Next {daysToShow} Day{daysToShow > 1 ? 's' : ''}</h5>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead className="table-success">
                <tr>
                  <th>Day</th>
                  <th>Avg Power (W)</th>
                  <th>Max Power (W)</th>
                  <th>Power per Panel (Wh)</th>
                  <th>Total Energy ({numPanels} panels)</th>
                </tr>
              </thead>
              <tbody>
                {displayedPredictions.map((prediction, index) => {
                  const dailyEnergy = calculateDailyEnergy(prediction);
                  return (
                    <tr key={index}>
                      <td><strong>Day {index + 1}</strong></td>
                      <td>{Math.round(prediction.avgPower)}W</td>
                      <td><strong style={{ color: '#198754' }}>{Math.round(prediction.maxPower)}W</strong></td>
                      <td>{Math.round(dailyEnergy)}Wh</td>
                      <td>
                        <strong style={{ color: '#0d6efd' }}>
                          {(dailyEnergy * numPanels / 1000).toFixed(2)}kWh
                        </strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="table-secondary">
                <tr>
                  <td><strong>Total ({daysToShow} day{daysToShow > 1 ? 's' : ''})</strong></td>
                  <td>
                    <strong>Avg: {Math.round(displayedAvgPower)}W</strong>
                  </td>
                  <td>
                    <strong style={{ color: '#198754' }}>Peak: {Math.round(displayedPeakPower)}W</strong>
                  </td>
                  <td>
                    <strong>
                      {Math.round(displayedTotalEnergy)}Wh
                    </strong>
                  </td>
                  <td>
                    <strong style={{ color: '#0d6efd' }}>
                      {(displayedTotalEnergy * numPanels / 1000).toFixed(2)}kWh
                    </strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="stat-card">
            <div className="stat-value">{numPanels}</div>
            <div className="stat-label">Solar Panels</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card">
            <div className="stat-value">
              {(totalEnergy * numPanels / 1000).toFixed(1)}kWh
            </div>
            <div className="stat-label">Total Production (4 days)</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card">
            <div className="stat-value">
              {Math.round(peakDay.maxPower * numPanels)}W
            </div>
            <div className="stat-label">
              Peak Day (Day {autoformerPredictions.indexOf(peakDay) + 1})
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Chart */}
      <div className="card mb-4">
        <div className="card-header bg-success text-white">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">📊 Hourly Breakdown by Day</h5>
            <div style={{ minWidth: '220px' }}>
              <select 
                className="form-select form-select-sm"
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value))}
                style={{ backgroundColor: 'white' }}
              >
                <option value={1}>0-24 hours ahead</option>
                <option value={2}>24-48 hours ahead</option>
                <option value={3}>48-72 hours ahead</option>
                <option value={4}>72-96 hours ahead</option>
              </select>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="chart-container" style={{ height: '400px' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
          
          {/* Time Range Info */}
          {selectedDayHourly.length > 0 && (
            <div className="alert alert-info mt-3 mb-0">
              <strong>📅 Time Range:</strong> {selectedDayHourly[0]?.fullDateTime} → {selectedDayHourly[selectedDayHourly.length - 1]?.fullDateTime}
            </div>
          )}
        </div>
      </div>

      {/* Analytics Section */}
      <div className="card mb-4">
        <div className="card-header bg-success text-white">
          <h5 className="mb-0">📈 Model Performance Analytics</h5>
        </div>
        <div className="card-body">
          {analyticsLoading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="mt-2">Loading analytics...</p>
            </div>
          ) : analytics ? (
            <div className="row align-items-center">
              <div className="col-md-6">
                <div style={{ height: '300px', position: 'relative' }}>
                  <Pie data={pieChartData} options={pieChartOptions} />
                </div>
              </div>
              <div className="col-md-6">
                <div className="text-center">
                  <h3 className="text-success mb-3">Model Accuracy Metrics</h3>
                  <div className="p-4 bg-light rounded">
                    <div className="mb-3">
                      <h4 className="text-success mb-2">
                        {analytics['Success_Rate_%'].toFixed(2)}%
                      </h4>
                      <p className="text-muted mb-0">Success Rate</p>
                    </div>
                    <hr />
                    <div>
                      <h4 className="text-info mb-2">
                        {analytics['Conditional_MAE'].toFixed(2)}W
                      </h4>
                      <p className="text-muted mb-0">Conditional MAE</p>
                      <small className="text-muted">Mean Absolute Error</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="alert alert-warning">
              Failed to load analytics data. Please try refreshing the page.
            </div>
          )}
        </div>
      </div>

      {/* Model Info */}
      <div className="card">
        <div className="card-header bg-success text-white">
          <h5 className="mb-0">ℹ️ About Autoformer Model</h5>
        </div>
        <div className="card-body">
          <p className="lead">
            The Autoformer is an advanced transformer architecture specifically designed for long-term time series forecasting with superior pattern recognition capabilities.
          </p>
          
          <div className="row">
            <div className="col-md-6">
              <h6 className="text-success">Key Features:</h6>
              <ul>
                <li><strong>Autocorrelation Mechanism:</strong> Replaces standard attention to identify recurring seasonal patterns</li>
                <li><strong>Series Decomposition:</strong> Separates trend and seasonal components for better accuracy</li>
                <li><strong>Multi-Scale Analysis:</strong> Captures both daily and yearly weather patterns</li>
                <li><strong>Direct Multi-Step Forecasting:</strong> Predicts all time-steps simultaneously (no error propagation)</li>
              </ul>
            </div>
            
            <div className="col-md-6">
              <h6 className="text-success">Model Specifications:</h6>
              <ul>
                <li><strong>Input Window:</strong> 14 days (336 hours) of historical weather data</li>
                <li><strong>Forecast Horizon:</strong> Next 4 days (96 hours)</li>
                <li><strong>Architecture:</strong> 4 encoder layers, 2 decoder layers</li>
                <li><strong>Attention Heads:</strong> 8 multi-head attention mechanisms</li>
              </ul>
            </div>
          </div>

          <div className="alert alert-light mt-3">
            <h6 className="text-success">Best Use Cases:</h6>
            <ul className="mb-0">
              <li><strong>Strategic Planning:</strong> Medium-term operational scheduling and resource allocation</li>
              <li><strong>Maintenance Scheduling:</strong> Plan maintenance during low-production periods</li>
              <li><strong>Energy Trading:</strong> Multi-day market participation and contract planning</li>
              <li><strong>Seasonal Analysis:</strong> Understanding long-term weather pattern impacts</li>
            </ul>
          </div>

          <div className="alert alert-info mt-3">
            <h6 className="text-primary">How It Works:</h6>
            <p className="mb-2">
              <strong>Autocorrelation:</strong> The model identifies time-delay similarities by measuring correlation between current data and time-shifted versions, focusing on the strongest recurring patterns.
            </p>
            <p className="mb-0">
              <strong>Decomposition:</strong> Separates long-term trends (gradual changes) from seasonal components (daily/yearly cycles) for more accurate multi-day predictions.
            </p>
          </div>

          <div className="alert alert-warning mt-3">
            <strong>⏰ Update Frequency:</strong> Predictions are automatically refreshed every hour with the latest weather data from the Israel Meteorological Service (IMS).
          </div>
        </div>
      </div>
    </div>
  );
}

export default LongTermForecast;