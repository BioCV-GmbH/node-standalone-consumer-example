# BioCV Node Standalone Consumer Example

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite">
  <img src="https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="WebSocket">
</p>

<p align="center">
  <em><strong>Enhanced demo integration script showing how to use the BioCV Node in standalone mode</strong></em>
</p>

<p align="center">
  <em>Built with love by <a href="https://biocv.de">BioCV GmbH</a></em>
</p>

---

## Overview

The **BioCV Node Standalone Consumer Example** is a comprehensive demonstration of how to integrate with the BioCV Node system in standalone mode. This project showcases real-time data consumption, local SQLite storage, and interactive data management capabilities.

### Key Features

- **Real-time Data Streaming** - WebSocket connection to BioCV Node
- **Local SQLite Storage** - Persistent data collection with per-device tables
- **Interactive Command Interface** - Rich CLI for data management
- **Advanced Data Querying** - Filter by device, data type, and time ranges
- **Data Analysis & Export** - Built-in analytics and JSON export
- **Standalone Operation** - Completely independent from cloud services

---

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Data Types](#data-types)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

### Prerequisites

- **Node.js** >= 14.0.0
- **BioCV Node** running in standalone mode
- **npm** or **yarn** package manager

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/BioCV-GmbH/node-standalone-consumer-example.git
   cd node-standalone-consumer-example
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the BioCV Node** (in another terminal):
   ```bash
   # Navigate to your BioCV Node directory
   cd /path/to/biocv-node
   npm start debug standalone
   ```

4. **Run the consumer example:**
   ```bash
   npm start
   ```

### First Run

When you start the application, you'll see:

```
BioCV Standalone Mode - Enhanced Integration Demo
This demo shows how to integrate with the BioCV Node in standalone mode

Now featuring completely independent SQLite storage!

✓ Standalone SQLite storage initialized
  Database: ./data/demo_biocv_data.db
  Max table size: 1000
  Retention: 7 days
✓ Connected to BioCV Node WebSocket

Demo is running. Type 'help' for commands or Ctrl+C to exit.

BioCV> 
```

---

## Features

### Real-time Data Processing

- **Sensor Data**: Temperature, accelerometer (3-axis), RSSI monitoring
- **Battery Tracking**: Real-time battery level monitoring with low-battery alerts
- **ANT Positioning**: Distance-based positioning data
- **Environmental Data**: Temperature and humidity readings

### SQLite Storage System

- **Per-Device Tables**: Each sensor gets its own table (e.g., `E8_74_EC_4F_C9_09`)
- **Data Type Support**: Sensor, battery, ANT, and environment data
- **Automatic Cleanup**: Configurable retention policies
- **Performance Optimized**: Indexed queries and efficient storage

### Interactive Management

- **Rich CLI Interface**: Color-coded commands and help system
- **Real-time Queries**: Query data by device, type, and time range
- **Data Export**: Export to JSON with filtering options
- **Storage Management**: Enable/disable storage, view statistics

---

## Data Types

### Sensor Data
```javascript
{
  "mac": "E8:74:EC:4F:C9:09",
  "rssi": -75,
  "T": 25.55,           // Temperature in Celsius
  "x": 0.234,           // Accelerometer X-axis
  "y": -0.112,          // Accelerometer Y-axis  
  "z": 0.987,           // Accelerometer Z-axis
  "t": 1734012345678,   // Timestamp
  "timestamp": "2024-12-12T14:45:45.678Z"
}
```

### Battery Data
```javascript
{
  "mac": "E8:74:EC:4F:C9:09",
  "percentage": 85,     // Battery level 0-100%
  "timestamp": "2024-12-12T14:45:45.678Z"
}
```

### ANT Positioning Data
```javascript
{
  "macAnt": "AA:BB:CC:DD:EE:FF",  // ANT receiver MAC
  "macTag": "E8:74:EC:4F:C9:09",  // Eartag MAC
  "distance": 150,                 // Distance value
  "timestamp": "2024-12-12T14:45:45.678Z"
}
```

### Environmental Data
```javascript
{
  "temperature": 25.58,  // Ambient temperature
  "humidity": 47.64,     // Relative humidity %
  "timestamp": "2024-12-12T14:45:45.678Z"
}
```

---

## Configuration

### Default Configuration

```javascript
const config = {
  wsUrl: "ws://localhost:8080",        // BioCV Node WebSocket URL
  apiUrl: "http://localhost:3000",     // BioCV Node REST API URL
  reconnectInterval: 5000,             // Reconnection delay (ms)
  dataProcessingInterval: 10000,       // Analysis interval (ms)
  storageEnabled: false,               // Enable SQLite storage
  storageConfig: {
    enabled: false,
    database_path: "./data/demo_biocv_data.db",
    max_table_size: 1000,
    retention_days: 7,
    auto_create_tables: true,
    enable_logging: true
  }
};
```

### Environment Variables

You can override configuration using environment variables:

```bash
# WebSocket and API URLs
WS_URL=ws://localhost:8080
API_URL=http://localhost:3000

# Storage configuration
STORAGE_ENABLED=true
STORAGE_DB_PATH=./data/my_biocv_data.db
STORAGE_MAX_TABLE_SIZE=5000
STORAGE_RETENTION_DAYS=30
```

---

## Usage

### Interactive Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `help` | `h` | Show available commands |
| `storage enable` | `se` | Enable SQLite storage |
| `storage disable` | `sd` | Disable SQLite storage |
| `storage status` | `ss` | Show storage statistics |
| `query <mac> [type] [limit]` | `q` | Query stored data |
| `query all` | `qa` | Query all data across devices |
| `export [file] [options]` | `e` | Export data to JSON |
| `cleanup` | `c` | Clean up old data |
| `analyze` | `a` | Run data analysis |
| `config` | | Show storage configuration |
| `exit` | `quit` | Exit the application |

### Query Examples

```bash
# Query all data for a specific device
BioCV> query E8:74:EC:4F:C9:09

# Query only sensor data for a device
BioCV> query E8:74:EC:4F:C9:09 sensor 20

# Query battery data for a device
BioCV> query E8:74:EC:4F:C9:09 battery 5

# Query all data across all devices
BioCV> query all
```

### Export Examples

```bash
# Export all data to default file
BioCV> export

# Export to specific file
BioCV> export ./exports/my_data.json

# Export with filters
BioCV> export ./exports/sensor_data.json --type sensor --mac E8:74:EC:4F:C9:09 --limit 100
```

---

## API Reference

### WebSocket Connection

The consumer connects to the BioCV Node WebSocket server and subscribes to all data types:

```javascript
const ws = new WebSocket("ws://localhost:8080");

// Subscribe to all data
ws.send(JSON.stringify({
  type: "subscribe",
  subscriptions: ["all"]
}));
```

### Message Types

- `sensorData` - Real-time sensor readings
- `batteryData` - Battery status updates  
- `antData` - ANT positioning data
- `environmentData` - Environmental sensor readings

### SQLite Storage Schema

Each sensor device gets its own table:

```sql
CREATE TABLE E8_74_EC_4F_C9_09 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_type TEXT NOT NULL,           -- 'sensor', 'battery', 'ant', 'environment'
    mac_address TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    rssi INTEGER,                      -- Signal strength
    temperature REAL,                  -- Temperature in Celsius
    battery_percentage INTEGER,        -- Battery level 0-100
    ant_mac TEXT,                      -- ANT MAC address
    distance REAL,                     -- Distance value
    weight REAL,                       -- Calculated location weight
    raw_data TEXT,                     -- JSON string of original data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Examples

### Basic Integration

```javascript
const StandaloneSQLiteStorage = require('./standalone-sqlite');

// Initialize storage
const storage = new StandaloneSQLiteStorage({
  database_path: './data/my_data.db',
  max_table_size: 10000,
  retention_days: 30
});

await storage.initialize();

// Store sensor data
await storage.storeSensorData('E8:74:EC:4F:C9:09', {
  rssi: -75,
  T: 25.55,
  x: 0.234,
  y: -0.112,
  z: 0.987
});

// Query data
const data = await storage.queryData('E8:74:EC:4F:C9:09', {
  dataType: 'sensor',
  limit: 100
});
```

### WebSocket Data Processing

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  switch (message.type) {
    case 'sensorData':
      console.log('Sensor data:', message.data);
      break;
    case 'batteryData':
      console.log('Battery update:', message.data);
      break;
  }
});
```

---

## Troubleshooting

### Common Issues

**WebSocket Connection Failed**
```
Error: WebSocket connection failed
```
- Ensure BioCV Node is running in standalone mode
- Check that port 8080 is available
- Verify the WebSocket URL in configuration

**SQLite Database Error**
```
Error: SQLITE_CANTOPEN: unable to open database file
```
- Ensure the data directory exists and is writable
- Check file permissions
- Verify the database path in configuration

**No Data Received**
```
No data found for E8:74:EC:4F:C9:09
```
- Verify sensors are active and broadcasting
- Check BioCV Node is receiving BLE advertisements
- Ensure WebSocket subscription is working

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
DEBUG=true npm start
```

### Log Files

Check the console output for detailed logging information. All operations are logged with timestamps and context.

---

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- **BioCV GmbH** - For the amazing BioCV Node system
- **Node.js Community** - For the excellent ecosystem
- **SQLite Team** - For the reliable embedded database
- **WebSocket Contributors** - For real-time communication

---

## Support

- **Issues**: [GitHub Issues](https://github.com/BioCV-GmbH/node-standalone-consumer-example/issues)
- **Email**: info@biocv.org
- **Website**: [https://biocv.de](https://biocv.com)

