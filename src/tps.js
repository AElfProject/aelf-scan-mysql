/**
 * @file tps
 * @author atom-yang
 * @date 2019.07.26
 */
const moment = require('moment');
const { Scheduler } = require('aelf-block-scan');
// eslint-disable-next-line prefer-const
let { config, TABLE_COLUMNS, TABLE_NAME } = require('./common/constants');
const Query = require('./sql/index');

config = config.tps;

class TPS {
  constructor(options) {
    this.config = options;
    this.query = new Query(options.sql);
    this.scheduler = new Scheduler({
      interval: options.scanInterval * 1000
    });
    this.confirmedSql = `select * from ${TABLE_NAME.BLOCKS_CONFIRMED} where time between ? and ?`;
    this.unconfirmedSql = `select * from ${TABLE_NAME.BLOCKS_UNCONFIRMED} where time between ? and ?`;
    this.lastCurrentTime = moment().unix();
  }

  async init() {
    // eslint-disable-next-line max-len
    const firstBlockInBlockTable = await this.query.query('select * from blocks_0 order by block_height ASC limit 1 offset 5', []);
    const latestBlockInTPSTable = await this.query.query('select * from tps_0 order by end DESC limit 1 offset 0', []);

    // 数据库中的初始区块时间
    const firstBlockTime = firstBlockInBlockTable.length ? moment(firstBlockInBlockTable[0].time).unix() : 0;
    if (!firstBlockTime) {
      const errorMsg = 'can not find the first block in Database!';
      console.error(errorMsg);
      throw Error(errorMsg);
    }
    console.log('init');

    // 最新的tps数据的时间
    const newestTPSTime = latestBlockInTPSTable.length ? moment(latestBlockInTPSTable[0].end).unix() : 0;
    const startTime = Math.max(firstBlockTime, newestTPSTime);
    console.log('init start time', this.formatTime(startTime));
    // decide to use loop or batch
    const currentTime = moment().unix();
    if (startTime <= currentTime - this.config.batchLimitTime) {
      // 开始时间小于当前时间减去批量插入时间，开始批量插入
      console.log('init start batch', this.formatTime(startTime));
      await this.queryInBatch(startTime);
    } else {
      // 循环插入
      console.log('init start loop', this.formatTime(startTime));
      await this.queryInLoop(startTime);
    }
  }

  async queryInBatch(startTime) {
    let currentTime = moment().unix() - this.config.batchLimitTime;
    for (let i = startTime; i < currentTime; i += this.config.batchDayInterval) {
      console.log(`batch loop ${i}`, this.formatTime(i));
      currentTime = moment().unix() - this.config.batchLimitTime;
      let endTime = i + this.config.batchDayInterval;
      if (endTime >= currentTime) {
        // 此为最后一次循环
        endTime = currentTime;
        // 新endTime小于等于原endTime
        endTime = this.floorEndTimeToMatchInterval(i, endTime, this.config.interval);
        currentTime = endTime;
      }
      // eslint-disable-next-line no-await-in-loop
      const results = await this.getResultPerInterval(i, endTime, false);
      // eslint-disable-next-line no-await-in-loop
      await this.handleBatch(results);
    }
    await this.queryInLoop(currentTime);
  }

  async handleBatch(data) {
    const { blocks, startTime, endTime } = data;
    // eslint-disable-next-line max-len
    console.log(`handle batch from ${this.formatTime(startTime)} to ${this.formatTime(endTime)} with ${blocks.length} blocks`);
    let insertValues = new Array(Math.floor((endTime - startTime) / this.config.interval))
      .fill(1)
      .map((_, i) => ({
        start: this.formatTime(startTime + i * this.config.interval),
        end: this.formatTime(startTime + (i + 1) * this.config.interval),
        txs: 0,
        blocks: 0,
        tps: 0,
        tpm: 0,
        type: this.config.minutes
      }));
    // eslint-disable-next-line no-restricted-syntax
    for (const block of blocks) {
      // 对于毫秒会全部丢弃
      const time = moment(block.time).unix();
      let index = Math.floor((time - startTime) / this.config.interval);
      const mod = (time - startTime) % this.config.interval;
      // 统计规则为时间范围左开右闭，则与区域开始时间相同的区块不计数，计入上一个时间段
      if (mod === 0 && index !== 0) {
        index -= 1;
      }
      const currentItem = insertValues[index];
      currentItem.txs += parseInt(block.tx_count, 10);
      currentItem.blocks += 1;
    }
    insertValues = insertValues.map(v => {
      const tps = v.txs / this.config.interval;
      const tpm = tps * 60;
      return {
        ...v,
        tps,
        tpm
      };
    });
    console.log(`inserted values length ${insertValues.length}`);
    for (let i = 0; i < insertValues.length; i += this.config.maxInsert) {
      // eslint-disable-next-line no-await-in-loop
      await this.insertTpsBatch(insertValues.slice(i, i + this.config.maxInsert));
    }
  }

