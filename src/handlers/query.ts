import type { Context } from "telegraf";
import { primaryKeyboard } from "../lib/keyboards";
import { store } from "../store/MemoryStore";
import { TransactionActions } from "../types/actions";
import { prisma } from "../lib/prisma";
import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { isValidSolanaAddress, isValidAmount } from "../utils/validators";
import { SOLANA_RPC_URL } from "../lib/conifg";

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

export async function botTextMessageHandler(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;
    if (store.getPendingRequest(userId)?.type === TransactionActions.SEND_SOL) {
        const msg = ctx.message;
        if (!msg) return;

        if ("text" in msg && typeof msg.text === 'string') {
            const text = msg.text.trim();
            const pendingReq = store.getPendingRequest(userId);

            if (pendingReq && !pendingReq.to) {
                if (!isValidSolanaAddress(text)) {
                    ctx.sendMessage("Invalid Solana address. Please provide a valid address:");
                    return;
                }
                const toPubKey = text;
                store.updatePendingRequestTo(userId, toPubKey);
                ctx.sendMessage("How much SOL do you want to send?");
            } else {
                if (!isValidAmount(text)) {
                    ctx.sendMessage("Invalid amount. Please provide a valid number:");
                    return;
                }

                const amount = Number(text);
                const userKeypair = store.getUser(userId);

                if (!userKeypair) {
                    ctx.sendMessage("You don't have a wallet to send from.");
                    store.deletePendingRequest(userId);
                    return;
                }

                const toAddress = pendingReq?.to || '';
                ctx.sendMessage(`Initiating transaction of ${amount} SOL to ${toAddress}...`);

                let txRecord;
                try {
                    txRecord = await prisma.transaction.create({
                        data: {
                            user: { connect: { telegramId: userId.toString() } },
                            type: 'SEND_SOL',
                            amount: BigInt(amount * LAMPORTS_PER_SOL),
                            fromAddress: userKeypair.publicKey.toBase58(),
                            toAddress: toAddress,
                            status: 'PENDING'
                        }
                    });

                    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

                    const balance = await connection.getBalance(userKeypair.publicKey);
                    const transferAmountLamports = amount * LAMPORTS_PER_SOL;
                    if (balance < transferAmountLamports + 5000) {
                        ctx.sendMessage(`Insufficient funds. Your current balance is ${balance / LAMPORTS_PER_SOL} SOL, which cannot cover the amount + network fees.`);
                        store.deletePendingRequest(userId);

                        if (txRecord) {
                            await prisma.transaction.update({
                                where: { id: txRecord.id },
                                data: { status: 'FAILED' }
                            });
                        }
                        return;
                    }

                    const transaction = new Transaction().add(
                        SystemProgram.transfer({
                            fromPubkey: userKeypair.publicKey,
                            toPubkey: new PublicKey(toAddress),
                            lamports: amount * LAMPORTS_PER_SOL
                        })
                    );

                    const signature = await sendAndConfirmTransaction(connection, transaction, [userKeypair]);

                    await prisma.transaction.update({
                        where: { id: txRecord.id },
                        data: {
                            status: 'CONFIRMED',
                            txHash: signature,
                            confirmedAt: new Date()
                        }
                    });

                    ctx.sendMessage(`Transaction successful! \nSignature: ${signature}`);
                } catch (err) {
                    console.error("Transaction failed:", err);
                    if (txRecord) {
                        await prisma.transaction.update({
                            where: { id: txRecord.id },
                            data: { status: 'FAILED' }
                        });
                    }
                    ctx.sendMessage("Transaction failed. Please try again.");
                } finally {
                    store.deletePendingRequest(userId);
                }
            }
        } else {
            ctx.sendMessage("Please send a text message with the required information.");
        }
    }
}