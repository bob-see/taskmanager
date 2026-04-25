require("dotenv").config();

const mysql = require("mysql2/promise");

const OLD_EMAIL = "bob@darcy.com.au";
const NEW_EMAIL = "robert.bob.see@gmail.com";

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  await connection.execute(
    "UPDATE `User` SET email = ?, updatedAt = NOW() WHERE email = ?",
    [NEW_EMAIL, OLD_EMAIL]
  );

  console.log(`Admin email updated from ${OLD_EMAIL} to ${NEW_EMAIL}`);

  await connection.end();
}

main();