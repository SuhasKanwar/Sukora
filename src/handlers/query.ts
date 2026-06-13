import type { Context } from "telegraf";
import { primaryKeyboard } from "../lib/keyboards";
import { store } from "../store/MemoryStore";
import { TransactionActions } from "../types/actions";
import { prisma } from "../lib/prisma";
import { sendSolHelper } from "./transactions";

const WELCOME_MESSAGE = (name: string | undefined): string => `Welcome ${name || "User"}! I am Sukora. I can help you manage your Solana wallet, check your balance, and send SOL or tokens. Please use the buttons below to navigate through the options.`;

export function botStartHandler(ctx: Context) {
    const userId = ctx.from?.id;
    const name = ctx.from?.first_name;
    if (!userId) return;

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
    if (!userId) return;

    return ctx.sendMessage("Let me know what you want to do", {
        parse_mode: 'Markdown',
        ...primaryKeyboard
    });
}

export function botMenuHandler(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    return ctx.reply("Here is the main menu:", {
        parse_mode: 'Markdown',
        ...primaryKeyboard
    });
}

export async function botTextMessageHandler(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    const msg = ctx.message;
    if (!msg || !("text" in msg) || typeof msg.text !== 'string') {
        ctx.sendMessage("Please send a valid text message.");
        return;
    }

    const text = msg.text.trim();
    const pendingRequest = store.getPendingRequest(userId);

    if (pendingRequest?.type === TransactionActions.SEND_SOL) {
        await sendSolHelper(ctx, userId, text);
    } else {
        ctx.sendMessage("I didn't understand that. Please use the menu to select an action.", {
            parse_mode: 'Markdown',
            ...primaryKeyboard
        });
    }
}