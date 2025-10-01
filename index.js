/**
 * @copyright Copyright (c) 2025 BioCV GmbH
 *
 * Enhanced demo integration script showing how to use the standalone mode
 * This demonstrates a typical integration pattern for external applications
 * with SQLite storage capabilities
 */

const WebSocket = require("ws");
const axios = require("axios");
const chalk = require("chalk");
const readline = require("readline");

// Configuration
const config = {
	wsUrl: "ws://localhost:8080",
	apiUrl: "http://localhost:3000",
	reconnectInterval: 5000,
	dataProcessingInterval: 10000,
	storageEnabled: false,
	storageConfig: {
		enabled: false,
		database_path: "./data/demo_biocv_data.db",
		max_table_size: 1000,
		retention_days: 7,
		auto_create_tables: true
	}
};

// Data storage for demo
const dataStore = {
	sensors: new Map(),
	lastBatteryUpdate: new Map(),
	animalPositions: new Map(),
	environment: null,
};

// Storage management
let storageAdapter = null;
let rl = null;

/**
 * Initialize SQLite storage
 */
async function initializeStorage() {
	try {
		const SQLiteStorageAdapter = require('./sqlite-adapter');
		storageAdapter = new SQLiteStorageAdapter(null, config.storageConfig);
		
		await storageAdapter.initialize();
		config.storageEnabled = true;
		
		console.log(chalk.green('✓ SQLite storage initialized'));
		console.log(chalk.gray(`  Database: ${config.storageConfig.database_path}`));
		
		// Set up storage event listeners
		storageAdapter.on('dataStored', (event) => {
			console.log(chalk.gray(`[Storage] ${event.type} data stored for ${event.mac || 'environment'}`));
		});
		
		storageAdapter.on('error', (error) => {
			console.error(chalk.red('[Storage Error]:'), error.message);
		});
		
	} catch (error) {
		console.error(chalk.red('Failed to initialize storage:'), error.message);
		config.storageEnabled = false;
	}
}

/**
 * Process incoming sensor data
 */
function processSensorData(data) {
	const { mac, rssi, timestamp } = data;

	if (!dataStore.sensors.has(mac)) {
		dataStore.sensors.set(mac, []);
	}

	const sensorHistory = dataStore.sensors.get(mac);
	sensorHistory.push({
		rssi,
		timestamp,
		...data,
	});

	// Keep only last 100 readings per sensor
	if (sensorHistory.length > 100) {
		sensorHistory.shift();
	}

	console.log(
		chalk.blue(
			`[Sensor ${mac}] RSSI: ${rssi}, Total readings: ${sensorHistory.length}`
		)
	);

	// Store in SQLite if enabled
	if (config.storageEnabled && storageAdapter) {
		storageAdapter.storeSensorData(mac, data, null).catch(err => {
			console.error(chalk.red(`[Storage] Failed to store sensor data: ${err.message}`));
		});
	}
}

/**
 * Process battery updates
 */
function processBatteryData(data) {
	const { mac, percentage, timestamp } = data;

	dataStore.lastBatteryUpdate.set(mac, {
		percentage,
		timestamp,
		lastUpdate: new Date(),
	});

	console.log(chalk.yellow(`[Battery ${mac}] Level: ${percentage}%`));

	// Alert on low battery
	if (percentage < 20) {
		console.log(
			chalk.red(`⚠️  LOW BATTERY WARNING for ${mac}: ${percentage}%`)
		);
	}

	// Store in SQLite if enabled
	if (config.storageEnabled && storageAdapter) {
		storageAdapter.storeBatteryData(mac, data).catch(err => {
			console.error(chalk.red(`[Storage] Failed to store battery data: ${err.message}`));
		});
	}
}

/**
 * Process ANT positioning data
 */
function processAntData(data) {
	const { macAnt, macTag, distance, timestamp } = data;

	if (!dataStore.animalPositions.has(macTag)) {
		dataStore.animalPositions.set(macTag, new Map());
	}

	const positions = dataStore.animalPositions.get(macTag);
	positions.set(macAnt, {
		distance,
		timestamp,
		lastUpdate: new Date(),
	});

	console.log(
		chalk.magenta(
			`[Position] Animal ${macTag} detected by ANT ${macAnt} at distance ${distance}`
		)
	);

	// Store in SQLite if enabled
	if (config.storageEnabled && storageAdapter) {
		storageAdapter.storeAntData(macAnt, macTag, distance).catch(err => {
			console.error(chalk.red(`[Storage] Failed to store ANT data: ${err.message}`));
		});
	}
}

/**
 * Process environmental data
 */
