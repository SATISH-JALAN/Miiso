import { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  getRelayerCapabilities,
  submit7702Upgrade,
  ONESHOT_RELAYER_URL,
} from "../../blockchain/oneshotRelay.js";
import { logger } from "../../utils/logger.js";

interface UpgradeBody {
  userAddress: string;
  authorizationList: Array<{
    chainId: number;
    address: string;
    nonce: number;
    yParity: number;
    r: string;
    s: string;
  }>;
}

export async function relayRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  // GET /relay/capabilities — fee quote for 1Shot USDC gas
  fastify.get("/relay/capabilities", async (_request, reply) => {
    try {
      const caps = await getRelayerCapabilities();
      return reply.send({
        success: true,
        relayerUrl: ONESHOT_RELAYER_URL,
        feeUsdc: caps.feeUsdc,
        feeToken: caps.feeToken,
        minFee: caps.minFee.toString(),
        maxFee: caps.effectiveFee.toString(),
        feeCollector: caps.feeCollector,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("❌ Failed to fetch 1Shot capabilities:", error);
      return reply.status(502).send({
        error: "RelayerUnavailable",
        message: `1Shot relayer unreachable: ${message}`,
      });
    }
  });

  // POST /relay/upgrade — submit signed EIP-7702 authorization via 1Shot
  fastify.post<{ Body: UpgradeBody }>(
    "/relay/upgrade",
    {
      schema: {
        body: {
          type: "object",
          required: ["userAddress", "authorizationList"],
          properties: {
            userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            authorizationList: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["chainId", "address", "nonce", "yParity", "r", "s"],
                properties: {
                  chainId: { type: "integer" },
                  address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                  nonce: { type: "integer" },
                  yParity: { type: "integer" },
                  r: { type: "string" },
                  s: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { userAddress, authorizationList } = request.body;

      if (process.env.DEMO_MODE === "true") {
        const randomBytes = Array.from({ length: 8 }, () =>
          Math.floor(Math.random() * 256)
        );
        const txHash =
          "0xdemo_upgrade_" +
          randomBytes.map((b) => b.toString(16).padStart(2, "0")).join("");
        return reply.send({
          success: true,
          txHash,
          feeUsdc: 0.01,
          method: "1shot_relayer",
        });
      }

      try {
        const caps = await getRelayerCapabilities();
        const result = await submit7702Upgrade(
          {
            userAddress: userAddress as `0x${string}`,
            authorizationList: authorizationList.map((a) => ({
              chainId: a.chainId,
              address: a.address as `0x${string}`,
              nonce: a.nonce,
              yParity: a.yParity,
              r: a.r as `0x${string}`,
              s: a.s as `0x${string}`,
            })),
          },
          caps
        );

        return reply.send({
          success: true,
          txHash: result.txHash,
          feeUsdc: result.feeUsdc,
          method: "1shot_relayer",
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`❌ 1Shot upgrade failed for ${userAddress}:`, error);
        return reply.status(502).send({
          error: "UpgradeFailed",
          message,
        });
      }
    }
  );
}
