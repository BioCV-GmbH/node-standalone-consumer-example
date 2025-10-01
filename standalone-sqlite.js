/**
 * @copyright Copyright (c) 2025 BioCV GmbH
 *
 * Standalone SQLite Storage Module
 * Completely independent SQLite storage for BioCV sensor data
 * Can be used without any dependencies on the main program
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * Standalone SQLite Storage Manager
 * Provides complete SQLite functionality without dependencies on the main program
 */
class StandaloneSQLiteStorage {
	constructor(config = {}) {
		this.config = {
			database_path: config.database_path || './data/biocv_standalone.db',
			max_table_size: config.max_table_size || 10000,
			retention_days: config.retention_days || 30,
			auto_create_tables: config.auto_create_tables !== false,
			enable_logging: config.enable_logging !== false,
			...config
		};

		this.db = null;
		this.isConnected = false;
		this.createdTables = new Set();
		this.eventListeners = new Map();
	}

	/**
	 * Log messages if logging is enabled
	 */
	log(level, message, ...args) {
		if (this.config.enable_logging) {
			const timestamp = new Date().toISOString().replace('T', ' ').substr(0, 19);
			const prefix = `[${timestamp}] [standalone-sqlite]`;
			
			switch (level) {
				case 'info':
					console.log(`${prefix} ${message}`, ...args);
					break;
				case 'error':
					console.error(`${prefix} ERROR: ${message}`, ...args);
					break;
				case 'warn':
					console.warn(`${prefix} WARN: ${message}`, ...args);
					break;
				case 'success':
					console.log(`${prefix} ✓ ${message}`, ...args);
					break;
			}
		}
	}

	/**
	 * Initialize database connection and setup
	 */
	async initialize() {
		if (this.isConnected) {
			this.log('warn', 'Database already initialized');
			return;
		}

		try {
			// Ensure data directory exists
			const dbDir = path.dirname(this.config.database_path);
			if (!fs.existsSync(dbDir)) {
				fs.mkdirSync(dbDir, { recursive: true });
				this.log('info', `Created database directory: ${dbDir}`);
			}

			// Connect to database
			await this.connect();

			// Create metadata table for tracking
			await this.createMetadataTable();

			this.log('success', 'SQLite database initialized');
			this.log('info', `Database: ${this.config.database_path}`);
			this.log('info', `Max table size: ${this.config.max_table_size}`);
			this.log('info', `Retention: ${this.config.retention_days} days`);

		} catch (error) {
			this.log('error', 'Failed to initialize SQLite database:', error.message);
			throw error;
		}
	}

	/**
	 * Connect to SQLite database
	 */
	async connect() {
		return new Promise((resolve, reject) => {
			this.db = new sqlite3.Database(this.config.database_path, (err) => {
				if (err) {
					reject(err);
				} else {
					this.isConnected = true;
					resolve();
				}
			});
		});
	}

	/**
	 * Create metadata table for tracking database state
	 */
	async createMetadataTable() {
		const sql = `
			CREATE TABLE IF NOT EXISTS biocv_metadata (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				table_name TEXT UNIQUE NOT NULL,
				mac_address TEXT NOT NULL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
				row_count INTEGER DEFAULT 0,
				data_types TEXT DEFAULT '[]'
			)
		`;

		await this.run(sql);
	}

	/**
	 * Sanitize MAC address for use as table name
	 */
	sanitizeMacForTableName(mac) {
		return mac.replace(/:/g, '_').toUpperCase();
	}

