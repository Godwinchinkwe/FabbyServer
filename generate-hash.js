

const bcrypt = require("bcryptjs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter your new admin password: ", async (password) => {
  try {
    if (!password) {
      throw new Error("Password cannot be empty");
    }

    console.log("\nADMIN_PASSWORD_HASH=");
    console.log(await bcrypt.hash(password, 12));
  } catch (error) {
    console.error(error.message);
  } finally {
    rl.close();
  }
});
