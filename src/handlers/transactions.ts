import type { Context } from "telegraf";
import { store } from "../store/MemoryStore";
import { TransactionActions, BotActions } from "../types/actions";
import { isValidAmount, isValidSolanaAddress } from "../utils/validators";
import { prisma } from "../lib/prisma";
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "../lib/conifg";
import { getMint, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction, getAccount } from "@solana/spl-token";

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

export function sendTokenHandler(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    const userWallet = store.getUser(userId);
    if (!userWallet) {
        ctx.sendMessage("You do not have a wallet yet. Please generate one first.");
        return;
    }

    ctx.sendMessage("Please share the Token Mint Address of the token you want to send...");
    store.setPendingRequest(userId, {
        type: TransactionActions.SEND_TOKEN
    });
    return;
}

export async function sendTokenHelper(ctx: Context, userId: number, text: string) {
    const pendingReq = store.getPendingRequest(userId);

    if (pendingReq && !pendingReq.mint) {
        if (!isValidSolanaAddress(text)) {
            ctx.sendMessage("Invalid Token Mint address. Please provide a valid address:");
            return;
        }
        const mintPubKey = text;
        store.updatePendingRequestMint(userId, mintPubKey);
        ctx.sendMessage("Great! Now share the recipient's address to send tokens to:");
    } else if (pendingReq && !pendingReq.to) {
        if (!isValidSolanaAddress(text)) {
            ctx.sendMessage("Invalid Solana recipient address. Please provide a valid address:");
            return;
        }
        const toPubKey = text;
        store.updatePendingRequestTo(userId, toPubKey);
        ctx.sendMessage("How many tokens do you want to send?");
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
        const mintAddress = pendingReq?.mint || '';
        ctx.sendMessage(`Initiating transaction of ${amount} tokens to ${toAddress}...`);

        let txRecord;
        try {
            txRecord = await prisma.transaction.create({
                data: {
                    user: { connect: { telegramId: userId.toString() } },
                    type: 'SEND_TOKEN',
                    amount: BigInt(0),
                    fromAddress: userKeypair.publicKey.toBase58(),
                    toAddress: toAddress,
                    meta: { mint: mintAddress },
                    status: 'PENDING'
                }
            });

            const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

            const mintPubkey = new PublicKey(mintAddress);
            const toPubkey = new PublicKey(toAddress);

            const mintInfo = await getMint(connection, mintPubkey);
            const rawAmount = amount * Math.pow(10, mintInfo.decimals);

            await prisma.transaction.update({
                where: { id: txRecord.id },
                data: { amount: BigInt(rawAmount) }
            });

            const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, userKeypair.publicKey);
            const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, toPubkey);

            try {
                const accountInfo = await getAccount(connection, fromTokenAccount);
                if (Number(accountInfo.amount) < rawAmount) {
                    throw new Error("Insufficient token balance");
                }
            } catch (err) {
                ctx.sendMessage("Insufficient token balance or token account does not exist.");
                store.deletePendingRequest(userId);
                await prisma.transaction.update({ where: { id: txRecord.id }, data: { status: 'FAILED' } });
                return;
            }

            const transaction = new Transaction();

            const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
            if (!toAccountInfo) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        userKeypair.publicKey,
                        toTokenAccount,
                        toPubkey,
                        mintPubkey
                    )
                );
            }

            transaction.add(
                createTransferInstruction(
                    fromTokenAccount,
                    toTokenAccount,
                    userKeypair.publicKey,
                    BigInt(rawAmount)
                )
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

            ctx.sendMessage(`Token transfer successful! \nSignature: ${signature}`);
        } catch (err) {
            console.error("Token Transaction failed:", err);
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

export async function transactionHistoryHandler(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    let limit = 5;
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        const prefix = TransactionActions.TX_HISTORY + '_';
        if (data.startsWith(prefix)) {
            limit = parseInt(data.replace(prefix, ''), 10);
        }
    }

    try {
        const transactions = await prisma.transaction.findMany({
            where: { user: { telegramId: userId.toString() } },
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        if (transactions.length === 0) {
            ctx.sendMessage("You have no transaction history.");
            return;
        }

        let tableStr = `<pre>Type      | Amount | Status\n-------------------------------\n`;
        for (const tx of transactions) {
            const typeStr = tx.type === 'SEND_SOL' ? 'SOL' : 'TOKEN';

            let formattedAmount = '';
            if (tx.type === 'SEND_SOL') {
                formattedAmount = (Number(tx.amount) / LAMPORTS_PER_SOL).toFixed(2);
            } else {
                formattedAmount = "TOKEN";
            }

            const typePadded = typeStr.padEnd(9);
            const amtPadded = formattedAmount.padEnd(6);
            const statusStr = tx.status === 'CONFIRMED' ? 'OK' : (tx.status === 'FAILED' ? 'FAIL' : 'PEND');

            tableStr += `${typePadded} | ${amtPadded} | ${statusStr}\n`;
        }
        tableStr += `</pre>`;

        const inlineKeyboard = [];
        const limits = [10, 15, 20];
        const row = [];
        for (const l of limits) {
            if (limit < l) {
                row.push({ text: `Last ${l}`, callback_data: `${TransactionActions.TX_HISTORY}_${l}` });
            }
        }
        if (row.length > 0) inlineKeyboard.push(row);
        inlineKeyboard.push([{ text: 'Back to Main Menu', callback_data: BotActions.BACK_TO_MAIN }]);

        await ctx.reply(tableStr, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: inlineKeyboard
            }
        });

    } catch (err) {
        console.error("Failed to fetch history:", err);
        ctx.sendMessage("Failed to fetch transaction history.");
    }
}