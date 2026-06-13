import type { Context } from "telegraf";
import { PENDING_REQUESTS } from "..";
import { TransactionActions } from "../types/actions";

export function sendSolHandler(ctx: Context) {
    ctx.sendMessage("Can you share the address to send to...");
    const userId = ctx.from?.id;
    if(!userId) return;
    PENDING_REQUESTS[userId] = {
        type: TransactionActions.SEND_SOL
    };
    return;
}