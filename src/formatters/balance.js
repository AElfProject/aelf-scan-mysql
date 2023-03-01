const Decimal = require('decimal.js');
const AElf = require('aelf-sdk');
const lodash = require('lodash');
const {
  QUERY_TYPE
} = require('aelf-block-scan');
const {
  deserializeLogs
} = require('../common/utils');
const {
  config,
  TABLE_COLUMNS
} = require('../common/constants');
const {
  contractTokenFormatter
} = require('./index');

const TOKEN_BALANCE_CHANGED_EVENT = [
  {
    filterText: 'Transferred',
    formatter(eventResult) {
      const {
        from,
        to,
        symbol
      } = eventResult;
      return [
        {
          owner: from,
          symbol,
          action: 'Transferred'
        },
        {
          owner: to,
          symbol,
          action: 'Transferred'
        }
      ];
    }
  },
  {
    filterText: 'Burned',
    formatter(eventResult) {
      const {
        burner,
        symbol
      } = eventResult;
      return [
        {
          owner: burner,
          symbol,
          action: 'Burned'
        }
      ];
    }
  },
  {
    filterText: 'Issued',
    formatter(eventResult) {
      const {
        to,
        symbol
      } = eventResult;
      return [
        {
          owner: to,
          symbol,
          action: 'Issued'
        }
      ];
    }
  },
  {
    filterText: 'CrossChainReceived',
    formatter(eventResult) {
      const {
        to,
        symbol
      } = eventResult;
      return [
        {
          owner: to,
          symbol,
          action: 'CrossChainReceived'
        }
      ];
    }
  },
  {
    filterText: 'CrossChainTransferred',
    formatter(eventResult) {
      const {
        from,
        symbol
      } = eventResult;
      return [
        {
          owner: from,
          symbol,
          action: 'CrossChainTransferred'
        }
      ];
    }
  },
  {
    filterText: 'CrossChainTransferred',
    formatter(eventResult) {
      const {
        from,
        symbol
      } = eventResult;
      return [
        {
          owner: from,
          symbol,
          action: 'CrossChainTransferred'
        }
      ];
    }
  },
  {
    filterText: 'CrossChainTransferred',
    formatter(eventResult) {
      const {
        from,
        symbol
      } = eventResult;
      return [
        {
          owner: from,
          symbol,
          action: 'CrossChainTransferred'
        }
      ];
    }
  },
  {
    filterText: 'TransactionFeeCharged',
    formatter(eventResult, transaction) {
      const {
        Transaction: {
          From
        }
      } = transaction;
      const {
        symbol
      } = eventResult;
      return [
        {
          owner: From,
          symbol,
          action: 'TransactionFeeCharged'
        }
      ];
    }
  },
  {
    filterText: 'ResourceTokenCharged',
    formatter(eventResult, transaction) {
      const {
        Transaction: {
          From
        }
      } = transaction;
      const {
        symbol
      } = eventResult;
      return [
        {
          owner: From,
          symbol,
          action: 'ResourceTokenCharged'
        }
      ];
    }
  }
];

function filterBalanceChangedTransaction(transaction) {
  const {
    Bloom,
  } = transaction;

  return !!Bloom && TOKEN_BALANCE_CHANGED_EVENT.map(event => {
    const {
      filterText
    } = event;
    return AElf.utils.isEventInBloom(Bloom, filterText)
      && AElf.utils.isAddressInBloom(Bloom, config.token.address);
  }).filter(v => v === true).length > 0;
}

function deserializeTransferredLogs(transaction, filters) {
  const {
    Logs = []
  } = transaction;
  return Promise.all(
    filters
      .map(f => {
        const {
          formatter,
          filterText
        } = f;
        return deserializeLogs(Logs, filterText)
          .then(res => res.map(r => formatter(r.deserializeLogResult, transaction)));
      })
  );
}

async function getBalances(paramsArr, maxQuery = 3) {
  let results = [];
  for (let i = 0; i < paramsArr.length; i += maxQuery) {
    results = [
      ...results,
      // eslint-disable-next-line no-await-in-loop,max-len
      ...(await Promise.all(paramsArr.slice(i, i + maxQuery).map(v => config.token.GetBalance.call(v))))
    ];
  }
  return results;
}

