/**
 * @file db operation
 * @author atom-yang
 * @date 2019-07-30
 */
const {
  DBBaseOperation,
  QUERY_TYPE
} = require('aelf-block-scan');

class DBOperation extends DBBaseOperation {
  constructor(option, query) {
    super(option);
    this.query = query;
    this.lastTime = new Date().getTime();
  }

  init() {
    console.log('init');
  }

  async insert(data) {
    const now = new Date().getTime();
    console.log(`take time ${now - this.lastTime}ms`);
    this.lastTime = now;
    const {
      blocks,
      txs,
      type,
      bestHeight,
      LIBHeight
    } = data;
    switch (type) {
      case QUERY_TYPE.INIT:
        console.log('INIT');
        break;
      case QUERY_TYPE.MISSING:
        await this.insertHeight(data);
        break;
      case QUERY_TYPE.GAP:
        console.log('GAP');
        console.log('LIBHeight', LIBHeight);
        await this.insertHeight(data);
        break;
      case QUERY_TYPE.LOOP:
        console.log('LOOP');
        console.log('bestHeight', bestHeight);
        console.log('LIBHeight', LIBHeight);
        await this.insertLoop(data);
        break;
      case QUERY_TYPE.ERROR:
        console.log('ERROR');
        break;
      default:
        break;
    }
    console.log('blocks length', blocks.length);
    console.log('transactions length', txs.reduce((acc, i) => acc.concat(i), []).length);
    if (blocks.length > 0) {
      console.log('highest height', blocks[blocks.length - 1].Header.Height);
    }
    console.log('\n\n');
  }

  async insertHeight(data, isConfirmed = true) {
    // insert confirmed blocks and transactions
    if (data.blocks.length === 0) {
      return;
    }
    await this.query.insertBlocksAndTransactions({
      blocks: data.blocks,
      transactions: data.txs
    }, isConfirmed);
  }

  async insertLoop(data) {
    const {
      LIBHeight,
      blocks,
      txs
    } = data;
    await this.query.deleteUnconfirmedData(LIBHeight);

    const confirmedData = {
      blocks: blocks.filter(v => +v.Header.Height <= LIBHeight),
      txs: txs.filter((v, i) => +blocks[i].Header.Height <= LIBHeight)
    };
    await this.insertHeight(confirmedData);
    const unconfirmedData = {
      blocks: blocks.filter(v => +v.Header.Height > LIBHeight),
      txs: txs.filter((v, i) => +blocks[i].Header.Height > LIBHeight)
    };
    await this.insertHeight(unconfirmedData, false);
    await this.query.setUnconfirmCounts(blocks.length, unconfirmedData.txs.reduce((acc, i) => acc.concat(i), []));
  }

  destroy() {
    this.query.close();
  }
}

module.exports = DBOperation;