  async queryInLoop(startTime) {
    console.log('loop query from time', this.formatTime(startTime));
    console.log(`loop current time ${moment().utc().format()}`);
    this.lastCurrentTime = startTime;
    this.scheduler.setCallback(async () => {
      console.log('loop callback last time', this.formatTime(this.lastCurrentTime));
      console.log(`loop current time ${moment().utc().format()}`);
      // 获取数据, 设置延迟
      const currentTime = moment().unix() - this.config.delayTime;
      if (currentTime - this.lastCurrentTime < this.config.interval) {
        // 间隔小于interval时不查询
        return;
      }
      const endTime = this.floorEndTimeToMatchInterval(this.lastCurrentTime, currentTime);
      const results = await this.getResultPerInterval(this.lastCurrentTime, endTime, true);
      await this.handleBatch(results);
      this.lastCurrentTime = endTime;
    });
    this.scheduler.startTimer();
  }

  formatTime(time) {
    return moment.unix(time).utc().format();
  }

  /**
   * format end time to make the difference between startTime and endTime is the times of interval
   * @param {number} startTime
   * @param {number} endTime
   * @param {number} interval
   * @returns {number} endTime
   */
  floorEndTimeToMatchInterval(startTime, endTime, interval = 60) {
    const timeDifference = interval * Math.floor((endTime - startTime) / interval);
    return startTime + timeDifference;
  }

  async getResults(startTime, endTime, isLoop = false, interval = 60) {
    // eslint-disable-next-line max-len
    console.log(`get results, is in loop ${isLoop}, query from ${this.formatTime(startTime)} to ${this.formatTime(endTime)}`);
    const queryTimes = Math.floor((endTime - startTime) / interval);
    const intervals = new Array(queryTimes).fill(1).map((_, i) => startTime + i * interval);
    const results = [];
    for (let i = 0; i < intervals.length; i += this.config.maxQuery) {
      // eslint-disable-next-line no-await-in-loop
      const loopResult = await Promise.all(intervals.slice(i, i + this.config.maxQuery)
        .map(v => this.getResultPerInterval(v, v + interval, isLoop)));
      // eslint-disable-next-line max-len
      console.log(`get results for-loop, is in loop ${isLoop}, query from ${this.formatTime(intervals[i])} to ${this.formatTime(intervals[i + this.config.maxQuery] || endTime)}`);
      results.push(...loopResult);
    }
    return results;
  }

  async getResultPerInterval(startTime, endTime, isLoop = false) {
    // eslint-disable-next-line max-len
    console.log(`getResultPerInterval, is in loop ${isLoop}, query from ${this.formatTime(startTime)} to ${this.formatTime(endTime)}`);
    // 只有循环查询的情况下才需要查询unconfirmed
    let blocks;
    const startTimeUTC = this.formatTime(startTime);
    const endTimeUTC = this.formatTime(endTime);
    const sqlValues = [startTimeUTC, endTimeUTC];
    blocks = await this.query.query(this.confirmedSql, sqlValues);
    // eslint-disable-next-line max-len
    if (isLoop) {
      const unconfirmedBlocks = await this.query.query(this.unconfirmedSql, sqlValues);
      if (unconfirmedBlocks.length === 0 || blocks.length === 0) {
        blocks = blocks.length ? blocks : unconfirmedBlocks;
      } else {
        // 合并去重
        const unionBlocks = [...unconfirmedBlocks, ...blocks];
        const uniqueBlocksHashes = {};
        unionBlocks.forEach(v => {
          unionBlocks[v.block_hash] = v;
        });
        blocks = Object.values(uniqueBlocksHashes);
      }
    }
    return {
      blocks,
      startTime,
      endTime
    };
  }

  async insertTpsBatch(tpsList = []) {
    console.log('insert', tpsList.length);
    if (tpsList.length === 0) {
      return;
    }
    const keys = this.config.tableKeys;
    const valuesBlank = `(${keys.map(() => '?').join(',')})`;

    const values = [];
    const valuesStr = [];
    const keysStr = `(${keys.join(',')})`;

    tpsList.forEach(item => {
      values.push(...keys.map(v => item[v]));
      valuesStr.push(valuesBlank);
    });
    // eslint-disable-next-line max-len
    const sql = `insert into ${this.config.tableName} ${keysStr} VALUES ${valuesStr.join(',')} ON DUPLICATE KEY UPDATE start=(start);`;
    await this.query.query(sql, values);
  }

  stop() {
    this.scheduler.endTimer();
  }
}

const tps = new TPS({
  ...config,
  tableName: TABLE_NAME.TRANS_PER_SECOND,
  tableKeys: TABLE_COLUMNS.TRANS_PER_SECOND
});

module.exports = tps;
