import type { Context } from "telegraf";
import { store } from "../store/MemoryStore";
import { TransactionActions } from "../types/actions";

export function sendSolHandler(ctx: Context) {
    const userId = ctx.from?.id;
    if(!userId) return;

    const userWallet = store.getUser(userId);
    if (!userWallet) {
        ctx.sendMessage("You do not have a wallet yet. Please generate one first.");
        return;
    }

    ctx.sendMessage("Can you share the address to send to...");
    store.setPendingRequest(userId, {
        type: TransactionActions.SEND_SOL
    });
    return;
}