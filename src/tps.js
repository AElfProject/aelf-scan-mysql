/**
 * @file tps
 * @author atom-yang
 * @date 2019.07.26
 */
const moment = require('moment');
// eslint-disable-next-line prefer-const
let { config, TABLE_COLUMNS } = require('./common/constants');
const Query = require('./sql/index');

config = config.tps;

const query = new Query(config.sql);
const CURRENT_TIME = (new Date()).getTime() / 1000;

async function insertTpsBatch(tpsList) {
  const keys = TABLE_COLUMNS.TRANS_PER_SECOND;
  const valuesBlank = `(${keys.map(() => '?').join(',')})`;

  const values = [];
  const valuesStr = [];
  const keysStr = `(${keys.join(',')})`;

  tpsList.forEach(item => {
    values.push(...keys.map(v => item[v]));
    valuesStr.push(valuesBlank);
  });
  const sql = `insert into tps_0 ${keysStr} VALUES ${valuesStr.join(',')} ON DUPLICATE KEY UPDATE start=(start);`;
  await query.query(sql, values);
}

async function insertTps(blocks = [], startTime, endTime) {
  if (blocks.length) {
    let txCount = 0;
    blocks.forEach(block => {
      txCount += parseInt(block.tx_count, 10);
    });
    const tps = txCount / config.interval;
    const tpm = txCount * 60 / config.interval;
    const values = [{
      start: startTime,
      end: endTime,
      txs: txCount,
      blocks: blocks.length,
      tps,
      tpm,
      type: config.minutes
    }];

    await insertTpsBatch(values);
  } else {
    const values = [{
      start: startTime,
      end: endTime,
      txs: 0,
      blocks: 0,
      tps: 0,
      tpm: 0,
      type: config.minutes
    }];
    await insertTpsBatch(values);
  }
}

async function getTps(startTimeUnix, endTimeUnix, insertBatch) {
  // Mysql '2018-11-05T03:29:18Z' and '2018-11-05T03:34:18Z'
  // Will not get the data of 2018-11-05T03:29:18.xxxZ
  // startTimeUnix -= 1;
  const startTime = moment.unix(startTimeUnix).utc().format();
  const endTime = moment.unix(endTimeUnix).utc().format();
  const blocksConfirmed = await query.query(
    'select * from blocks_0 where time between ? and ? order by time ASC',
    [startTime, endTime]
  );
  const blocksUnconfirmed = await query.query(
    'select * from blocks_unconfirmed where time between ? and ? order by time ASC',
    [startTime, endTime]
  );
  const blocks = blocksConfirmed.length ? blocksConfirmed : blocksUnconfirmed;

  if (insertBatch) {
    const needInsertList = [];
    // eslint-disable-next-line max-len
    for (let timeTemp = startTimeUnix, timeIndex = 0; timeTemp < endTimeUnix; timeTemp += config.interval, timeIndex++) {
      const startTimeUnixTemp = timeTemp;
      const endTimeUnixTemp = timeTemp + config.interval;
      const option = {
        start: moment.unix(startTimeUnixTemp).utc().format(),
        end: moment.unix(endTimeUnixTemp).utc().format(),
        txs: 0,
        blocks: 0,
        tps: 0,
        tpm: 0,
        type: config.minutes
      };
      for (let index = 0, { length } = blocks; index < length; index++) {
        const block = blocks[0];
        const blockTime = block.time;
        const blockTimeUnix = moment(blockTime).unix();

        if (blockTimeUnix < endTimeUnixTemp) {
          option.txs += parseInt(block.tx_count, 10);
          option.blocks++;
          blocks.shift();
        } else {
          break;
        }
      }
      option.tps = option.txs / config.interval;
      option.tpm = option.txs / config.minutes;
      needInsertList.push(option);
    }
    await insertTpsBatch(needInsertList);
    // eslint-disable-next-line no-use-before-define
    await getTpsTypeFilter(endTimeUnix);
    return;
  }

  const newEndTimeUnix = endTimeUnix + config.interval;
  const nowTimeUnix = (new Date()).getTime() / 1000;

  console.log('FYI: ', endTimeUnix, newEndTimeUnix, nowTimeUnix, nowTimeUnix - newEndTimeUnix);
  if (newEndTimeUnix < (nowTimeUnix - config.delayTime)) {
    await insertTps(blocks, startTime, endTime);
    // eslint-disable-next-line no-use-before-define
    await getTpsTypeFilter(endTimeUnix);
  } else {
    console.log('into interval, interval seconds: ', config.scanInterval / 1000);
    setTimeout(async () => {
      await getTps(startTimeUnix, endTimeUnix);
    }, config.scanInterval);
  }
}

async function getTpsTypeFilter(startTime) {
  const currentStartInterval = CURRENT_TIME - startTime;

  let endTimeUnix = startTime + config.interval;
  let insertBatch = false;

  if (currentStartInterval > config.batchLimitTime) {
    if (currentStartInterval > config.batchDayInterval) {
      endTimeUnix = startTime + config.batchDayInterval;
    } else {
      endTimeUnix = CURRENT_TIME - config.batchLimitTime;
    }
    insertBatch = true;
  }
  console.log('getTpsTypeFilter: ', insertBatch);
  await getTps(startTime, endTimeUnix, insertBatch);
}

async function init() {
  const firstBlockInBlockTable = await query.query('select * from blocks_0 where block_height=5', []);
  const latestBlockInTPSTable = await query.query('select * from tps_0 order by end DESC limit 1 offset 0', []);

  const startTimeUnix01 = firstBlockInBlockTable[0] && moment(firstBlockInBlockTable[0].time).unix() || 0;
  if (!startTimeUnix01) {
    const errorMsg = 'can not find the first block in Database!';
    console.error(errorMsg);
    throw Error(errorMsg);
  }

  const startTimeUnix02 = latestBlockInTPSTable.length ? moment(latestBlockInTPSTable[0].end).unix() : 0;
  const startTimeUnix = Math.max(startTimeUnix01, startTimeUnix02);
  await getTpsTypeFilter(startTimeUnix);
}

init().catch(err => {
  console.log(err);
});
