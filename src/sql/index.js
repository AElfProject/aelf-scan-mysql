/**
 * @file sql
 * @author atom-yang
 * @date 2019-07-30
 */
const mysql = require('mysql');
const redis = require('redis');
const bluebird = require('bluebird');
const Counter = require('../redis/index');
const { config } = require('../common/constants');
const {
  isResourceTransaction,
  isTokenCreatedTransaction,
  isTokenRelatedTransaction,
} = require('../common/utils');
const {
  blockFormatter,
  transactionFormatter,
  resourceFormatter,
  tokenCreatedFormatter,
  tokenRelatedFormatter
} = require('../formatters/index');
const { TABLE_NAME, TABLE_COLUMNS } = require('../common/constants');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

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
    const counts = await this.getCounts(countsKeys);
    const { keys, connection } = config.redis;
    const initialCounts = {};
    counts.forEach((v, i) => {
      initialCounts[this.tableKeys[countsKeys[i]]] = v;
    });
    this.redisQuery = new Counter(redis.createClient(connection), keys, initialCounts);
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

  getCounts(keys) {
    return Promise.all(keys.map(v => {
      const sql = `select count(1) as count from ${v}`;
      return this.query(sql, []);
    })).then(res => res.map(v => v[0].count));
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
    const sql = `select block_height from ${TABLE_NAME.BLOCKS_CONFIRMED}`;
    let heights = await this.query(sql);
    heights = heights.map(v => v.block_height).sort((a, b) => a - b);
    if (heights.length === 0 || heights.length - 1 === +heights[heights.length - 1]) {
      return [];
    }
    if (heights[0] !== 1) {
      heights.unshift(1);
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

  async insertContract(tokenInfo, connection = null) {
    const keys = TABLE_COLUMNS.CONTRACT;
    const valuesBlank = `(${keys.map(() => '?').join(',')})`;

    const keysStr = `(${keys.join(',')})`;
    // eslint-disable-next-line max-len
    const sql = `insert into ${TABLE_NAME.CONTRACT} ${keysStr} VALUES ${valuesBlank} ON DUPLICATE KEY UPDATE contract_address=VALUES(contract_address);`;
    await this.query(sql, tokenInfo, connection);
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
    const { blocks, transactions } = data;
    const connection = await this.getConnection();
    await this.beginTransaction(connection);

    // block入库
    const formattedBlocks = blocks.map(block => blockFormatter(block));

    const resourceTransactions = transactions
      .map((v = [], i) => v
        .filter(isResourceTransaction)
        .map(resource => resourceFormatter(resource, formattedBlocks[i])))
      .reduce((acc, i) => acc.concat(i), []);

    const tokenCreatedTransactions = transactions
      .map((v = [], i) => v
        .filter(isTokenCreatedTransaction)
        .map(token => tokenCreatedFormatter(token, formattedBlocks[i].chain_id)))
      .reduce((acc, i) => acc.concat(i), []);

    const tokenRelatedTransactions = transactions
      .map((v = [], i) => v
        .filter(isTokenRelatedTransaction)
        .map(token => tokenRelatedFormatter(token, formattedBlocks[i])))
      .reduce((acc, i) => acc.concat(i), []);

    const formattedTransactions = transactions
      .map((v = [], i) => v.map(tx => transactionFormatter(tx, formattedBlocks[i])))
      .reduce((acc, i) => acc.concat(i), []);

    const txsLength = formattedTransactions.length;
    const contractTokenRelatedLength = tokenCreatedTransactions.length;
    const resourceLength = resourceTransactions.length;

    try {
      // 目前区分两种交易类型，token create，resource，单独入库，所有类型的交易均入库transactions
      await Promise.all([
        this.insertBlocks(formattedBlocks, isConfirmed, connection),
        this.insertTransactions(formattedTransactions, isConfirmed, connection),
        this.insertResourceTransactions(resourceTransactions, isConfirmed, connection),
        this.insertTokenCreatedTransactions(tokenCreatedTransactions, isConfirmed, connection),
        this.insertTokenRelatedTransactions(tokenRelatedTransactions, isConfirmed, connection)
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