	/**
	 * Create table for specific MAC address if it doesn't exist
	 */
	async createTableForMac(mac) {
		const tableName = this.sanitizeMacForTableName(mac);
		
		if (this.createdTables.has(tableName)) {
			return tableName;
		}

		const sql = `
			CREATE TABLE IF NOT EXISTS ${tableName} (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				data_type TEXT NOT NULL,
				mac_address TEXT NOT NULL,
				timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
				rssi INTEGER,
				temperature REAL,
				battery_percentage INTEGER,
				ant_mac TEXT,
				distance REAL,
				weight REAL,
				raw_data TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`;

		await this.run(sql);

		// Create indexes for performance
		await this.run(`CREATE INDEX IF NOT EXISTS idx_${tableName}_timestamp ON ${tableName}(timestamp)`);
		await this.run(`CREATE INDEX IF NOT EXISTS idx_${tableName}_data_type ON ${tableName}(data_type)`);
		await this.run(`CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON ${tableName}(created_at)`);

		// Register table in metadata
		await this.run(`
			INSERT OR IGNORE INTO biocv_metadata (table_name, mac_address) 
			VALUES (?, ?)
		`, [tableName, mac]);

		this.createdTables.add(tableName);
		return tableName;
	}

	/**
	 * Store sensor data
	 */
	async storeSensorData(mac, data) {
		if (!this.isConnected) {
			throw new Error('Database not connected');
		}

		const tableName = await this.createTableForMac(mac);
		
		const sql = `
			INSERT INTO ${tableName} (
				data_type, mac_address, rssi, temperature, weight, raw_data
			) VALUES (?, ?, ?, ?, ?, ?)
		`;

		const values = [
			'sensor',
			mac,
			data.rssi || null,
			data.temperature || data.T || null,
			data.weight || null,
			JSON.stringify(data)
		];

		await this.run(sql, values);
		await this.updateMetadata(tableName, mac, 'sensor');
		this.log('info', `Stored sensor data for ${mac}`);
	}

	/**
	 * Store battery data
	 */
	async storeBatteryData(mac, data) {
		if (!this.isConnected) {
			throw new Error('Database not connected');
		}

		const tableName = await this.createTableForMac(mac);
		
		const sql = `
			INSERT INTO ${tableName} (
				data_type, mac_address, battery_percentage, raw_data
			) VALUES (?, ?, ?, ?)
		`;

		const values = [
			'battery',
			mac,
			data.percentage || data.battery_percentage || null,
			JSON.stringify(data)
		];

		await this.run(sql, values);
		await this.updateMetadata(tableName, mac, 'battery');
		this.log('info', `Stored battery data for ${mac}`);
	}

	/**
	 * Store ANT data
	 */
	async storeAntData(macAnt, macTag, distance) {
		if (!this.isConnected) {
			throw new Error('Database not connected');
		}

		const tableName = await this.createTableForMac(macTag);
		
		const sql = `
			INSERT INTO ${tableName} (
				data_type, mac_address, ant_mac, distance, raw_data
			) VALUES (?, ?, ?, ?, ?)
		`;

		const values = [
			'ant',
			macTag,
			macAnt,
			parseFloat(distance) || null,
			JSON.stringify({ macAnt, macTag, distance })
		];

		await this.run(sql, values);
		await this.updateMetadata(tableName, macTag, 'ant');
		this.log('info', `Stored ANT data: ${macTag} -> ${macAnt} (${distance})`);
	}

	/**
	 * Store environment data
	 */
	async storeEnvironmentData(data) {
		if (!this.isConnected) {
			throw new Error('Database not connected');
		}

		// Use a special table for environment data
		const tableName = 'ENVIRONMENT_DATA';
		
		if (!this.createdTables.has(tableName)) {
			const sql = `
				CREATE TABLE IF NOT EXISTS ${tableName} (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					data_type TEXT NOT NULL,
					temperature REAL,
					humidity REAL,
					timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
					raw_data TEXT,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)
			`;

			await this.run(sql);
			await this.run(`CREATE INDEX IF NOT EXISTS idx_${tableName}_timestamp ON ${tableName}(timestamp)`);
			this.createdTables.add(tableName);
		}

		const sql = `
			INSERT INTO ${tableName} (
				data_type, temperature, humidity, raw_data
			) VALUES (?, ?, ?, ?)
		`;

		const values = [
			'environment',
			data.temperature || data.Temperature || null,
			data.humidity || data.Humidity || null,
			JSON.stringify(data)
		];

		await this.run(sql, values);
		this.log('info', 'Stored environment data');
	}

