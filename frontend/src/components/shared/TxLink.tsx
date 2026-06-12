import { ExternalLink } from 'lucide-react';

interface TxLinkProps {
  txHash: string;
  /** Displayed label — defaults to truncated hash */
  label?: string;
  className?: string;
}

/**
 * Renders a clickable BaseScan link for a given transaction hash.
 * Opens in a new tab. Safe for null/empty hashes (renders nothing).
 */
export function TxLink({ txHash, label, className = '' }: TxLinkProps) {
  if (!txHash || txHash.startsWith('0xdemo') || txHash === '0x') {
    // Demo / empty hash — show greyed out label with no link
    return (
      <span className={`font-mono text-xs text-gray-600 ${className}`}>
        {label ?? shortHash(txHash)}
      </span>
    );
  }

  const url = `https://basescan.org/tx/${txHash}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 font-mono text-xs text-[#19C978] hover:text-white transition-colors underline decoration-[#19C978]/30 hover:decoration-white/50 ${className}`}
      title={txHash}
    >
      {label ?? shortHash(txHash)}
      <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
    </a>
  );
}

/** Returns a shortened "0x1234…abcd" display string */
function shortHash(hash: string): string {
  if (!hash || hash.length < 12) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}
