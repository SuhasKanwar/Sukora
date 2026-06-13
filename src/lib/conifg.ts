export const TELEGRAM_BOT_TOKEN: string = process.env.TELEGRAM_BOT_TOKEN || '';
export const DATABASE_URL: string = process.env.DATABASE_URL || '';
export const ENCRYPTION_KEY: string = process.env.ENCRYPTION_KEY || 'default_secret_key_needs_32_bytes!';

const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet';
export const SOLANA_RPC_URL: string = SOLANA_NETWORK === 'mainnet' 
    ? (process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com')
    : (process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com');