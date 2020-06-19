/**
 * @file insert
 * @author atom-yang
 */
const {
  Scanner
} = require('aelf-block-scan');
const AElf = require('aelf-sdk');
const Query = require('./sql/index');
const DBOperation = require('./dbOperation/index');
const { contractTokenFormatter } = require('./formatters/index');
const { config } = require('./common/constants');
const { sendEmails } = require('./emails');

let customInsert;

class CustomInsert {
  constructor(options) {
    // process.stdin.resume(); // so the program will not close instantly
    // do something when app is closing
    // process.on('exit', this.cleanup);
    //
    // // catches ctrl+c event
    // process.on('SIGINT', this.cleanup);
    //
    // // catches "kill pid" (for example: nodemon restart)
    // process.on('SIGUSR1', this.cleanup);
    // process.on('SIGUSR2', this.cleanup);
    //
    process.on('unhandledRejection', async err => {
      console.log('unhandledRejection');
      await sendEmails(err);
      this.cleanup();
    });
    process.on('uncaughtException', async err => {
      console.log('uncaughtException');
      await sendEmails(err);
      this.cleanup();
    });
    this.config = options;
    this.aelf = new AElf(new AElf.providers.HttpProvider(this.config.scan.host, 3000));
    this.wallet = AElf.wallet.getWalletByPrivateKey(this.config.wallet.privateKey);
    this.scanner = null;
    this.sqlQuery = null;
    this.cleanup = this.cleanup.bind(this);
  }

  async init() {
    // 插入表中
    const tokenInfo = await this.getELFTokenInfo();
    const primaryTokenInfo = await this.getPrimaryTokenInfo(tokenInfo.symbol);
    this.sqlQuery = new Query({
      ...config.sql,
      charset: 'utf8mb4'
    });
    await this.sqlQuery.insertContract(contractTokenFormatter(tokenInfo));
    if (primaryTokenInfo) {
      await this.sqlQuery.insertContract(contractTokenFormatter(primaryTokenInfo));
    }
    const resources = await this.getResourceTokenInfo();
    await Promise.all(resources.filter(v => !!v).map(v => this.sqlQuery.insertContract(contractTokenFormatter(v))));
    const inlineTokens = await this.getInlineToken();
    await Promise.all(inlineTokens.filter(v => !!v).map(v => this.sqlQuery.insertContract(contractTokenFormatter(v))));
    const hasNodeInfo = await this.sqlQuery.hasNodeInfo();
    if (!hasNodeInfo) {
      await this.sqlQuery.insertNodesInfo([
        config.contracts.token,
        config.chainId,
        config.blockApi,
        config.blockApi,
        config.scan.host,
        config.scan.host,
        tokenInfo.symbol,
        'owner',
        1
      ]);
    }
    await this.sqlQuery.initCounts();
    const options = await this.getConfig();
    options.aelfInstance = this.aelf;
    this.scanner = new Scanner(new DBOperation({}, this.sqlQuery), options);
    try {
      await this.scanner.start();
      console.log('start loop');
    } catch (err) {
      console.error('root catch', err);
      await sendEmails(err);
      this.cleanup();
    }
  }

  async getInlineToken() {
    return Promise.all([
      'VOTE',
      'SHARE'
    ].map(symbol => config.token.GetTokenInfo.call({ symbol })));
  }

  cleanup() {
    console.log('cleanup');
    if (customInsert.sqlQuery) {
      customInsert.sqlQuery.close();
    }
    process.exit(1);
  }

  getELFTokenInfo() {
    return config.token.GetNativeTokenInfo.call();
  }

  async getPrimaryTokenInfo(symbol) {
    const tokenContract = config.token;
    const {
      value: primaryTokenSymbol
    } = await tokenContract.GetPrimaryTokenSymbol.call();
    if (primaryTokenSymbol !== symbol) {
      return tokenContract.GetTokenInfo.call({
        symbol: primaryTokenSymbol
      });
    }
    return null;
  }

  async getResourceTokenInfo() {
    const { value: resource } = await config.token.GetResourceTokenInfo.call();
    return resource || [];
  }

  async getConfig() {
    // 获取表中最大高度，获取表中缺失的高度列表
    const maxHeight = await this.sqlQuery.getMaxHeight();
    console.log(`max height in confirmed blocks ${maxHeight}`);
    const missingHeights = await this.sqlQuery.getMissingHeights();
    console.log(`missing heights in confirmed blocks ${JSON.stringify(missingHeights)}`);
    return {
      ...config.scan,
      startHeight: maxHeight + 1,
      missingHeightList: missingHeights.slice()
    };
  }

  async restart() {
    await this.init();
  }
}

customInsert = new CustomInsert(config);

customInsert.init();
