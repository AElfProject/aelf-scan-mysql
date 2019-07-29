/**
 * @file utils.js
 * @author atom-yang
 * @date 2019-07-22
 */
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
  const { To, MethodName } = transaction.Transaction;
  return To === config.contracts.resource && (MethodName === 'Buy' || MethodName === 'Sell');
}

// 是否为创建token的交易，进入contract_aelf20表中
function isTokenCreatedTransaction(transaction) {
  return !!(transaction.Status === 'Mined'
    && transaction.Transaction
    && transaction.Transaction.To === config.contracts.token
    && transaction.Transaction.MethodName === 'Create');
}

// 是否为对token相关的交易，token转移等
function isTokenRelatedTransaction(transaction) {
  const relatedMethodName = ['Initialize', 'Transfer', 'InitialBalance', 'Create'];
  return !!(transaction.Transaction
    && transaction.Transaction.To === config.contracts.token
    && relatedMethodName.includes(transaction.Transaction.MethodName));
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

module.exports = {
  isProd,
  isResourceTransaction,
  isTokenCreatedTransaction,
  isTokenRelatedTransaction,
  execCommand
};