function processEnvironmentData(data) {
	dataStore.environment = {
		...data,
		lastUpdate: new Date(),
	};

	console.log(
		chalk.cyan(
			`[Environment] Temperature: ${data.temperature}°C, Humidity: ${data.humidity}%`
		)
	);

	// Store in SQLite if enabled
	if (config.storageEnabled && storageAdapter) {
		storageAdapter.storeEnvironmentData(data).catch(err => {
			console.error(chalk.red(`[Storage] Failed to store environment data: ${err.message}`));
		});
	}
}

/**
 * Connect to WebSocket and handle messages
 */
function connectWebSocket() {
	console.log(chalk.gray("Connecting to WebSocket..."));

	const ws = new WebSocket(config.wsUrl);

	ws.on("open", () => {
		console.log(chalk.green("✓ Connected to BioCV Node WebSocket"));

		// Subscribe to all data types
		ws.send(
			JSON.stringify({
				type: "subscribe",
				subscriptions: ["all"],
			})
		);
	});

	ws.on("message", (data) => {
		try {
			const message = JSON.parse(data);

			switch (message.type) {
				case "sensorData":
					processSensorData(message.data);
					break;
				case "batteryData":
					processBatteryData(message.data);
					break;
				case "antData":
					processAntData(message.data);
					break;
				case "environmentData":
					processEnvironmentData(message.data);
					break;
				case "connection":
					console.log(chalk.gray("Server info received:", message.message));
					break;
				default:
					// Ignore other message types
					break;
			}
		} catch (err) {
			console.error(chalk.red("Error processing message:"), err);
		}
	});

	ws.on("close", () => {
		console.log(chalk.yellow("Disconnected from WebSocket, reconnecting..."));
		setTimeout(() => connectWebSocket(), config.reconnectInterval);
	});

	ws.on("error", (err) => {
		console.error(chalk.red("WebSocket error:"), err.message);
	});

	return ws;
}

/**
 * Storage management functions
 */
async function enableStorage() {
	if (!storageAdapter) {
		await initializeStorage();
	} else {
		await storageAdapter.enable();
		config.storageEnabled = true;
		console.log(chalk.green('✓ Storage enabled'));
	}
}

async function disableStorage() {
	if (storageAdapter) {
		storageAdapter.disable();
		config.storageEnabled = false;
		console.log(chalk.yellow('⚠ Storage disabled'));
	}
}

async function getStorageStatus() {
	if (!storageAdapter || !config.storageEnabled) {
		return { enabled: false, message: 'Storage not initialized' };
	}

	try {
		const stats = await storageAdapter.getStorageStats();
		return { enabled: true, stats };
	} catch (error) {
		return { enabled: true, error: error.message };
	}
}

async function queryStoredData(mac, dataType = 'all', limit = 10) {
	if (!storageAdapter || !config.storageEnabled) {
		throw new Error('Storage not enabled');
	}

	try {
		const data = await storageAdapter.queryData(mac, { dataType, limit });
		return data;
	} catch (error) {
		throw new Error(`Failed to query data: ${error.message}`);
	}
}

async function cleanupOldData(days = 7) {
	if (!storageAdapter || !config.storageEnabled) {
		throw new Error('Storage not enabled');
	}

	try {
		const deletedCount = await storageAdapter.cleanupOldData(null, days);
		console.log(chalk.green(`✓ Cleaned up ${deletedCount} old records`));
		return deletedCount;
	} catch (error) {
		throw new Error(`Failed to cleanup data: ${error.message}`);
	}
}

/**
 * Periodically analyze collected data
 */
