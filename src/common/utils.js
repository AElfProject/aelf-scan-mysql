/**
 * @file utils.js
 * @author atom-yang
 * @date 2019-07-22
 */
const AElf = require('aelf-sdk');
const moment = require('moment');
const Decimal = require('decimal.js');
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

function isOldTokenCreatedTransaction(transaction) {
  return (transaction.Status.toUpperCase() === 'MINED'
    && transaction.Transaction
    && transaction.Transaction.To === config.contracts.token
    && transaction.Transaction.MethodName === 'Create');
}

// 是否为创建token的交易，进入contract_aelf20表中
function isTokenCreatedTransaction(transaction) {
  return (transaction.Status.toUpperCase() === 'MINED'
    && Array.isArray(transaction.Logs)
    && transaction.Logs.filter(log => log.Name === 'TokenCreated'
      && log.Address === config.contracts.token)).length > 0 || isOldTokenCreatedTransaction(transaction);
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

async function getFee(transaction) {
  const fee = AElf.pbUtils.getTransactionFee(transaction.Logs || []);
  const resourceFees = AElf.pbUtils.getResourceFee(transaction.Logs || []);
  const feeDecimals = await Promise.all(fee.map(f => getDecimal(f.symbol)));
  const resourceDecimals = await Promise.all(resourceFees.map(f => getDecimal(f.symbol)));
  return {
    fee: fee.map((v, i) => ({
      ...v,
      amount: new Decimal(v.amount).dividedBy(`1e${feeDecimals[i] || 8}`).toNumber()
    })).reduce((acc, v) => ({
      ...acc,
      [v.symbol]: v.amount
    }), {}),
    resources: resourceFees.map((v, i) => ({
      ...v,
      amount: new Decimal(v.amount).dividedBy(`1e${resourceDecimals[i] || 8}`).toNumber()
    })).reduce((acc, v) => ({
      ...acc,
      [v.symbol]: v.amount
    }), {})
  };
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

const SYMBOL_EVENTS = [
  'RentalCharged',
  'RentalAccountBalanceInsufficient',
  'TokenCreated',
  'Issued',
  'CrossChainTransferred',
  'CrossChainReceived',
  'DonationReceived',
  'Burned',
  'Approved',
  'UnApproved',
  'ChainPrimaryTokenSymbolSet',
  'TokenSold',
  'TokenBought'
];

function isSymbolEvent(transaction) {
  const {
    Logs = []
  } = transaction;
  return (Logs || []).filter(({ Address, Name }) => (
    Address === config.contracts.token
    || Address === config.contracts.tokenConverter
    || Address === config.contracts.crossChain)
    && SYMBOL_EVENTS.includes(Name));
}

const protos = {};

async function getProto(address) {
  if (!protos[address]) {
    const p = AElf.pbjs.Root.fromDescriptor(await config.aelf.chain.getContractFileDescriptorSet(address));
    protos[address] = p;
  }
  return protos[address];
}

async function deserializeLogs(logs = [], logName) {
  if (!logs || logs.length === 0) {
    return [];
  }
  const filteredLogs = logs.filter(({ Name }) => logName === Name);
  let results = await Promise.all(filteredLogs.map(v => getProto(v.Address)));
  results = results.map((proto, index) => {
    const {
      Address,
      Name: dataTypeName,
      NonIndexed,
      Indexed = []
    } = filteredLogs[index];
    const dataType = proto.lookupType(dataTypeName);
    const serializedData = [...(Indexed || [])];
    if (NonIndexed) {
      serializedData.push(NonIndexed);
    }
    let deserializeLogResult = serializedData.reduce((acc, v) => {
      let deserialize;
      try {
        deserialize = dataType.decode(Buffer.from(v, 'base64'));
      } catch (e) {
        deserialize = '';
      }
      deserialize = dataType.toObject(deserialize, {
        enums: String, // enums as string names
        longs: String, // longs as strings (requires long.js)
        bytes: String, // bytes as base64 encoded strings
        defaults: false, // includes default values
        arrays: true, // populates empty arrays (repeated fields) even if defaults=false
        objects: true, // populates empty objects (map fields) even if defaults=false
        oneofs: true // includes virtual oneof fields set to the present field's name
      });
      return {
        ...acc,
        ...deserialize
      };
    }, {});
    // eslint-disable-next-line max-len
    deserializeLogResult = AElf.utils.transform.transform(dataType, deserializeLogResult, AElf.utils.transform.OUTPUT_TRANSFORMERS);
    deserializeLogResult = AElf.utils.transform.transformArrayToMap(dataType, deserializeLogResult);
    return {
      contractAddress: Address,
      deserializeLogResult,
      name: dataTypeName
    };
  });
  return results;
}

function formatTime(time) {
  return moment(time).utcOffset(0).format('YYYY-MM-DD HH:mm:ss');
}

module.exports = {
  isProd,
  isResourceTransaction,
  isTokenCreatedTransaction,
  isTokenRelatedTransaction,
  execCommand,
  isSymbolEvent,
  SYMBOL_EVENTS,
  deserializeLogs,
  formatTime,
  getFee,
  getDividend
};
