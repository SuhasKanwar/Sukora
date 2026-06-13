import { Markup } from 'telegraf';
import { WalletActions, TransactionActions, BotActions } from '../types/actions';

const btn = (label: string, action: string) => Markup.button.callback(label, action);

export const primaryKeyboard = Markup.inlineKeyboard([
  [btn('Generate Wallet', WalletActions.GENERATE_WALLET)],
  [
    btn('Show Public Key', WalletActions.SHOW_PUB_KEY),
  ],
  [
    btn('Check Balance', WalletActions.CHECK_BALANCE),
    btn('Transaction History', TransactionActions.TX_HISTORY),
  ],
  [
    btn('Send SOL', TransactionActions.SEND_SOL),
    btn('Send Token', TransactionActions.SEND_TOKEN),
  ],
]);

export const generateWalletKeyboard = Markup.inlineKeyboard([
  [btn('Generate Wallet', WalletActions.GENERATE_WALLET)],
  [btn('Back to Main Menu', BotActions.BACK_TO_MAIN)],
]);

export const confirmationKeyboard = Markup.inlineKeyboard([
  [btn('Confirm', BotActions.CONFIRM)],
  [btn('Cancel', BotActions.CANCEL)],
]);