/**
 * @file sql
 * @author atom-yang
 * @date 2019-07-30
 */
const mysql = require('mysql');
const AElf = require('aelf-sdk');
const redis = require('redis');
const bluebird = require('bluebird');
const Counter = require('../redis/index');
const { config } = require('../common/constants');
const {
  isResourceTransaction,
  isTokenCreatedTransaction,
  isTokenRelatedTransaction,
  isSymbolEvent,
  deserializeLogs
} = require('../common/utils');
const {
  blockFormatter,
  transactionFormatter,
  resourceFormatter,
  symbolEventFormatter,
  tokenCreatedFormatter,
  tokenRelatedFormatter
} = require('../formatters/index');
const {
  tokenBalanceChangedFormatter,
  filterBalanceChangedTransaction
} = require('../formatters/balance');
const { TABLE_NAME, TABLE_COLUMNS } = require('../common/constants');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const FEE_EVENTS = [
  'TransactionFeeCharged',
  'ResourceTokenCharged',
  'ResourceTokenOwned'
];

function flatMapEvents(transactions) {
  return transactions.reduce((acc, transaction) => {
    const {
      Logs = [],
      TransactionId
    } = transaction;
    const filteredLogs = (Logs || []).filter(item => !FEE_EVENTS.includes(item.Name));
    return [...acc, ...filteredLogs.map(item => ({
      tx_id: TransactionId,
      name: item.Name,
      address: item.Address,
      data: JSON.stringify({
        Indexed: item.Indexed,
        NonIndexed: item.NonIndexed
      })
    }))];
  }, []);
}

const VOTE_EVENT_NAME = 'CandidatePubkeyReplaced';

function flatMapVoteEvents(transactions) {
  const logs = transactions.reduce((acc, transaction) => {
    const {
      Logs = []
    } = transaction;
    return [...acc, ...Logs];
  }, []);
  return deserializeLogs(logs, VOTE_EVENT_NAME);
}

class Query {
  constructor(option) {
    this.pool = mysql.createPool(option);
    this.redisQuery = null;
    this.tableKeys = {
      blocks_0: 'blocksCount',
      blocks_unconfirmed: 'blocksUnconfirmedCount',
      transactions_0: 'txsCount',
      transactions_unconfirmed: 'txsUnconfirmedCount',
      resource_0: 'resourceCount',
      resource_unconfirmed: 'resourceUnconfirmedCount',
      contract_aelf20: 'tokenCount'
    };
  }

  static prepareInsertParams(insertValues = [], keys) {
    const valuesBlank = `(${keys.map(() => '?').join(',')})`;
    const valuesStr = [];
    const values = [];
    const keysStr = `(${keys.join(',')})`;
    insertValues.sort((a, b) => a.block_height - b.block_height).forEach(item => {
      values.push(...keys.map(v => item[v]));
      valuesStr.push(valuesBlank);
    });
    return {
      keysStr,
      values,
      valuesStr: valuesStr.join(',')
    };
  }

  async initCounts() {
    const countsKeys = Object.keys(this.tableKeys);
    const { keys, connection } = config.redis;
    const initialCounts = {};
    this.redisQuery = new Counter(redis.createClient(connection), keys, initialCounts);
    const counts = await this.getCounts(countsKeys);
    counts.forEach((v, i) => {
      initialCounts[this.tableKeys[countsKeys[i]]] = v;
    });
    this.redisQuery.initialCount = initialCounts;
    await this.redisQuery.init();
  }

  async increaseCounts(blocksLength, txsLength, tokenLength, resourceLength) {
    const { keys } = config.redis;
    await this.redisQuery.promisifyCommand('incrby', keys.blocksCount, blocksLength);
    await this.redisQuery.promisifyCommand('incrby', keys.txsCount, txsLength);
    await this.redisQuery.promisifyCommand('incrby', keys.resourceCount, resourceLength);
    await this.redisQuery.promisifyCommand('incrby', keys.tokenCount, tokenLength);
  }