async function analyzeData() {
	console.log(chalk.cyan.bold("\n=== Data Analysis ==="));

	// Analyze sensor activity
	console.log(chalk.gray("\nActive Sensors:"));
	for (const [mac, history] of dataStore.sensors) {
		const recentData = history.slice(-10);
		const avgRssi =
			recentData.reduce((sum, d) => sum + d.rssi, 0) / recentData.length;
		console.log(
			`  ${mac}: ${history.length} readings, Avg RSSI: ${avgRssi.toFixed(1)}`
		);
	}

	// Check battery status
	console.log(chalk.gray("\nBattery Status:"));
	for (const [mac, battery] of dataStore.lastBatteryUpdate) {
		const age = (new Date() - battery.lastUpdate) / 1000 / 60; // minutes
		console.log(`  ${mac}: ${battery.percentage}% (${age.toFixed(1)} min ago)`);
	}

	// Animal positions
	console.log(chalk.gray("\nAnimal Positions:"));
	for (const [animal, positions] of dataStore.animalPositions) {
		console.log(`  ${animal}:`);
		for (const [ant, pos] of positions) {
			console.log(`    - ANT ${ant}: distance ${pos.distance}`);
		}
	}

	// Environment
	if (dataStore.environment) {
		console.log(chalk.gray("\nEnvironment:"));
		console.log(`  Temperature: ${dataStore.environment.temperature}°C`);
		console.log(`  Humidity: ${dataStore.environment.humidity}%`);
	}

	// Storage status
	if (config.storageEnabled) {
		console.log(chalk.gray("\nStorage Status:"));
		try {
			const status = await getStorageStatus();
			if (status.enabled && status.stats) {
				console.log(`  Database: ${config.storageConfig.database_path}`);
				console.log(`  Tables: ${status.stats.length}`);
				if (status.stats.length > 0) {
					const totalRows = status.stats.reduce((sum, table) => sum + (table.row_count || 0), 0);
					console.log(`  Total records: ${totalRows}`);
				}
			} else {
				console.log(`  Status: ${status.message || 'Unknown'}`);
			}
		} catch (error) {
			console.log(`  Error: ${error.message}`);
		}
	} else {
		console.log(chalk.gray("\nStorage: Disabled"));
	}

	// Query historical data via REST API
	try {
		const health = await axios.get(`${config.apiUrl}/health`);
		console.log(chalk.gray("\nServer Health:"));
		console.log(`  Uptime: ${(health.data.uptime / 60).toFixed(1)} minutes`);
		console.log(`  Connected clients: ${health.data.clients}`);
	} catch (err) {
		console.error(chalk.red("Failed to fetch server health:"), err.message);
	}

	console.log(chalk.cyan("====================\n"));
}

/**
 * Interactive command interface
 */
function setupInteractiveInterface() {
	rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: chalk.cyan('BioCV> ')
	});

	rl.on('line', async (input) => {
		const command = input.trim().toLowerCase();
		
		switch (command) {
			case 'help':
			case 'h':
				showHelp();
				break;
			case 'storage enable':
			case 'se':
				await enableStorage();
				break;
			case 'storage disable':
			case 'sd':
				await disableStorage();
				break;
			case 'storage status':
			case 'ss':
				await showStorageStatus();
				break;
			case 'query':
			case 'q':
				await showQueryHelp();
				break;
			case 'cleanup':
			case 'c':
				await cleanupOldData();
				break;
			case 'analyze':
			case 'a':
				await analyzeData();
				break;
			case 'exit':
			case 'quit':
				console.log(chalk.yellow('Exiting demo...'));
				process.exit(0);
				break;
			default:
				if (command.startsWith('query ')) {
					await handleQueryCommand(command);
				} else if (command) {
					console.log(chalk.red(`Unknown command: ${command}`));
					console.log(chalk.gray('Type "help" for available commands'));
				}
		}
		rl.prompt();
	});

	rl.on('close', () => {
		console.log(chalk.yellow('\nGoodbye!'));
		process.exit(0);
	});
}

function showHelp() {
	console.log(chalk.cyan.bold('\n=== Available Commands ==='));
	console.log(chalk.white('help, h              - Show this help'));
	console.log(chalk.white('storage enable, se   - Enable SQLite storage'));
	console.log(chalk.white('storage disable, sd  - Disable SQLite storage'));
	console.log(chalk.white('storage status, ss   - Show storage status'));
	console.log(chalk.white('query, q             - Show query help'));
	console.log(chalk.white('cleanup, c           - Clean up old data'));
	console.log(chalk.white('analyze, a           - Run data analysis'));
	console.log(chalk.white('exit, quit           - Exit the demo'));
	console.log(chalk.gray('\nQuery commands:'));
	console.log(chalk.white('query <mac> [type] [limit] - Query stored data'));
	console.log(chalk.gray('  mac: MAC address (required)'));
	console.log(chalk.gray('  type: sensor|battery|ant|environment|all (default: all)'));
	console.log(chalk.gray('  limit: number of records (default: 10)'));
	console.log(chalk.cyan('========================\n'));
}

async function showStorageStatus() {
	try {
		const status = await getStorageStatus();
		if (status.enabled) {
			console.log(chalk.green('✓ Storage Status:'));
			console.log(chalk.gray(`  Database: ${config.storageConfig.database_path}`));
			console.log(chalk.gray(`  Enabled: ${config.storageEnabled}`));
			if (status.stats) {
				console.log(chalk.gray(`  Tables: ${status.stats.length}`));
				if (status.stats.length > 0) {
					const totalRows = status.stats.reduce((sum, table) => sum + (table.row_count || 0), 0);
					console.log(chalk.gray(`  Total records: ${totalRows}`));
					console.log(chalk.gray('\n  Tables:'));
					status.stats.forEach(table => {
						console.log(chalk.gray(`    ${table.mac_address}: ${table.row_count} records`));
					});
				}
			}
		} else {
			console.log(chalk.yellow('⚠ Storage not enabled'));
			console.log(chalk.gray(`  Status: ${status.message}`));
		}
	} catch (error) {
		console.error(chalk.red('Error getting storage status:'), error.message);
	}
}

