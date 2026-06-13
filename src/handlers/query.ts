import type { Context } from "telegraf";
import { primaryKeyboard } from "../lib/keyboards";
import { store } from "../store/MemoryStore";
import { TransactionActions } from "../types/actions";
import { prisma } from "../lib/prisma";

const WELCOME_MESSAGE = (name: string | undefined): string => `Welcome ${name || "User"}! I am Sukora. I can help you manage your Solana wallet, check your balance, and send SOL or tokens. Please use the buttons below to navigate through the options.`;

export function botStartHandler(ctx: Context) {
    const userId = ctx.from?.id;
    const name = ctx.from?.first_name;
    if(!userId) return;

    prisma.user.upsert({
        where: { telegramId: userId.toString() },
        update: { firstName: name },
        create: { telegramId: userId.toString(), firstName: name }
    }).catch(err => console.error("Failed to upsert user", err));

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
                // Create a txn and forward it to the blockchain (blockchain logic pending)
                prisma.transaction.create({
                    data: {
                        user: { connect: { telegramId: userId.toString() } },
                        type: 'SEND_SOL',
                        amount: BigInt(amount), // Assuming amount is in lamports, or parse appropriately
                        fromAddress: store.getUser(userId)?.publicKey.toBase58() || '',
                        toAddress: pendingReq?.to || '',
                        status: 'PENDING'
                    }
                }).catch(err => console.error("Failed to create transaction", err));

                ctx.sendMessage(`Initiated a txn for ${amount} SOL to ${pendingReq?.to}`);
                store.deletePendingRequest(userId);
            }
        } else {
            ctx.sendMessage("Please send a text message with the required information.");
        }
    }
}