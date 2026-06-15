CREATE TABLE IF NOT EXISTS "approval_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_address" text NOT NULL,
	"token_address" text NOT NULL,
	"spender_address" text NOT NULL,
	"allowance" numeric(78, 0) NOT NULL,
	"last_scanned_block" bigint NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_spender_token_unique" UNIQUE("user_address","spender_address","token_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_scan_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_address" text NOT NULL,
	"bytecode_hash" text NOT NULL,
	"block_number" bigint NOT NULL,
	"vulnerable" boolean NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"verdict" text NOT NULL,
	"static_risk" text NOT NULL,
	"static_flags" text[] NOT NULL,
	"explainer" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contract_scan_log_contract_address_unique" UNIQUE("contract_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_address" text NOT NULL,
	"permission_context" text NOT NULL,
	"delegation_hash" text NOT NULL,
	"session_signer_address" text NOT NULL,
	"budget_cap" numeric(78, 0) NOT NULL,
	"budget_spent" numeric(78, 0) DEFAULT '0' NOT NULL,
	"security_profile" text DEFAULT 'balanced' NOT NULL,
	"grant_method" text,
	"fee_allowance_approved" boolean DEFAULT false NOT NULL,
	"expiry" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_registry_user_address_unique" UNIQUE("user_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "protection_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_address" text NOT NULL,
	"token_address" text NOT NULL,
	"spender_address" text NOT NULL,
	"exposed_value" numeric(78, 0) NOT NULL,
	"action_type" text NOT NULL,
	"relay_tx_hash" text,
	"relay_status" text NOT NULL,
	"severity" text NOT NULL,
	"veto_cancelled" boolean DEFAULT false NOT NULL,
	"staged_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_address" text NOT NULL,
	"telegram_id" bigint NOT NULL,
	"username" text,
	"verified" boolean DEFAULT false NOT NULL,
	"nonce" text,
	"alerts_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_links_user_address_unique" UNIQUE("user_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "threat_intel_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bytecode_hash" text NOT NULL,
	"bytecode" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "threat_intel_catalog_bytecode_hash_unique" UNIQUE("bytecode_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_whitelist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_address" text NOT NULL,
	"address" text NOT NULL,
	"protocol_name" text DEFAULT 'Custom' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_whitelist_user_address_unique" UNIQUE("user_address","address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whitelist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"protocol_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whitelist_address_unique" UNIQUE("address")
);
