import { prisma } from "../lib/prisma.js";
import { createApp } from "./app.js";
import { env } from "./config/envConfig.js";

export const startServer = async () => {

    try {
        await prisma.$queryRaw`SELECT 1`;
        console.log("Database connection successful. MySQL/MariaDB is running.");
        const app = createApp();
        app.listen(env.port, () => {
            console.log(`Server is running on port ${env.port}`);
        })
    } catch (error) {
        console.error("Database connection error: Could not connect to MySQL/MariaDB. Please ensure XAMPP MySQL is running.");
        console.error("Error details:", error.message);
        process.exit(1);
    }
}


startServer();