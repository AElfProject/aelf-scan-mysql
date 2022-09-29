/**
 * @file config for dev
 * @author atom-yang
 * @date 2019-07-23
 */

module.exports = {
  // 数据库信息
  sql: {
    host: '127.0.0.1',
    port: '3306',
    user: 'root',
    password: 'password',
    database: 'aelf_main_chain',
    connectionLimit: 100
  },
  // redis用于存储一些统计类信息，目前包括总交易量，总区块数等
  redis: {
    // redis链接信息
    connection: {
      host: '127.0.0.1',
      port: 6379
    },
    // 不需要修改
    keys: {
      blocksCount: 'blocks_count',
      blocksUnconfirmedCount: 'blocks_unconfirmed_count',
      txsCount: 'txs_count',
      txsUnconfirmedCount: 'txs_unconfirmed_count',
      resourceCount: 'resource_count',
      resourceUnconfirmedCount: 'resource_unconfirmed_count',
      tokenCount: 'token_count',
      LIBHeight: 'lib_height',
      bestHeight: 'best_height'
    }
  },
  // 扫链的相关配置，具体配置项查看aelf-block-scan的文档
  scan: {
    interval: 4000,
    concurrentQueryLimit: 5,
    // 节点的地址
    host: 'http://192.168.199.109:8002',
    maxInsert: 20
  },
  wallet: {
    privateKey: 'f6e512a3c259e5f9af981d7f99d245aa5bc52fe448495e0b0dd56e8406be6f71'
  },
  contracts: {
    // Token合约可以通过getContractAddressByName来获取
    token: 'AElf.ContractNames.Token',
    resource: 'AElf.ContractNames.TokenConverter',
    tokenConverter: 'AElf.ContractNames.TokenConverter'
  },
  // 已废弃
  tps: {
    minutes: 1, // minute
    interval: 60, // s, 秒
    scanInterval: 60 * 5, // s
    delayTime: 30, // s
    batchLimitTime: 60 * 10, // s
    batchDayInterval: 24 * 3600, // s
    maxQuery: 20,
    maxInsert: 200
  },
  // aelf-block-api的地址，用于初始化
  blockApi: 'http://127.0.0.1:7101',
  // 报错重启时的邮件发送
  mails: {
    type: 'smtp', // smtp | sendmail
    sendmailPath: '/usr/sbin/sendmail',
    user: 'scan@domain.io', // generated ethereal user
    from: 'AElf scan <aelf.scan@aelf.io>',
    to: ['test@mail.com'],
    subject: 'error happened when scanning', // mail subject
    smtpConfig: {
      host: "smtp.domain.com",
      port: 465,
      secure: true,
      auth: {
        user: "monitor@domain.com",
        pass: "password",
      }
    }
  }
};
