import { createGameServer } from "./app";
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be an integer between 1 and 65535");
const app = createGameServer();
try {
  await app.listen(port);
  console.log(`黑房弹球 listening on port ${port}`);
} catch (e) {
  await app.close();
  throw e;
}
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
