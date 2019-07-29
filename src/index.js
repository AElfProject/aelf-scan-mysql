const {
  Scanner,
  DBBaseOperation,
  QUERY_TYPE
} = require('aelf-block-scan');
const AElf = require('aelf-sdk');
const { Query } = require('./sql/index');
const { contractTokenFormatter } = require('./formatters/index');
const { config } = require('./common/constants');
const { startTPS, stopTPS } = require('./tps/index');

const aelf = new AElf(new AElf.providers.HttpProvider(config.scan.host));
const wallet = AElf.wallet.getWalletByPrivateKey(config.wallet.privateKey);
let scanner = null;
let sqlQuery = null;

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
    // eslint-disable-next-line no-restricted-syntax
    for (const index of Object.keys(data.blocks)) {
      const item = {
        block: data.blocks[index],
        transactions: data.txs[index]
      };
      // eslint-disable-next-line no-await-in-loop
      await this.query.insertBlocksAndTransactions(item, isConfirmed);
    }
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
  }

  destroy() {
    this.query.close();
  }
}

async function getELFTokenInfo() {
  const chainInfo = await aelf.chain.getChainStatus();
  const {
    GenesisContractAddress,
    ChainId
  } = chainInfo;
  const genesisContract = await aelf.chain.contractAt(GenesisContractAddress, wallet);
  const tokenAddress = await genesisContract
    .GetContractAddressByName.call(AElf.utils.sha256('AElf.ContractNames.Token'));
  const tokenContract = await aelf.chain.contractAt(tokenAddress, wallet);
  const tokenInfo = await tokenContract.GetTokenInfo.call({
    symbol: 'ELF'
  });
  return [
    tokenAddress,
    ChainId,
    tokenInfo
  ];
}

async function getConfig() {
  // 获取表中最大高度，获取表中缺失的高度列表
  const maxHeight = await sqlQuery.getMaxHeight();
  console.log(`max height in confirmed blocks ${maxHeight}`);
  const missingHeights = await sqlQuery.getMissingHeights();
  console.log(`missing heights in confirmed blocks ${JSON.stringify(missingHeights)}`);
  return {
    ...config.scan,
    startHeight: maxHeight + 1,
    missingHeightList: missingHeights.slice()
  };
}

async function restart() {
  sqlQuery = new Query(config.sql);
  const restartOptions = await getConfig();
  restartOptions.aelfInstance = aelf;
  scanner.restart(new DBOperation({}, sqlQuery), restartOptions);
}

async function init() {
  // const aelf = new AElf(new AElf.providers.HttpProvider(config.scan.host));
  // const wallet = AElf.wallet.getWalletByPrivateKey(config.wallet.privateKey);
  // 插入表中
  const tokenInfo = await getELFTokenInfo(aelf, wallet);
  sqlQuery = new Query(config.sql);
  await sqlQuery.insertContract(contractTokenFormatter(...tokenInfo));
  const options = await getConfig();
  options.aelfInstance = aelf;
  scanner = new Scanner(new DBOperation({}, sqlQuery), options);
  scanner.start().then(() => {
    // 采集tps信息
    startTPS();
    console.log('start loop');
  }).catch(async err => {
    // 错误处理，重启
    // todo: 日志记录，pm2相关
    console.log(err);
    await stopTPS();
    await restart();
    console.log('restart successfully');
  });
}
process.stdin.resume(); // so the program will not close instantly

function cleanup() {
  console.log('cleanup');
  if (sqlQuery) {
    sqlQuery.close();
  }
}

// do something when app is closing
process.on('exit', cleanup);

// catches ctrl+c event
process.on('SIGINT', cleanup);

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', cleanup);
process.on('SIGUSR2', cleanup);

process.on('uncaughtException', async err => {
  console.log(err);
  await restart();
  console.log('restart successfully');
});


init();