  async setUnconfirmCounts(blocksLength, transactions) {
    const { keys } = config.redis;
    const resourceTransactionsLength = transactions.filter(isResourceTransaction).length;
    await this.redisQuery.promisifyCommand('set', keys.blocksUnconfirmedCount, blocksLength);
    await this.redisQuery.promisifyCommand('set', keys.txsUnconfirmedCount, transactions.length);
    await this.redisQuery.promisifyCommand('set', keys.resourceCount, resourceTransactionsLength);
  }

  query(sql, values = [], connection = null) {
    const query = connection || this.pool;
    return new Promise((resolve, reject) => {
      query.query(sql, values, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async getCounts(keys) {
    const isFirstSql = 'select id from blocks_0 limit 1';
    const id = await this.query(isFirstSql, []);
    const isFirst = !id || id.length === 0;
    // eslint-disable-next-line arrow-body-style
    return Promise.all(keys.map(v => {
      return this.redisQuery.promisifyCommand('get', config.redis.keys[this.tableKeys[v]]).then(count => {
        const result = parseInt(count, 10);
        if (result && !isFirst) {
          console.log(`get count from redis for ${v}`);
          return result;
        }
        throw new Error('not found count in redis');
      }).catch(() => {
        console.log(`get count from mysql for ${v}`);
        const sql = `select count(1) as count from ${v}`;
        return this.query(sql, []).then(sqlCount => sqlCount[0].count);
      });
    }));
  }

  getConnection() {
    return new Promise((resolve, reject) => {
      this.pool.getConnection((err, connection) => (err ? reject(err) : resolve(connection)));
    });
  }

  beginTransaction(connection) {
    return new Promise((resolve, reject) => {
      connection.beginTransaction(err => (err ? reject(err) : resolve()));
    });
  }

  close() {
    this.pool.end();
    if (this.redisQuery) {
      this.redisQuery.close();
    }
  }

  async hasNodeInfo() {
    // remove stupid sql string, use ORM
    const sql = `select id from ${TABLE_NAME.NODE_INFOS}`;
    const count = await this.query(sql);
    return count.length > 0;
  }

  async insertNodesInfo(nodesInfo) {
    const keys = TABLE_COLUMNS.NODE_INFOS;
    const valuesBlank = `(${keys.map(() => '?').join(',')})`;

    const keysStr = `(${keys.join(',')})`;
    // eslint-disable-next-line max-len
    const sql = `insert into ${TABLE_NAME.NODE_INFOS} ${keysStr} VALUES ${valuesBlank} ON DUPLICATE KEY UPDATE contract_address=VALUES(contract_address);`;
    await this.query(sql, nodesInfo);
  }

  async getMaxHeight() {
    // 要取confirmed表中数据
    const sql = `select block_height from ${TABLE_NAME.BLOCKS_CONFIRMED} ORDER BY block_height DESC limit 1`;
    const height = await this.query(sql);
    return height.length > 0 ? height[0].block_height : 0;
  }

  async getMissingHeights() {
    const maxHeight = parseInt(await this.getMaxHeight(), 10);
    // const blockCount = await this.redisQuery.promisifyCommand('get', config.redis.keys.blocksCount);
    // if (maxHeight === parseInt(blockCount, 10)) {
    //   return [];
    // }
    let missingHeights = [];
    const range = 50000;
    for (let i = 1; i <= maxHeight; i += range) {
      // eslint-disable-next-line no-await-in-loop
      const list = await this.getMissingHeightsInRange(i, i + range);
      missingHeights = [...missingHeights, ...list];
    }
    return missingHeights;
  }

  async getMissingHeightsInRange(start, end) {
    // eslint-disable-next-line max-len
    const sql = `select block_height from ${TABLE_NAME.BLOCKS_CONFIRMED} where block_height between ? and ? order by block_height ASC`;
    let heights = await this.query(sql, [start, end - 1]);
    heights = heights.map(v => v.block_height);
    if (heights.length === 0 || end - start === heights.length) {
      return [];
    }
    const missingHeights = [];
    for (let i = 1; i < heights.length; i++) {
      const diff = heights[i] - heights[i - 1];
      if (diff > 1) {
        for (let j = 1; j < diff; j++) {
          missingHeights.push(heights[i - 1] + j);
        }
      }
    }
    return missingHeights;
  }

  async insertTokenCreatedTransactions(transactions = [], isConfirmed = true, connection = null) {
    if (transactions.length === 0 || !isConfirmed) {
      return;
    }
    const keys = TABLE_COLUMNS.CONTRACT;
    const tableName = TABLE_NAME.CONTRACT;
    const {
      valuesStr,
      keysStr,
      values
    } = Query.prepareInsertParams(transactions, keys);

    // eslint-disable-next-line max-len
    const sql = `insert into ${tableName} ${keysStr} VALUES ${valuesStr} ON DUPLICATE KEY UPDATE contract_address=VALUES(contract_address);`;
    await this.query(sql, values, connection);
  }

  async insertResourceTransactions(transactions = [], isConfirmed = true, connection = null) {
    if (transactions.length === 0) {
      return;
    }
    const keys = isConfirmed ? TABLE_COLUMNS.RESOURCE_CONFIRMED : TABLE_COLUMNS.RESOURCE_UNCONFIRMED;
    const tableName = isConfirmed ? TABLE_NAME.RESOURCE_CONFIRMED : TABLE_NAME.RESOURCE_UNCONFIRMED;
    const select = isConfirmed ? 'insert into' : 'replace';
    const {
      valuesStr,
      keysStr,
      values
    } = Query.prepareInsertParams(transactions, keys);
    const sql = `${select} ${tableName} ${keysStr} VALUES ${valuesStr};`;
    await this.query(sql, values, connection);
  }

  async insertEvents(events = [], isConfirmed = true, connection) {
    if (events.length === 0 || !isConfirmed) {
      return;
    }
    const keys = TABLE_COLUMNS.EVENTS;
    const tableName = TABLE_NAME.EVENTS;
    const select = 'insert into';
    const {
      valuesStr,
      keysStr,
      values
    } = Query.prepareInsertParams(events, keys);

    const sql = `${select} ${tableName} ${keysStr} VALUES ${valuesStr}`;
    await this.query(sql, values, connection);
  }

  async insertVoteEvents(list = [], isConfirmed = true, connection) {
    if (list.length === 0 || !isConfirmed) {
      return;
    }
    const events = list.map(v => {
      const {
        deserializeLogResult
      } = v;
      const {
        oldPubkey,
        newPubkey
      } = deserializeLogResult;
      const oldAddress = AElf.wallet.getAddressFromPubKey(AElf.wallet.ellipticEc.keyFromPublic(oldPubkey, 'hex').pub);
      const newAddress = AElf.wallet.getAddressFromPubKey(AElf.wallet.ellipticEc.keyFromPublic(newPubkey, 'hex').pub);
      return {
        oldPubkey,
        oldAddress,
        newAddress,
        newPubkey
      };
    });
    const tableName = 'vote_teams';
    const select = 'update';

    const sql = `${select} ${tableName} set public_key=?, address=? WHERE address=?`;
    await Promise.all(events.map(v => this.query(sql, [v.newPubkey, v.newAddress, v.oldAddress], connection)));
  }

  async insertBalance(list = [], isConfirmed = true, connection) {
    console.log('insertBalance, list', list, isConfirmed);
    if (list.length === 0) {
      return;
    }
    const keys = TABLE_COLUMNS.BALANCE;
    const tableName = TABLE_NAME.BALANCE;
    const select = 'insert into';
    const {
      valuesStr,
      keysStr,
      values
    } = Query.prepareInsertParams(list, keys);
    // eslint-disable-next-line max-len
    const sql = `${select} ${tableName} ${keysStr} VALUES ${valuesStr} ON DUPLICATE KEY UPDATE count = count + 1,balance=VALUES(balance)`;
    // console.log('insertBalance, sql', sql, values);
    await this.query(sql, values, connection);
  }

  // eslint-disable-next-line no-unused-vars
  async insertTokenTx(txs = [], isConfirmed = true, connection) {
    if (txs.length === 0) {
      return;
    }

    const keys = TABLE_COLUMNS.TOKEN_TX;
    const tableName = TABLE_NAME.TOKEN_TX;
    const select = 'insert into';
    const {
      valuesStr,
      keysStr,
      values
    } = Query.prepareInsertParams(txs, keys);
    const querySql = `select * from ${tableName} where tx_id="${values[0]}" and symbol="${values[1]}"`;
    const queryResult = await this.query(querySql, [], connection);

    if (queryResult.length) {
      return;
    }

    const sql = `${select} ${tableName} ${keysStr} VALUES ${valuesStr}`;
    await this.query(sql, values, connection);
  }

  async insertBlocks(blocks = [], isConfirmed = true, connection = null) {
    if (blocks.length === 0) {
      return;
    }
    const keys = isConfirmed ? TABLE_COLUMNS.BLOCKS_CONFIRMED : TABLE_COLUMNS.BLOCKS_UNCONFIRMED;
    const tableName = isConfirmed ? TABLE_NAME.BLOCKS_CONFIRMED : TABLE_NAME.BLOCKS_UNCONFIRMED;
    const select = isConfirmed ? 'insert into' : 'replace';
    const {
      valuesStr,
      keysStr,
      values
    } = Query.prepareInsertParams(blocks, keys);

    const sql = `${select} ${tableName} ${keysStr} VALUES ${valuesStr}`;
    await this.query(sql, values, connection);
  }

  async insertContract(tokenInfo, connection = null) {
    const keys = TABLE_COLUMNS.CONTRACT;
    const valuesBlank = `(${keys.map(() => '?').join(',')})`;

    const keysStr = `(${keys.join(',')})`;
    // eslint-disable-next-line max-len
    const sql = `insert into ${TABLE_NAME.CONTRACT} ${keysStr} VALUES ${valuesBlank} ON DUPLICATE KEY UPDATE contract_address=VALUES(contract_address);`;
    await this.query(sql, tokenInfo, connection);
  }

  async insertTransactions(transactions = [], isConfirmed = true, connection = null) {
    if (transactions.length === 0) {
      return;
    }
    const keys = isConfirmed ? TABLE_COLUMNS.TRANSACTION_CONFIRMED : TABLE_COLUMNS.TRANSACTION_UNCONFIRMED;
    const tableName = isConfirmed ? TABLE_NAME.TRANSACTION_CONFIRMED : TABLE_NAME.TRANSACTION_UNCONFIRMED;
    const select = isConfirmed ? 'insert into' : 'replace';
    const {
      valuesStr,
      keysStr,
      values
    } = Query.prepareInsertParams(transactions, keys);

    const sql = `${select} ${tableName} ${keysStr} VALUES ${valuesStr};`;
    await this.query(sql, values, connection);
  }

  async insertTokenRelatedTransactions(transactions = [], isConfirmed = true, connection = null) {
    if (transactions.length === 0) {
      return;
    }
    const keys = TABLE_COLUMNS.TRANSACTION_TOKEN;
    const tableName = isConfirmed ? TABLE_NAME.TRANSACTION_TOKEN : TABLE_NAME.TRANSACTION_TOKEN_UNCONFIRMED;
    const select = isConfirmed ? 'replace' : 'replace';
    const {
      valuesStr,
      keysStr,
      values
    } = Query.prepareInsertParams(transactions, keys);

    const sql = `${select} ${tableName} ${keysStr} VALUES ${valuesStr};`;
    await this.query(sql, values, connection);
  }

  async insertBlocksAndTransactions(data, isConfirmed = true) {
    const { blocks, transactions, type } = data;
    const connection = await this.getConnection();

    // block入库
    const formattedBlocks = await Promise.all(blocks.map((block, index) => blockFormatter(block, transactions[index])));

    const events = transactions
      .map(t => flatMapEvents(t))
      .reduce((acc, v) => [...acc, ...v], []);

    const voteEvents = (await Promise.all(transactions
      .map(t => flatMapVoteEvents(t))))
      .reduce((acc, v) => [...acc, ...v], []);

    const balances = isConfirmed ? (await Promise.all(transactions
      .reduce((acc, v, i) => [
        ...acc,
        ...v.map(inner => ({ ...inner, time: blocks[i].Header.Time }))], [])
      .filter(filterBalanceChangedTransaction)
      .map(v => tokenBalanceChangedFormatter(v, type, this.pool)))
      .then(res => res.reduce((acc, v) => [...acc, ...v], []))) : [];

    const tokenTx = await Promise.all(transactions
      .reduce((acc, v) => [...acc, ...v], [])
      .filter(isSymbolEvent)
      .map(v => symbolEventFormatter(v))).then(res => res.reduce((acc, v) => [...acc, ...v], []));

    const resourceTransactions = await Promise.all(transactions
      .map(async (v = [], i) => Promise.all(v
        .filter(isResourceTransaction)
        .map(resource => resourceFormatter(resource, formattedBlocks[i])))
        .then(res => res.reduce((acc, r) => [...acc, ...r], []))))
      .then(res => res.reduce((acc, i) => acc.concat(i), []));

    const tokenCreatedTransactions = transactions
      .map((v = []) => v
        .filter(isTokenCreatedTransaction)
        .map(token => tokenCreatedFormatter(token, config.chainId)).reduce((acc, item) => [...acc, ...item], []))
      .reduce((acc, i) => acc.concat(i), []);

    const tokenRelatedTransactions = transactions
      .map((v = [], i) => v
        .filter(isTokenRelatedTransaction)
        .map(token => tokenRelatedFormatter(token, formattedBlocks[i])))
      .reduce((acc, i) => acc.concat(i), []);

    const formattedTransactions = transactions
      .map((v = [], i) => v.map(tx => transactionFormatter(tx, formattedBlocks[i])))
      .reduce((acc, i) => acc.concat(i), []);
    await this.beginTransaction(connection);
    const txsLength = formattedTransactions.length;
    const contractTokenRelatedLength = tokenCreatedTransactions.length;
    const resourceLength = resourceTransactions.length;

    try {
      // 目前区分两种交易类型，token create，resource，单独入库，所有类型的交易均入库transactions
      await Promise.all([
        this.insertBlocks(formattedBlocks, isConfirmed, connection),
        this.insertTransactions(formattedTransactions, isConfirmed, connection),
        this.insertEvents(events, isConfirmed, connection),
        this.insertVoteEvents(voteEvents, isConfirmed, connection),
        this.insertResourceTransactions(resourceTransactions, isConfirmed, connection),
        this.insertTokenCreatedTransactions(tokenCreatedTransactions, isConfirmed, connection),
        this.insertTokenRelatedTransactions(tokenRelatedTransactions, isConfirmed, connection),
        this.insertTokenTx(tokenTx, isConfirmed, connection),
        this.insertBalance(balances, isConfirmed, connection),
      ]);
      connection.commit(async err => {
        if (err) {
          console.error(`error happened when commit ${JSON.stringify(err)}`);
          connection.rollback(() => {
            connection.release();
            // eslint-disable-next-line max-len
            console.log(`rollback from height ${formattedBlocks[0].block_height} to ${formattedBlocks[formattedBlocks.length - 1].block_height}, confirm status ${isConfirmed}`);
          });
        } else {
          if (isConfirmed) {
            await this.increaseCounts(formattedBlocks.length, txsLength, contractTokenRelatedLength, resourceLength);
          } else {
            // unconfirm
            // todo: 有可能token transaction 不成功
          }
          connection.release();
          // eslint-disable-next-line max-len
          console.log(`insert successfully from height ${formattedBlocks[0].block_height} to ${formattedBlocks[formattedBlocks.length - 1].block_height}, confirm status ${isConfirmed}`);
        }
      });
    } catch (e) {
      console.error(`error happened when insert ${JSON.stringify(e)}`);
      connection.rollback(() => {
        connection.release();
        // eslint-disable-next-line max-len
        console.log(`rollback from height ${formattedBlocks[0].block_height} to ${formattedBlocks[formattedBlocks.length - 1].block_height}, confirm status ${isConfirmed}`);
      });
    }
  }

  async deleteUnconfirmedData(LIBHeight) {
    await Promise.all([
      TABLE_NAME.BLOCKS_UNCONFIRMED,
      TABLE_NAME.TRANSACTION_UNCONFIRMED,
      TABLE_NAME.RESOURCE_UNCONFIRMED,
      TABLE_NAME.TRANSACTION_TOKEN_UNCONFIRMED
    ].map(tableName => {
      const sql = `DELETE from ${tableName} where block_height<=${LIBHeight}`;
      return this.query(sql);
    }));
  }
}

module.exports = Query;
