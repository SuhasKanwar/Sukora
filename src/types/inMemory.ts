import type { Keypair } from "@solana/web3.js";
import type { TransactionActions } from "./actions";

export type Users = Record<string, Keypair>;

export type PendingRequestEntry = {
    type: TransactionActions.SEND_SOL | TransactionActions.SEND_TOKEN;
    amount?: number;
    to?: string;
    mint?: string;
};

export type PendingRequestsType = Record<string, PendingRequestEntry | undefined>;