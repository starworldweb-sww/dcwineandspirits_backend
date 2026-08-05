import { prisma } from "../lib/prisma.js";
import { createApp } from "./app.js";
import { env } from "./config/envConfig.js";

export const startServer = async () => {

    try {
        await prisma.$queryRaw`SELECT 1`;
        console.log("Database connection successful.");
        const app = createApp();
        app.listen(env.port, () => {
            console.log(`Server is running on port ${env.port}`);
        })
    } catch (error) {
        console.error("Error details:", error.message);
        process.exit(1);
    }
}


startServer();