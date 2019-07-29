const mysql = require('mysql');
const {
  isResourceTransaction,
  isTokenCreatedTransaction
} = require('../common/utils');
const {
  blockFormatter,
  transactionFormatter,
  resourceFormatter,
  contractTokenRelatedFormatter
} = require('../formatters/index');
const { TABLE_NAME, TABLE_COLUMNS } = require('../common/constants');

class Query {
  constructor(option) {
    this.pool = mysql.createPool(option);
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

  getConnection() {
    return new Promise((resolve, reject) => {
      this.pool.getConnection((err, connection) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(connection);
      });
    });
  }

  beginTransaction(connection) {
    return new Promise((resolve, reject) => {
      connection.beginTransaction(err => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  close() {
    this.pool.end();
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

  async insertContractToken(transactions = [], isConfirmed = true, connection = null) {
    if (transactions.length === 0 || !isConfirmed) {
      return;
    }
    const keys = TABLE_COLUMNS.CONTRACT;
    const tableName = TABLE_NAME.CONTRACT;
    const valuesBlank = `(${keys.map(() => '?').join(',')})`;
    const valuesStr = [];
    const values = [];
    const keysStr = `(${keys.join(',')})`;

    transactions.forEach(item => {
      values.push(...keys.map(v => item[v]));
      valuesStr.push(valuesBlank);
    });
    // eslint-disable-next-line max-len
    const sql = `insert into ${tableName} ${keysStr} VALUES ${valuesStr.join(',')} ON DUPLICATE KEY UPDATE contract_address=VALUES(contract_address);`;
    await this.query(sql, values, connection);
  }

  async insertResourceTransactions(transactions = [], isConfirmed = true, connection = null) {
    if (transactions.length === 0) {
      return;
    }
    const keys = isConfirmed ? TABLE_COLUMNS.RESOURCE_CONFIRMED : TABLE_COLUMNS.RESOURCE_UNCONFIRMED;
    const tableName = isConfirmed ? TABLE_NAME.RESOURCE_CONFIRMED : TABLE_NAME.RESOURCE_UNCONFIRMED;
    const valuesBlank = `(${keys.map(() => '?').join(',')})`;
    const valuesStr = [];
    const values = [];
    const keysStr = `(${keys.join(',')})`;

    transactions.forEach(item => {
      values.push(...keys.map(v => item[v]));
      valuesStr.push(valuesBlank);
    });
    // eslint-disable-next-line max-len
    const sql = `insert into ${tableName} ${keysStr} VALUES ${valuesStr.join(',')} ON DUPLICATE KEY UPDATE tx_id=VALUES(tx_id);`;
    await this.query(sql, values, connection);
  }

  async insertBlocks(block, isConfirmed = true, connection = null) {
    const keys = isConfirmed ? TABLE_COLUMNS.BLOCKS_CONFIRMED : TABLE_COLUMNS.BLOCKS_UNCONFIRMED;
    const tableName = isConfirmed ? TABLE_NAME.BLOCKS_CONFIRMED : TABLE_NAME.BLOCKS_UNCONFIRMED;
    const valuesBlank = `(${keys.map(() => '?').join(',')})`;

    const keysStr = `(${keys.join(',')})`;
    const values = keys.map(v => block[v]);

    const sql = `insert into ${tableName} ${keysStr} VALUES ${valuesBlank}`
      + 'ON DUPLICATE KEY UPDATE block_hash=VALUES(block_hash);';
    await this.query(sql, values, connection);
  }

  async insertTransactions(transactions = [], isConfirmed = true, connection = null) {
    const keys = isConfirmed ? TABLE_COLUMNS.TRANSACTION_CONFIRMED : TABLE_COLUMNS.TRANSACTION_UNCONFIRMED;
    const tableName = isConfirmed ? TABLE_NAME.TRANSACTION_CONFIRMED : TABLE_NAME.TRANSACTION_UNCONFIRMED;
    const valuesBlank = `(${keys.map(() => '?').join(',')})`;
    const valuesStr = [];
    const values = [];
    const keysStr = `(${keys.join(',')})`;
    transactions.forEach(item => {
      values.push(...keys.map(v => item[v]));
      valuesStr.push(valuesBlank);
    });

    const sql = `insert into ${tableName} ${keysStr} VALUES ${valuesStr} ON DUPLICATE KEY UPDATE tx_id=VALUES(tx_id);`;
    await this.query(sql, values, connection);
  }

  async insertBlocksAndTransactions(data, isConfirmed = true) {
    let { block } = data;
    const { transactions } = data;
    const connection = await this.getConnection();
    await this.beginTransaction(connection);

    // block入库
    block = blockFormatter(block);

    const resourceTransactions = transactions.filter(isResourceTransaction)
      .map(v => resourceFormatter(v, block));
    const tokenCreatedTransactions = transactions.filter(isTokenCreatedTransaction)
      .map(v => contractTokenRelatedFormatter(v, block.chain_id));

    const formattedTransactions = transactions.map(v => transactionFormatter(v, block));

    try {
      // 目前区分两种交易类型，token create，resource，单独入库，所有类型的交易均入库transactions
      await Promise.all([
        this.insertBlocks(block, isConfirmed, connection),
        this.insertTransactions(formattedTransactions, isConfirmed, connection),
        this.insertResourceTransactions(resourceTransactions, isConfirmed, connection),
        this.insertContractToken(tokenCreatedTransactions, isConfirmed, connection)
      ]);
      connection.commit(err => {
        if (err) {
          console.log(`error happened when commit ${JSON.stringify(err)}`);
          connection.rollback(() => {
            connection.release();
            console.log(`rollback at height ${block.block_height}, confirm status ${isConfirmed}`);
          });
        } else {
          connection.release();
          console.log(`insert successfully at height ${block.block_height}, confirm status ${isConfirmed}`);
        }
      });
    } catch (e) {
      console.log(`error happened when insert ${JSON.stringify(e)}`);
      connection.rollback(() => {
        connection.release();
        console.log(`rollback at height ${block.block_height}, confirm status ${isConfirmed}`);
      });
    }
  }

  async deleteUnconfirmedData(LIBHeight) {
    await Promise.all([
      TABLE_NAME.BLOCKS_UNCONFIRMED,
      TABLE_NAME.TRANSACTION_UNCONFIRMED,
      TABLE_NAME.RESOURCE_UNCONFIRMED
    ].map(tableName => {
      const sql = `DELETE from ${tableName} where block_height<=${LIBHeight}`;
      return this.query(sql);
    }));
  }
}

module.exports = {
  Query
};
