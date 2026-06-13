import type { Context } from "telegraf";
import { primaryKeyboard } from "../lib/keyboards";
import { store } from "../store/MemoryStore";
import { TransactionActions } from "../types/actions";

const WELCOME_MESSAGE = (name: string | undefined): string => `Welcome ${name || "User"}! I am Sukora. I can help you manage your Solana wallet, check your balance, and send SOL or tokens. Please use the buttons below to navigate through the options.`;

export function botStartHandler(ctx: Context) {
    const userId = ctx.from?.id;
    const name = ctx.from?.first_name;
    if(!userId) return;

    return ctx.reply(WELCOME_MESSAGE(name), {
        parse_mode: 'Markdown',
        ...primaryKeyboard
    });
}

export function botBackToMainHandler(ctx: Context) {
    const userId = ctx.from?.id;
    if(!userId) return;

    return ctx.sendMessage("Let me know what you want to do", {
        parse_mode: 'Markdown',
        ...primaryKeyboard
    });
}

// TODO: Validation needs to be handeled
export function botTextMessageHandler(ctx: Context) {
    const userId = ctx.from?.id;
    if(!userId) return;
    if (store.getPendingRequest(userId)?.type === TransactionActions.SEND_SOL) {
        const msg = ctx.message;
        if (!msg) return;

        if ("text" in msg && typeof msg.text === 'string') {
            const text = msg.text.trim();
            const pendingReq = store.getPendingRequest(userId);
            if (pendingReq && !pendingReq.to) {
                // TODO: Check whether the public key is valid or not
                const toPubKey = text;
                store.updatePendingRequestTo(userId, toPubKey);
                ctx.sendMessage("How much SOL do you want to send?");
            } else {
                const amount = text;
                // TODO: Create a txn and forward it to the blockchain
                ctx.sendMessage(`Initiated a txn for ${amount} SOL to ${pendingReq?.to}`);
                store.deletePendingRequest(userId);
            }
        } else {
            ctx.sendMessage("Please send a text message with the required information.");
        }
    }
}