function showQueryHelp() {
	console.log(chalk.cyan.bold('\n=== Query Commands ==='));
	console.log(chalk.white('query <mac> [type] [limit]'));
	console.log(chalk.gray('\nParameters:'));
	console.log(chalk.gray('  mac     - MAC address of the device (required)'));
	console.log(chalk.gray('  type    - Data type filter (optional):'));
	console.log(chalk.gray('            sensor     - Sensor readings'));
	console.log(chalk.gray('            battery    - Battery updates'));
	console.log(chalk.gray('            ant        - ANT positioning data'));
	console.log(chalk.gray('            environment - Environmental data'));
	console.log(chalk.gray('            all        - All data types (default)'));
	console.log(chalk.gray('  limit   - Maximum number of records (default: 10)'));
	console.log(chalk.gray('\nExamples:'));
	console.log(chalk.white('  query AA:BB:CC:DD:EE:FF'));
	console.log(chalk.white('  query AA:BB:CC:DD:EE:FF sensor 20'));
	console.log(chalk.white('  query AA:BB:CC:DD:EE:FF battery 5'));
	console.log(chalk.cyan('=====================\n'));
}

async function handleQueryCommand(command) {
	const parts = command.split(' ');
	if (parts.length < 2) {
		console.log(chalk.red('Error: MAC address required'));
		console.log(chalk.gray('Usage: query <mac> [type] [limit]'));
		return;
	}

	const mac = parts[1];
	const dataType = parts[2] || 'all';
	const limit = parseInt(parts[3]) || 10;

	try {
		const data = await queryStoredData(mac, dataType, limit);
		if (data.length === 0) {
			console.log(chalk.yellow(`No data found for ${mac} (${dataType})`));
		} else {
			console.log(chalk.green(`\nFound ${data.length} records for ${mac} (${dataType}):`));
			data.forEach((record, index) => {
				console.log(chalk.gray(`\n${index + 1}. ${record.data_type} - ${record.timestamp}`));
				if (record.rssi !== null) console.log(chalk.gray(`   RSSI: ${record.rssi}`));
				if (record.temperature !== null) console.log(chalk.gray(`   Temperature: ${record.temperature}°C`));
				if (record.battery_percentage !== null) console.log(chalk.gray(`   Battery: ${record.battery_percentage}%`));
				if (record.ant_mac) console.log(chalk.gray(`   ANT: ${record.ant_mac}`));
				if (record.distance !== null) console.log(chalk.gray(`   Distance: ${record.distance}`));
			});
		}
	} catch (error) {
		console.error(chalk.red('Query error:'), error.message);
	}
}

/**
 * Main application
 */
async function main() {
	console.log(chalk.cyan.bold("BioCV Standalone Mode - Enhanced Integration Demo"));
	console.log(
		chalk.gray(
			"This demo shows how to integrate with the BioCV Node in standalone mode\n"
		)
	);

	// Initialize storage if enabled
	if (config.storageConfig.enabled) {
		await initializeStorage();
	}

	// Connect to WebSocket
	connectWebSocket();

	// Set up interactive interface
	setupInteractiveInterface();

	// Periodically analyze data
	setInterval(analyzeData, config.dataProcessingInterval);

	// Initial analysis after 5 seconds
	setTimeout(analyzeData, 5000);

	console.log(chalk.gray("Demo is running. Type 'help' for commands or Ctrl+C to exit.\n"));
	rl.prompt();
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
	console.log(chalk.yellow("\nShutting down demo..."));
	
	// Clean up storage adapter
	if (storageAdapter) {
		try {
			await storageAdapter.cleanup();
		} catch (error) {
			console.error(chalk.red('Error cleaning up storage:'), error.message);
		}
	}
	
	// Close readline interface
	if (rl) {
		rl.close();
	}
	
	process.exit(0);
});

// Start the demo
if (require.main === module) {
	main().catch((err) => {
		console.error(chalk.red("Demo error:"), err);
		process.exit(1);
	});
}

module.exports = {
	processSensorData,
	processBatteryData,
	processAntData,
	processEnvironmentData,
	initializeStorage,
	enableStorage,
	disableStorage,
	getStorageStatus,
	queryStoredData,
	cleanupOldData,
	analyzeData,
};
