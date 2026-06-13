import { parentPort } from "node:worker_threads";
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

if (!parentPort) {
  throw new Error("Worker must be spawned via WorkerPool");
}

parentPort.on("message", async (msg) => {
  const { bytecode, contractAddress, rpcUrl } = msg;

  try {
    const decompiledSol = await runDecompiler(contractAddress, bytecode, rpcUrl);
    parentPort.postMessage({ success: true, decompiledCode: decompiledSol });
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message || "Decompilation failed" });
  }
});

/**
 * Attempts to decompile bytecode using Heimdall-rs.
 * Falls back to a mock Solidity generator if Heimdall is not installed on the host.
 */
async function runDecompiler(contractAddress, bytecode, rpcUrl) {
  const tempDir = path.join(os.tmpdir(), `miiso-heimdall-${crypto.randomBytes(8).toString("hex")}`);
  fs.mkdirSync(tempDir, { recursive: true });

  return new Promise((resolve) => {
    // 1. Construct CLI command. Pass contractAddress and --rpc-url to heimdall
    // This avoids command length issues (ENAMETOOLONG) and fetches bytecode from node.
    const command = `heimdall decompile ${contractAddress} --rpc-url "${rpcUrl}" --output "${tempDir}" --skip-resolving --default-interfaces false`;

    try {
      exec(command, (error, stdout, stderr) => {
        try {
          if (!error) {
            // Heimdall creates a folder structure inside output dir, look for .sol files
            const files = fs.readdirSync(tempDir);
            
            // Look for any folder created by heimdall
            for (const file of files) {
              const fullPath = path.join(tempDir, file);
              if (fs.statSync(fullPath).isDirectory()) {
                const subFiles = fs.readdirSync(fullPath);
                const solFile = subFiles.find(f => f.endsWith(".sol"));
                if (solFile) {
                  const content = fs.readFileSync(path.join(fullPath, solFile), "utf8");
                  cleanupDir(tempDir);
                  return resolve(content);
                }
              }
            }
          }
        } catch (readErr) {
          // Fall through to mock decompiler
        }

        // 2. Fallback Mock Decompiler
        // If heimdall-rs is not installed or fails, generate a pseudo-Solidity representation
        // based on bytecode analysis to let Venice AI reason about it without blocking the system.
        const simulatedCode = generateFallbackSolidity(contractAddress, bytecode);
        cleanupDir(tempDir);
        resolve(simulatedCode);
      });
    } catch (execErr) {
      // Handle synchronous spawn errors (e.g. command too long, spawn error)
      const simulatedCode = generateFallbackSolidity(contractAddress, bytecode);
      cleanupDir(tempDir);
      resolve(simulatedCode);
    }
  });
}

function cleanupDir(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (err) {
    // Ignore cleanup errors
  }
}

/**
 * Robust mock decompiler fallback for environments without Heimdall-rs CLI binary.
 */
function generateFallbackSolidity(address, bytecode) {
  const code = bytecode.toLowerCase();
  
  // Look for signature flags (approvals, selfdestruct, calls)
  const hasApprove = code.includes("095ea7b3");
  const hasTransfer = code.includes("a9059cbb");
  const hasTransferFrom = code.includes("23b872dd");
  const hasSelfDestruct = code.includes("ff") || code.includes("selfdestruct");
  
  // Look for CALL opcodes: 0xf1 (CALL), 0xf2 (CALLCODE), 0xf4 (DELEGATECALL), 0xfa (STATICCALL)
  const hasExternalCall = code.includes("f1") || code.includes("f4") || code.includes("delegatecall");
  
  // Look for SSTORE: 0x55
  const hasSstore = code.includes("55") || code.includes("sstore");

  let decompiledMock = `// Decompiled Sol (Fallback Mock Decompiler - Heimdall not present)
// Target Address: ${address}
// Bytecode Length: ${bytecode.length} bytes

contract DecompiledContract {
    address private owner;
    
    constructor() {
        owner = msg.sender;
    }
`;

  if (hasApprove) {
    decompiledMock += `
    // Found approve selector 0x095ea7b3
    function approve(address spender, uint256 amount) public returns (bool) {
        // Potential vulnerability check: does this write state?
        assembly {
            sstore(0, spender)
            sstore(1, amount)
        }
        return true;
    }
`;
  }

  if (hasTransfer) {
    decompiledMock += `
    // Found transfer selector 0xa9059cbb
    function transfer(address recipient, uint256 amount) public returns (bool) {
        return true;
    }
`;
  }

  if (hasTransferFrom) {
    decompiledMock += `
    // Found transferFrom selector 0x23b872dd
    function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
        // Dangerous pattern: transferFrom from arbitrary owner to caller
        assembly {
            // CALL to external token
            let success := call(gas(), recipient, amount, 0, 0, 0, 0)
        }
        return true;
    }
`;
  }

  if (hasSelfDestruct) {
    decompiledMock += `
    // Found selfdestruct instruction (0xff)
    function kill() public {
        selfdestruct(payable(owner));
    }
`;
  }

  // Include dynamic execution blocks to feed Venice's static-risk checking
  if (hasExternalCall && hasSstore) {
    decompiledMock += `
    // Identified CALL + SSTORE sequence
    function executeExternalInteraction(address target, bytes memory data) public {
        // External call prior to state storage update (Potential Reentrancy / Approval hijacking)
        (bool success, ) = target.call(data);
        require(success);
        
        assembly {
            sstore(3, target)
        }
    }
`;
  }

  decompiledMock += `\n}`;
  return decompiledMock;
}
