import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { Context } from "telegraf";
import { store } from "../store/MemoryStore";
import { generateWalletKeyboard, primaryKeyboard } from "../lib/keyboards";
import { prisma } from "../lib/prisma";
import { encrypt } from "../lib/encryption";
import { SOLANA_RPC_URL } from "../lib/conifg";

export async function generateWalletHandler(ctx: Context) {
    ctx.answerCbQuery("Generating new Wallet...");
    const userId = ctx.from?.id;
    if (!userId) return;

    const existingWallet = await prisma.wallet.findFirst({
        where: { user: { telegramId: userId.toString() } }
    });

    if (existingWallet) {
        ctx.sendMessage("You already have a wallet linked to your account.", {
            parse_mode: 'Markdown',
            ...primaryKeyboard
        });
        return;
    }

    const keypair = Keypair.generate();

    try {
        await prisma.wallet.create({
            data: {
                user: { connect: { telegramId: userId.toString() } },
                publicKey: keypair.publicKey.toBase58(),
                encryptedSecretKey: encrypt(Buffer.from(keypair.secretKey).toString('hex'))
            }
        });
        store.setUser(userId, keypair);
        ctx.sendMessage(`New wallet created for you with the public key: ${keypair.publicKey.toBase58()}`, {
            parse_mode: 'Markdown',
            ...primaryKeyboard
        });
    } catch (err) {
        console.error("Failed to save wallet to DB", err);
        ctx.sendMessage("Failed to generate wallet. Please try again.", {
            parse_mode: 'Markdown',
            ...primaryKeyboard
        });
    }
}

export function showPublicKeyHandler(ctx: Context) {
    ctx.answerCbQuery("Getting your public key...");
    const userId = ctx.from?.id;
    if (!userId) return;
    const keypair = store.getUser(userId);
    if (!keypair) {
        ctx.sendMessage("You do not have a wallet with us yet, please click on the 'Generate Wallet' button first to create one", {
            parse_mode: 'Markdown',
            ...generateWalletKeyboard
        });
        return;
    }

    ctx.sendMessage(`Public Key: ${keypair.publicKey.toBase58()}`, {
        parse_mode: 'Markdown',
        ...primaryKeyboard
    });
}

export async function checkBalanceHandler(ctx: Context) {
    ctx.answerCbQuery("Checking your balance...");
    const userId = ctx.from?.id;
    if (!userId) return;

    const keypair = store.getUser(userId);
    if (!keypair) {
        ctx.sendMessage("You do not have a wallet with us yet, please click on the 'Generate Wallet' button first to create one", {
            parse_mode: 'Markdown',
            ...generateWalletKeyboard
        });
        return;
    }

    try {
        const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
        const balanceLamports = await connection.getBalance(keypair.publicKey);
        const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;

        ctx.sendMessage(`Your current balance is: *${balanceSOL} SOL*`, {
            parse_mode: 'Markdown',
            ...primaryKeyboard
        });
    } catch (err) {
        console.error("Failed to fetch balance:", err);
        ctx.sendMessage("Failed to check balance. Please try again later.", {
            ...primaryKeyboard
        });
    }
}