async function getTokenList(sql) {
  const text = 'select symbol, decimals from contract_aelf20';
  const list = await sql.query(text, []);
  return list;
}

async function addTokenIntoDb(db, tokenInfo) {
  const keys = TABLE_COLUMNS.CONTRACT;
  const valuesBlank = `(${keys.map(() => '?').join(',')})`;

  const keysStr = `(${keys.join(',')})`;
  // eslint-disable-next-line max-len
  const sql = `insert into contract_aelf20 ${keysStr} VALUES ${valuesBlank} ON DUPLICATE KEY UPDATE contract_address=VALUES(contract_address);`;
  return db.query(sql, contractTokenFormatter(tokenInfo));
}

let TOKEN_DECIMALS = {};
let FETCHING_TOKEN_LIST = false;

async function getTokenDecimal(db, symbol) {
  if (
    Object.keys(TOKEN_DECIMALS).length === 0
  ) {
    if (!FETCHING_TOKEN_LIST) {
      FETCHING_TOKEN_LIST = getTokenList(db);
    }
    let tokenList = await FETCHING_TOKEN_LIST;
    tokenList = tokenList._results;
    TOKEN_DECIMALS = {
      ...TOKEN_DECIMALS,
      ...tokenList.reduce((acc, data) => ({
        ...acc,
        [data.symbol]: data.decimals
      }), {})
    };
  }
  if (!TOKEN_DECIMALS[symbol]) {
    const tokenInfo = await config.token.GetTokenInfo.call({
      symbol
    });
    TOKEN_DECIMALS[symbol] = tokenInfo.decimals;
    await addTokenIntoDb(db, tokenInfo);
  }

  if (!/^\d+$/.test(TOKEN_DECIMALS[symbol])) {
    const errorMsg = `Can not find the TOKEN_DECIMALS of ${symbol}`;
    throw Error(errorMsg);
  }
  return TOKEN_DECIMALS[symbol];
}

async function calculateBalances(db, symbol, balance) {
  const decimal = await getTokenDecimal(db, symbol);
  return new Decimal(balance).dividedBy(`1e${decimal}`).toString();
}

let BALANCES_NOT_IN_LOOP = {};

async function tokenBalanceChangedFormatter(transaction, type, db) {
  const {
    time
  } = transaction;
  let addressSymbols = await deserializeTransferredLogs(transaction, TOKEN_BALANCE_CHANGED_EVENT);
  addressSymbols = addressSymbols
    .reduce((acc, v) => [...acc, ...v], [])
    .reduce((acc, v) => [...acc, ...v], []);
  // 用来排除非法的Token名称或者用户自定义的Token名称
  addressSymbols = addressSymbols.filter(v => v.symbol.match(/^[a-z0-9]+[-]*[a-z0-9]+$/i));
  addressSymbols = lodash.uniq(addressSymbols.map(v => `${v.owner}_${v.symbol}`));
  const balancesFromCache = addressSymbols
    .filter(v => type !== QUERY_TYPE.LOOP && BALANCES_NOT_IN_LOOP[v] !== undefined)
    .map(key => ({
      owner: key.split('_')[0],
      symbol: key.split('_')[1],
      balance: BALANCES_NOT_IN_LOOP[key]
    }));

  addressSymbols = addressSymbols
    .filter(v => (type !== QUERY_TYPE.LOOP && BALANCES_NOT_IN_LOOP[v] === undefined)
      || type === QUERY_TYPE.LOOP)
    .map(v => ({
      owner: v.split('_')[0],
      symbol: v.split('_')[1]
    }));
  let balances = await getBalances(addressSymbols);
  balances = await Promise.all(balances.map(async item => {
    const {
      balance,
      symbol
    } = item;
    return {
      ...item,
      balance: await calculateBalances(db, symbol, balance)
    };
  }));
  BALANCES_NOT_IN_LOOP = {
    ...BALANCES_NOT_IN_LOOP,
    ...balances.reduce((acc, v) => ({
      ...acc,
      [`${v.owner}_${v.symbol}`]: v.balance
    }), {})
  };
  return [...balances, ...balancesFromCache].map(b => ({
    ...b,
    count: 1,
    updated_at: time
  }));
}

module.exports = {
  tokenBalanceChangedFormatter,
  filterBalanceChangedTransaction
};
