import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.mjs";
import { StateStore } from "./state-store.mjs";
import { Publisher, ftpTransport } from "./publisher.mjs";
import { createVenueServer } from "./server.mjs";
import { exportStaffQR } from "./qr.mjs";
import { acceptance } from "../../src/lib/congestion-contract.mjs";

const HELP =
  "status | sessions | select <id> | start <id> | stop | resume | reset | publish | qr | quit";
export function operatorConsole({ server, store, publisher, catalog, origin }) {
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let shuttingDown = false;
  let commands = Promise.resolve();
  const status = () =>
    console.log(
      JSON.stringify(
        {
          session_id: store.read().session_id,
          acceptance: acceptance(store.read(), catalog),
          saved_version: store.read().saved_version,
          games: store.read().games,
          publication: publisher.status(),
        },
        null,
        2,
      ),
    );
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    input.close();
    await new Promise((resolve) => server.close(resolve));
    await store.command("stop");
    await publisher.running;
    await publisher.tick();
    await publisher.close();
    await store.close();
  };
  input.on("line", (line) => {
    commands = commands
      .then(async () => {
        if (shuttingDown) return;
        const [command, argument, ...rest] = line.trim().split(/\s+/);
        if (!command) return;
        if (rest.length || (argument && !["select", "start"].includes(command)))
          throw new Error("コマンドの引数を確認してください");
        if (command === "quit") return shutdown();
        if (command === "help") return console.log(HELP);
        if (command === "sessions") return console.table(catalog.sessions);
        if (command === "status") return status();
        if (command === "qr")
          return console.log(
            `印刷用QR: ${await exportStaffQR(catalog, origin, store.directory)}`,
          );
        if (command === "publish") {
          await publisher.tick();
          return status();
        }
        await store.command(command, argument);
        publisher.request();
        status();
      })
      .catch((error) => console.error(`操作できません: ${error.message}`));
  });
  process.once("SIGINT", () =>
    shutdown().catch(() => {
      process.exitCode = 1;
    }),
  );
  process.once("SIGTERM", () =>
    shutdown().catch(() => {
      process.exitCode = 1;
    }),
  );
  let lastReport = "";
  const reporting = setInterval(() => {
    const report = JSON.stringify(publisher.status());
    if (report !== lastReport) {
      lastReport = report;
      console.log(`公開反映: ${report}`);
    }
    if (shuttingDown) clearInterval(reporting);
  }, 5000);
  reporting.unref();
  console.log(`スタッフ画面: ${origin}/staff/congestion/\n${HELP}`);
  status();
  return shutdown;
}

export async function main() {
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw new Error("Node 24以上を使用してください");
  const filename = process.argv[2];
  if (!filename)
    throw new Error(
      "使用方法: npm run congestion:start -- .congestion/config.json",
    );
  const { config, catalog } = await loadConfig(filename);
  const store = await new StateStore(catalog, config.state_directory).init();
  const publisher = new Publisher(store, ftpTransport(config.transfer));
  const server = createVenueServer({ config, catalog, store, publisher });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(config.port, config.listen_host, resolve);
    });
  } catch (error) {
    await store.close();
    throw error;
  }
  operatorConsole({
    server,
    store,
    publisher,
    catalog,
    origin: config.local_origin,
  });
  publisher.request();
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(`起動停止: ${error.message}`);
    process.exitCode = 1;
  });
}
