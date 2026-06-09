export interface FactorySignature {
  name: string;
  topic: `0x${string}`;
  // Function to extract contract address from the log topics/data
  extractAddress: (topics: readonly `0x${string}`[], data: `0x${string}`) => `0x${string}` | null;
}

export const FACTORY_SIGNATURES: FactorySignature[] = [
  // 1. Uniswap V3 PoolCreated: PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)
  {
    name: "UniswapV3PoolCreated",
    topic: "0x783cca1c0412dd0be69c506b39da253d28f7d3e141ef19077270e54d8a24ca6c",
    extractAddress: (topics, data) => {
      // pool is the last parameter in data (32 bytes padded)
      if (data && data.length >= 66) {
        return `0x${data.substring(data.length - 40)}` as `0x${string}`;
      }
      return null;
    }
  },
  // 2. Gnosis Safe ProxyCreation: ProxyCreation(address proxy, address singleton)
  {
    name: "SafeProxyCreation",
    topic: "0x4f53fcdc6e555ad2567ad45afe93d40fe939bde0f135bfa32f14068305c2d30f",
    extractAddress: (topics, data) => {
      // proxy is in data (first 32 bytes)
      if (data && data.length >= 66) {
        return `0x${data.substring(26, 66)}` as `0x${string}`;
      }
      return null;
    }
  },
  // 3. ERC1967 Proxy creation / UpgradeEvent: Upgraded(address indexed implementation)
  {
    name: "ERC1967Upgraded",
    topic: "0xbc7cd75a20ee27d9adebab32b61050da454810fd313FB44d36a9b9b5058093db",
    extractAddress: (topics, data) => {
      // implementation is indexed, topics[1] holds the implementation address
      if (topics.length >= 2) {
        return `0x${topics[1].substring(26)}` as `0x${string}`;
      }
      return null;
    }
  }
];
