import { Markup, Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { TELEGRAM_BOT_TOKEN } from './lib/conifg';
import { Keypair } from '@solana/web3.js';
import { message } from 'telegraf/filters';

dotenv.config();

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

const USERS: Record<string, Keypair> = {};
interface PendingRequestType {
    type: "SEND_SOL" | "SEND_TOKEN",
    amount?: number,
    to?: string
}
const PENDING_REQUESTS: Record<string, PendingRequestType> = {}; 

const keyboard = Markup.inlineKeyboard([
    [
        Markup.button.callback('Generate Wallet', 'generate_wallet'),
    ],
    [
        Markup.button.callback('Show Public Key', 'show_pub_key'),
        Markup.button.callback('Export Private Key', 'export_private_key')
    ],
    [
        Markup.button.callback('Check Balance', 'check_balance'),
        Markup.button.callback('Transaction History', 'tx_history')
    ],
    [
        Markup.button.callback('Send SOL', 'send_sol'),
        Markup.button.callback('Send Token', 'send_token_menu')
    ]
])

bot.start(async (ctx) => {
    const userId = ctx.from?.id;
    if(!userId) return;

    let welcomeMssg = `Welcome to solana Sukora Bot!!!`;

    return ctx.reply(welcomeMssg, {
        parse_mode: 'Markdown',
        ...keyboard
    });
});

bot.action('generate_wallet', async (ctx) => {
    ctx.answerCbQuery("Generating new Wallet...");
    const userId = ctx.from?.id;
    const keypair = Keypair.generate();
    USERS[userId] = keypair;

    ctx.sendMessage(`New wallet created for you with the public key: ${keypair.publicKey.toBase58()}`)
});

bot.action('show_pub_key', async (ctx) => {
    ctx.answerCbQuery("Getting your public key...");
    const userId = ctx.from?.id;
    const keypair = USERS[userId];
    if(!keypair) {
        ctx.sendMessage("You do not have a wallet with us yet, please click on the 'Generate Wallet' button first to create one", {
            parse_mode: 'Markdown',
            ...keyboard
        });
        return;
    }

    ctx.sendMessage(`Public Key: ${keypair.publicKey.toBase58()}`);
});

bot.action("send_sol", (ctx) => {
    ctx.sendMessage("Can you share the address to send to...");
    const userId = ctx.from?.id;
    PENDING_REQUESTS[userId] = {
        type: "SEND_SOL"
    };
});

// TODO: Validation needs to be handeled
bot.on(message("text"), async (ctx) => {
    const userId = ctx.from?.id;
    if(PENDING_REQUESTS[userId]?.type == "SEND_SOL") {
        if(PENDING_REQUESTS[userId] && !PENDING_REQUESTS[userId].to) {
            // TODO: Check whether the public key is valid or not
            const toPubKey = ctx.message.text.toString().trim();
            PENDING_REQUESTS[userId].to = toPubKey;
            ctx.sendMessage("How much SOL do you want to send?");
        } else {
            const amount = ctx.message.text;
            // TODO: Create a txn and forward it to the blockchain
            ctx.sendMessage(`Initiated a txn for ${amount} SOL to ${PENDING_REQUESTS[userId].to}`);
            delete PENDING_REQUESTS[userId];
        }
    }
});

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