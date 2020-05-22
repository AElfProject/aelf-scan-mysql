/**
 * @file utils.js
 * @author atom-yang
 * @date 2019-07-22
 */
const AElf = require('aelf-sdk');
const { exec } = require('child_process');

const isProd = process.env.NODE_ENV === 'production';

let config = {};
if (isProd) {
  // eslint-disable-next-line global-require
  config = require('../../config.prod');
} else {
  // eslint-disable-next-line global-require
  config = require('../../config.dev');
}

function isResourceTransaction(transaction) {
  if (!config.contracts.resource) {
    return false;
  }
  const {
    Logs,
    Transaction
  } = transaction;
  const { To, MethodName } = Transaction;
  return (
    To === config.contracts.resource && (MethodName === 'Buy' || MethodName === 'Sell')
    || (Logs || []).filter(v => v.Name === 'TokenBought' || v.Name === 'TokenSold').length > 0);
}

// 是否为创建token的交易，进入contract_aelf20表中
function isTokenCreatedTransaction(transaction) {
  return !!(transaction.Status === 'Mined'
    && Array.isArray(transaction.Logs)
    && transaction.Logs.filter(log => log.Name === 'TokenCreated'
      && log.Address === config.contracts.token));
}

// 是否为对token相关的交易，token转移等
function isTokenRelatedTransaction(transaction) {
  const methods = [
    'Transfer',
    'TransferFrom',
    'Issue',
    'Create',
    'CrossChainTransfer',
    'CrossChainReceiveToken'
  ];
  return !!(transaction.Transaction
    && transaction.Transaction.To === config.contracts.token
    && methods.includes(transaction.Transaction.MethodName)
  );
}

function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(err);
        return;
      }
      resolve([stdout, stderr]);
    });
  });
}

function getFee(transaction) {
  const elfFee = AElf.pbUtils.getTransactionFee(transaction.Logs || []);
  const resourceFees = AElf.pbUtils.getResourceFee(transaction.Logs || []);
  return {
    elf: elfFee.length === 0 ? 0 : (+elfFee[0].amount / 1e8),
    resources: resourceFees.map(v => ({
      ...v,
      amount: (+v.amount / 1e8)
    })).reduce((acc, v) => ({
      ...acc,
      [v.symbol]: v.amount
    }), {})
  };
}
const TOKEN_DECIMALS = {
  ELF: 8
};
async function getDecimal(symbol) {
  if (!TOKEN_DECIMALS[symbol]) {
    const {
      decimals = 8
    } = await config.token.GetTokenInfo.call({
      symbol
    });
    TOKEN_DECIMALS[symbol] = decimals;
  }
  return TOKEN_DECIMALS[symbol] || 8;
}
async function getDividend(height) {
  let dividends = await config.dividend.GetDividends.call({
    value: height
  });
  dividends = dividends && dividends.value ? dividends.value : {};
  const decimals = await Promise.all(Object.keys(dividends).map(getDecimal));
  return Object.keys(dividends).reduce((acc, v, i) => ({
    ...acc,
    [v]: +dividends[v] / `1e${decimals[i]}`
  }), {});
}

module.exports = {
  isProd,
  isResourceTransaction,
  isTokenCreatedTransaction,
  isTokenRelatedTransaction,
  execCommand,
  getFee,
  getDividend
};
