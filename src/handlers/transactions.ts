import type { Context } from "telegraf";
import { store } from "../store/MemoryStore";
import { TransactionActions } from "../types/actions";
import { isValidAmount, isValidSolanaAddress } from "../utils/validators";
import { prisma } from "../lib/prisma";
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "../lib/conifg";

export function sendSolHandler(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

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

export async function sendSolHelper(ctx: Context, userId: number, text: string) {
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

            const signature = await connection.sendTransaction(transaction, [userKeypair]);

            let confirmed = false;
            for (let i = 0; i < 30; i++) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const statusResponse = await connection.getSignatureStatus(signature);
                const status = statusResponse.value;
                if (status && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')) {
                    if (status.err) {
                        throw new Error(`Transaction execution failed: ${JSON.stringify(status.err)}`);
                    }
                    confirmed = true;
                    break;
                }
            }

            if (!confirmed) {
                throw new Error("Transaction confirmation timed out. It may still be processed.");
            }

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
}