	/**
	 * Query data for specific MAC address
	 */
	async queryData(mac, options = {}) {
		if (!this.isConnected) {
			throw new Error('Database not connected');
		}

		const tableName = this.sanitizeMacForTableName(mac);
		const { dataType, startDate, endDate, limit = 100 } = options;

		let sql = `SELECT * FROM ${tableName} WHERE 1=1`;
		const params = [];

		if (dataType && dataType !== 'all') {
			sql += ` AND data_type = ?`;
			params.push(dataType);
		}

		if (startDate) {
			sql += ` AND timestamp >= ?`;
			params.push(startDate);
		}

		if (endDate) {
			sql += ` AND timestamp <= ?`;
			params.push(endDate);
		}

		sql += ` ORDER BY timestamp DESC LIMIT ?`;
		params.push(limit);

		const results = await this.all(sql, params);
		this.log('info', `Queried ${results.length} records for ${mac}`);
		return results;
	}

	/**
	 * Query all data across all devices
	 */
	async queryAllData(options = {}) {
		if (!this.isConnected) {
			throw new Error('Database not connected');
		}

		const { dataType, startDate, endDate, limit = 1000 } = options;

		// Get all table names from metadata
		const tables = await this.all(`
			SELECT table_name, mac_address FROM biocv_metadata
			WHERE table_name != 'ENVIRONMENT_DATA'
		`);

		let allResults = [];

		for (const table of tables) {
			let sql = `SELECT * FROM ${table.table_name} WHERE 1=1`;
			const params = [];

			if (dataType && dataType !== 'all') {
				sql += ` AND data_type = ?`;
				params.push(dataType);
			}

			if (startDate) {
				sql += ` AND timestamp >= ?`;
				params.push(startDate);
			}

			if (endDate) {
				sql += ` AND timestamp <= ?`;
				params.push(endDate);
			}

			sql += ` ORDER BY timestamp DESC`;

			const results = await this.all(sql, params);
			allResults = allResults.concat(results);
		}

		// Sort by timestamp and limit
		allResults.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
		allResults = allResults.slice(0, limit);

		this.log('info', `Queried ${allResults.length} records across all devices`);
		return allResults;
	}

	/**
	 * Get storage statistics
	 */
	async getStorageStats(mac = null) {
		if (!this.isConnected) {
			throw new Error('Database not connected');
		}

		if (mac) {
			const tableName = this.sanitizeMacForTableName(mac);
			const stats = await this.get(`
				SELECT 
					COUNT(*) as total_rows,
					COUNT(DISTINCT data_type) as data_types,
					MIN(timestamp) as first_entry,
					MAX(timestamp) as last_entry
				FROM ${tableName}
			`);
			return { mac, ...stats };
		} else {
			const stats = await this.all(`
				SELECT 
					table_name,
					mac_address,
					row_count,
					last_updated,
					data_types
				FROM biocv_metadata
				ORDER BY last_updated DESC
			`);
			return stats;
		}
	}

	/**
	 * Clean up old data
	 */
	async cleanupOldData(mac = null, olderThanDays = null) {
		if (!this.isConnected) {
			throw new Error('Database not connected');
		}

		const days = olderThanDays || this.config.retention_days;
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - days);

