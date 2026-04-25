

require("dotenv").config();

const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

const ADMIN_NAME = "Bob";
const ADMIN_EMAIL = "bob@darcy.com.au";
const ADMIN_PASSWORD = "ChangeMe123!";

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    await connection.beginTransaction();

    const [existingUsers] = await connection.execute(
      "SELECT id FROM `User` WHERE email = ? LIMIT 1",
      [ADMIN_EMAIL]
    );

    let userId;

    if (existingUsers.length > 0) {
      userId = existingUsers[0].id;

      await connection.execute(
        "UPDATE `User` SET name = ?, passwordHash = ?, role = 'admin', updatedAt = NOW() WHERE id = ?",
        [ADMIN_NAME, passwordHash, userId]
      );
    } else {
      userId = crypto.randomUUID().replace(/-/g, "").slice(0, 25);

      await connection.execute(
        "INSERT INTO `User` (id, name, email, passwordHash, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'admin', NOW(), NOW())",
        [userId, ADMIN_NAME, ADMIN_EMAIL, passwordHash]
      );
    }

    const [profileUpdateResult] = await connection.execute(
      "UPDATE `Profile` SET userId = ? WHERE userId IS NULL",
      [userId]
    );

    await connection.commit();

    console.log("Admin user ready:");
    console.log(`Name: ${ADMIN_NAME}`);
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Temporary password: ${ADMIN_PASSWORD}`);
    console.log(`Profiles attached: ${profileUpdateResult.affectedRows}`);
    console.log("Change this password once login is working.");
  } catch (error) {
    await connection.rollback();
    console.error("Admin seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();