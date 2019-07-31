/**
 * @file redis
 * @author atom-yang
 * @date 2019-07-30
 */

class Counter {
  constructor(redisClient, keys, initialCount = {}) {
    this.client = redisClient;
    this.redisKeys = keys;
    this.initialCount = initialCount;
  }

  async init() {
    Object.keys(this.redisKeys).forEach(async key => {
      try {
        const result = await this.promisifyCommand('set', this.redisKeys[key], this.initialCount[key] || 0);
        if (result !== 'OK') {
          throw new Error(`${this.redisKeys[key]} set is not OK`);
        }
      } catch (e) {
        console.log('err happened when trying to connect to redis');
        console.error(e);
        throw e;
      }
    });
  }

  promisifyCommand(command, ...args) {
    return new Promise((resolve, reject) => {
      this.client[command](...args, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }

  close() {
    this.client.quit();
  }
}

module.exports = Counter;
