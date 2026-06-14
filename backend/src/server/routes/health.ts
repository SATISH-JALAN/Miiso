import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { execSync } from "node:child_process";
import { getHeimdallWorkerStats } from "../../daemon/heimdall.js";
import { CHAIN_ID } from "../../config/chain.js";

function isHeimdallCliInstalled(): boolean {
  try {
    execSync("heimdall --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function healthRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  fastify.get("/health", async (_request, reply) => {
    const workerStats = getHeimdallWorkerStats();
    const heimdallCli = isHeimdallCliInstalled();

    return reply.send({
      status: "ok",
      chainId: CHAIN_ID,
      heimdall: {
        cliInstalled: heimdallCli,
        workerPool: workerStats,
      },
      demoMode: process.env.DEMO_MODE === "true",
    });
  });
}
