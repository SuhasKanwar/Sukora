import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { TELEGRAM_BOT_TOKEN } from './lib/conifg';
import { message } from 'telegraf/filters';
import type { Users, PendingRequestsType } from './types/inMemory';
import { BotActions, TransactionActions, WalletActions } from './types/actions';
import { botBackToMainHandler, botStartHandler, botTextMessageHandler } from './handlers/query';
import { generateWalletHandler, showPublicKeyHandler } from './handlers/wallet';
import { sendSolHandler } from './handlers/transactions';

dotenv.config();

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

export const USERS: Users = {};
export const PENDING_REQUESTS: PendingRequestsType = {}; 

bot.start(async (ctx) => botStartHandler(ctx));

bot.action(BotActions.BACK_TO_MAIN, async (ctx) => botBackToMainHandler(ctx));

bot.action(WalletActions.GENERATE_WALLET, async (ctx) => generateWalletHandler(ctx));
bot.action(WalletActions.SHOW_PUB_KEY, async (ctx) => showPublicKeyHandler(ctx));

bot.action(TransactionActions.SEND_SOL, (ctx) => sendSolHandler(ctx));

bot.on(message("text"), async (ctx) => botTextMessageHandler(ctx));

async function startBot(): Promise<void> {
    try {
        await bot.launch({
            allowedUpdates: ['message', 'callback_query']
        });
    } catch (err) {
        console.error("Failed to start the bot", err);
        process.exit(1);
    }
}

startBot();