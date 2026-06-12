import { Markup, Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { TELEGRAM_BOT_TOKEN } from './lib/conifg';

dotenv.config();

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

const keyboard = Markup.inlineKeyboard([
    [
        Markup.button.callback('Generate Wallet', 'generate_wallet'),
    ],
    [
        Markup.button.callback('View Address', 'view_address'),
        Markup.button.callback('Export Private Key', 'export_private_key')
    ],
    [
        Markup.button.callback('Check Balance', 'check_balance'),
        Markup.button.callback('Transaction History', 'tx_history')
    ],
    [
        Markup.button.callback('Send SOL', 'send_sol_menu'),
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