		if (mac) {
			const tableName = this.sanitizeMacForTableName(mac);
			const result = await this.run(`
				DELETE FROM ${tableName} 
				WHERE created_at < ?
			`, [cutoffDate.toISOString()]);
			
			await this.updateMetadata(tableName, mac);
			this.log('info', `Cleaned up ${result.changes} old records for ${mac}`);
			return result.changes;
		} else {
			// Clean up all tables
			const tables = await this.all(`
				SELECT table_name FROM biocv_metadata
			`);

			let totalDeleted = 0;
			for (const table of tables) {
				const result = await this.run(`
					DELETE FROM ${table.table_name} 
					WHERE created_at < ?
				`, [cutoffDate.toISOString()]);
				
				totalDeleted += result.changes;
				await this.updateMetadata(table.table_name, table.mac_address);
			}

			this.log('info', `Cleaned up ${totalDeleted} old records across all tables`);
			return totalDeleted;
		}
	}

	/**
	 * Drop table for specific MAC address
	 */
	async dropTable(mac) {
		if (!this.isConnected) {
			throw new Error('Database not connected');
		}

		const tableName = this.sanitizeMacForTableName(mac);
		
		await this.run(`DROP TABLE IF EXISTS ${tableName}`);
		await this.run(`DELETE FROM biocv_metadata WHERE table_name = ?`, [tableName]);
		
		this.createdTables.delete(tableName);
		this.log('info', `Dropped table for ${mac}`);
	}

	/**
	 * Export data to JSON file
	 */
	async exportToJSON(filePath, options = {}) {
		if (!this.isConnected) {
			throw new Error('Database not connected');
		}

		const { mac, dataType, startDate, endDate } = options;
		let data;

		if (mac) {
			data = await this.queryData(mac, { dataType, startDate, endDate, limit: 10000 });
		} else {
			data = await this.queryAllData({ dataType, startDate, endDate, limit: 10000 });
		}

		const exportData = {
			export_timestamp: new Date().toISOString(),
			export_options: options,
			record_count: data.length,
			data: data
		};

		fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
		this.log('success', `Exported ${data.length} records to ${filePath}`);
		return exportData;
	}

	/**
	 * Update metadata table
	 */
	async updateMetadata(tableName, mac, dataType = null) {
		// Get current data types
		const current = await this.get(`
			SELECT data_types FROM biocv_metadata WHERE table_name = ?
		`, [tableName]);

		let dataTypes = current ? JSON.parse(current.data_types || '[]') : [];
		
		if (dataType && !dataTypes.includes(dataType)) {
			dataTypes.push(dataType);
		}

		// Get row count
		const count = await this.get(`SELECT COUNT(*) as count FROM ${tableName}`);
		
		await this.run(`
			UPDATE biocv_metadata 
			SET row_count = ?, data_types = ?, last_updated = CURRENT_TIMESTAMP
			WHERE table_name = ?
		`, [count.count, JSON.stringify(dataTypes), tableName]);
	}

	/**
	 * Execute SQL query with parameters
	 */
	async run(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.run(sql, params, function(err) {
				if (err) {
					reject(err);
				} else {
					resolve({ changes: this.changes, lastID: this.lastID });
				}
			});
		});
	}

	/**
	 * Get single row
	 */
	async get(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.get(sql, params, (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row);
				}
			});
		});
	}

	/**
	 * Get all rows
	 */
	async all(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.all(sql, params, (err, rows) => {
				if (err) {
					reject(err);
				} else {
					resolve(rows);
				}
			});
		});
	}

	/**
	 * Get configuration
	 */
	getConfig() {
		return {
			database_path: this.config.database_path,
			max_table_size: this.config.max_table_size,
			retention_days: this.config.retention_days,
			auto_create_tables: this.config.auto_create_tables,
			enable_logging: this.config.enable_logging,
			connected: this.isConnected
		};
	}

	/**
	 * Update configuration
	 */
	updateConfig(newConfig) {
		this.config = { ...this.config, ...newConfig };
		this.log('info', 'Configuration updated');
	}

	/**
	 * Close database connection
	 */
	async close() {
		return new Promise((resolve) => {
			if (this.db) {
				this.db.close((err) => {
					if (err) {
						this.log('error', 'Error closing database:', err.message);
					} else {
						this.log('info', 'Database connection closed');
					}
					this.isConnected = false;
					resolve();
				});
			} else {
				resolve();
			}
		});
	}
}

module.exports = StandaloneSQLiteStorage;
