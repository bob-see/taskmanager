require("dotenv").config();

const Database = require("better-sqlite3");
const mysql = require("mysql2/promise");

const sqlite = new Database("./dev.db", { readonly: true });

const dateColumns = new Set([
  "dueAt",
  "completedAt",
  "completedOn",
  "createdAt",
  "updatedAt",
  "startDate",
  "entryDate",
  "startTime",
  "endTime",
]);

function normaliseValue(key, value) {
  if (value === null || value === undefined) return null;

  if (dateColumns.has(key)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 19).replace("T", " ");
    }
  }

  return value;
}

async function assertMariaDbIsEmpty(connection) {
  const tables = ["Profile", "Project", "Task", "TimeEntry"];

  for (const table of tables) {
    const [rows] = await connection.execute(`SELECT COUNT(*) AS count FROM \`${table}\``);
    if (rows[0].count > 0) {
      throw new Error(`MariaDB table ${table} is not empty. Aborting import.`);
    }
  }
}

async function copyTable(connection, table) {
  const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();

  if (rows.length === 0) {
    console.log(`${table}: 0 rows`);
    return;
  }

  const columns = Object.keys(rows[0]);
  const placeholders = columns.map(() => "?").join(", ");
  const columnList = columns.map((column) => `\`${column}\``).join(", ");

  const sql = `INSERT INTO \`${table}\` (${columnList}) VALUES (${placeholders})`;

  for (const row of rows) {
    const values = columns.map((column) => normaliseValue(column, row[column]));
    await connection.execute(sql, values);
  }

  console.log(`${table}: ${rows.length} rows copied`);
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    await assertMariaDbIsEmpty(connection);

    await connection.beginTransaction();

    await copyTable(connection, "Profile");
    await copyTable(connection, "Project");
    await copyTable(connection, "Task");
    await copyTable(connection, "TimeEntry");

    await connection.commit();

    console.log("SQLite data successfully copied into MariaDB.");
  } catch (error) {
    await connection.rollback();
    console.error("Import failed:", error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
    sqlite.close();
  }
}

main();