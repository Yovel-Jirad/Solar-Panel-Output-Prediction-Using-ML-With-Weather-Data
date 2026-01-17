import React, { useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { usePredictions } from '../contexts/PredictionContext';
import '../components/ChartConfig';

function Dashboard() {
  const { gruPredictions, autoformerPredictions, loading, error, lastUpdate, refreshData } = usePredictions();
  const [numPanels, setNumPanels] = useState(1);
  const [selectedModel, setSelectedModel] = useState('gru'); // 'gru' or 'autoformer'

  // Choose data based on selected model
  const forecastHorizon = selectedModel === 'gru' ? '24 hours' : '4 days';

  // Calculate overall daily power
  const calculateDailyEnergy = (day) => {
    return day.avgPower * 24;
  };

  // Calculate total energy for GRU
  let gruTotalEnergy = 0;
  if (selectedModel === 'gru' && gruPredictions.length > 0) {
    // Sum all hourly predictions to get total daily energy
    gruTotalEnergy = gruPredictions.reduce((sum, p) => sum + p.predictedPower, 0);
  }

  // Prepare chart data based on model
  const chartData = selectedModel === 'gru' ? {
    // GRU: Hourly predictions
    labels: gruPredictions.map(p => p.time),
    datasets: [
      {
        label: 'Predicted Power (W)',
        data: gruPredictions.map(p => p.predictedPower * numPanels),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
        tension: 0.4
      }
    ]
  } : {
    // Autoformer: Only Daily Energy
    labels: ['0-24 hours', '24-48 hours', '48-72 hours', '72-96 hours'],
    datasets: [
      {
        label: 'Daily Energy Production (Wh)',
        data: autoformerPredictions.map(p => calculateDailyEnergy(p) * numPanels),
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 2
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
        text: selectedModel === 'gru' 
          ? 'Solar Energy Forecast - Next 24 Hours (GRU Model)'
          : 'Solar Energy Forecast - Next 4 Days (Autoformer Model)'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: selectedModel === 'gru' ? 'Power (Watts)' : 'Energy (Wh)'
        }
      },
      x: {
        title: {
          display: true,
          text: selectedModel === 'gru' ? 'Time' : 'Date'
        }
      }
    }
  };

  let totalEnergyProduction = 0;

  if (selectedModel === 'autoformer' && autoformerPredictions.length > 0) {
    // Total energy production across all 4 days
    totalEnergyProduction = autoformerPredictions.reduce(
      (sum, day) => sum + calculateDailyEnergy(day),
      0
    );
  }

  if (loading && gruPredictions.length === 0) {
    return (
      <div className="dashboard">
        <h2 className="mb-4">Solar Energy Dashboard</h2>
        <div className="alert alert-info">
          <div className="spinner-border spinner-border-sm me-2" role="status"></div>
          Loading predictions... This may take 30-60 seconds due to cold start.
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Solar Energy Dashboard</h2>
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
          <span className="ms-3">
            <strong>Auto-refresh:</strong> Every hour
          </span>
        </div>
      )}
      
        {/* Controls */}
        <div className="card forecast-controls">
          <div className="row">
            <div className="col-md-6">
              <label className="form-label"><strong>Forecast Model:</strong></label>
              <select 
                className="form-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                <option value="gru">GRU - Short Term (24 hours)</option>
                <option value="autoformer">Autoformer - Long Term (4 days)</option>
              </select>
            </div>
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
          </div>
        </div>

      {/* Chart */}
      <div className="card">
        <div className="card-body">
          <div className="chart-container" style={{ height: '400px' }}>
            {selectedModel === 'gru' ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <Bar data={chartData} options={chartOptions} />
            )}
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="row mt-4">
        <div className="col-md-4 col-sm-6">
          <div className="stat-card">
            <div className="stat-value">{numPanels}</div>
            <div className="stat-label">Solar Panels</div>
          </div>
        </div>
        <div className="col-md-4 col-sm-6">
          <div className="stat-card">
            <div className="stat-value">{forecastHorizon}</div>
            <div className="stat-label">Forecast Period</div>
          </div>
        </div>
        <div className="col-md-4 col-sm-6">
          <div className="stat-card">
            <div className="stat-value">
              {selectedModel === 'gru'
                ? `${(gruTotalEnergy * numPanels / 1000).toFixed(1)}kWh`
                : `${(totalEnergyProduction * numPanels / 1000).toFixed(1)}kWh`
              }
            </div>
            <div className="stat-label">
              {selectedModel === 'gru' ? 'Overall Production (24h)' : 'Overall Production (4 days)'}
            </div>
          </div>
        </div>
      </div>

      {/* Model Info */}
      <div className="card mt-4">
        <div className="card-body">
          {selectedModel === 'gru' ? (
            <>
              <h5>About GRU Model</h5>
              <p>
                <strong>Gated Recurrent Unit (GRU)</strong> - Optimized for short-term predictions with high accuracy.
              </p>
              <ul>
                <li><strong>Forecast Horizon:</strong> Next 24 hours (hourly predictions)</li>
                <li><strong>Best For:</strong> Real-time operations, day-ahead planning, grid management</li>
                <li><strong>Update Frequency:</strong> Every hour with latest weather data</li>
                <li><strong>Daily Energy:</strong> Sum of all 24 hourly predictions</li>
              </ul>
            </>
          ) : (
            <>
              <h5>About Autoformer Model</h5>
              <p>
                <strong>Autoformer</strong> - Advanced transformer with autocorrelation for multi-day forecasting.
              </p>
              <ul>
                <li><strong>Forecast Horizon:</strong> Next 4 days (daily energy production)</li>
                <li><strong>Best For:</strong> Strategic planning, maintenance scheduling, medium-term operations</li>
                <li><strong>Features:</strong> Trend & seasonal decomposition, pattern recognition</li>
                <li><strong>Daily Energy:</strong> Calculated as Average Power × 24 hours</li>
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;