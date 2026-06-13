import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { TELEGRAM_BOT_TOKEN } from './lib/conifg';
import { message } from 'telegraf/filters';
import { BotActions, TransactionActions, WalletActions } from './types/actions';
import { botBackToMainHandler, botStartHandler, botTextMessageHandler } from './handlers/query';
import { generateWalletHandler, showPublicKeyHandler } from './handlers/wallet';
import { sendSolHandler } from './handlers/transactions';

import { prisma } from './lib/prisma';
import { Keypair } from '@solana/web3.js';
import { decrypt } from './lib/encryption';
import { store } from './store/MemoryStore';

dotenv.config();

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

bot.start(async (ctx) => botStartHandler(ctx));

bot.action(BotActions.BACK_TO_MAIN, async (ctx) => botBackToMainHandler(ctx));

bot.action(WalletActions.GENERATE_WALLET, async (ctx) => generateWalletHandler(ctx));
bot.action(WalletActions.SHOW_PUB_KEY, async (ctx) => showPublicKeyHandler(ctx));

bot.action(TransactionActions.SEND_SOL, (ctx) => sendSolHandler(ctx));

bot.on(message("text"), async (ctx) => botTextMessageHandler(ctx));

async function loadWalletsIntoMemory() {
    try {
        console.log("Loading wallets from DB into memory...");
        const wallets = await prisma.wallet.findMany({
            include: { user: true }
        });

        let loadedCount = 0;
        for (const wallet of wallets) {
            if (wallet.encryptedSecretKey && wallet.user.telegramId) {
                try {
                    const secretKeyHex = decrypt(wallet.encryptedSecretKey);
                    const secretKeyArray = new Uint8Array(Buffer.from(secretKeyHex, 'hex'));
                    const keypair = Keypair.fromSecretKey(secretKeyArray);
                    store.setUser(wallet.user.telegramId, keypair);
                    loadedCount++;
                } catch (err) {
                    console.error(`Failed to decrypt/load wallet for user ${wallet.user.telegramId}`, err);
                }
            }
        }
        console.log(`Successfully loaded ${loadedCount} wallets into memory.`);
    } catch (err) {
        console.error("Failed to load wallets from DB", err);
    }
}

async function startBot(): Promise<void> {
    try {
        await loadWalletsIntoMemory();
        await bot.launch({
            allowedUpdates: ['message', 'callback_query']
        });
    } catch (err) {
        console.error("Failed to start the bot", err);
        process.exit(1);
    }
}

startBot();