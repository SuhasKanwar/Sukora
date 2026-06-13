import { Keypair } from "@solana/web3.js";
import type { Context } from "telegraf";
import { store } from "../store/MemoryStore";
import { generateWalletKeyboard, primaryKeyboard } from "../lib/keyboards";

export function generateWalletHandler(ctx: Context) {
    ctx.answerCbQuery("Generating new Wallet...");
    const userId = ctx.from?.id;
    if(!userId) return;
    const keypair = Keypair.generate();
    store.setUser(userId, keypair);
    ctx.sendMessage(`New wallet created for you with the public key: ${keypair.publicKey.toBase58()}`, {
        parse_mode: 'Markdown',
        ...primaryKeyboard
    })
}

export function showPublicKeyHandler(ctx: Context) {
    ctx.answerCbQuery("Getting your public key...");
    const userId = ctx.from?.id;
    if(!userId) return;
    const keypair = store.getUser(userId);
    if(!keypair) {
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