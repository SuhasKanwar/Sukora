import type { Context } from "telegraf";
import { store } from "../store/MemoryStore";
import { TransactionActions } from "../types/actions";

export function sendSolHandler(ctx: Context) {
    ctx.sendMessage("Can you share the address to send to...");
    const userId = ctx.from?.id;
    if(!userId) return;
    store.setPendingRequest(userId, {
        type: TransactionActions.SEND_SOL
    });
    return;
}