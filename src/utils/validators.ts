import { PublicKey } from '@solana/web3.js';

export function isValidSolanaAddress(address: string): boolean {
    try {
        const pubkey = new PublicKey(address);
        return PublicKey.isOnCurve(pubkey.toBuffer());
    } catch (e) {
        return false;
    }
}

export function isValidAmount(amountStr: string): boolean {
    const amount = Number(amountStr);
    return !isNaN(amount) && amount > 0;
}